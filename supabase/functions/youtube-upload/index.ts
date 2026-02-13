import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Action: Get OAuth URL for YouTube connection
    if (action === "auth-url") {
      if (!GOOGLE_CLIENT_ID) throw new Error("YouTube integration not configured");
      const redirectUri = `${supabaseUrl}/functions/v1/youtube-upload?action=callback`;
      const scope = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${user.id}`;
      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: OAuth callback
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const userId = url.searchParams.get("state");
      if (!code || !userId) throw new Error("Missing code or state");

      const redirectUri = `${supabaseUrl}/functions/v1/youtube-upload?action=callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error("Failed to get tokens");

      // Get channel info
      const channelRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const channelData = await channelRes.json();
      const channel = channelData.items?.[0];

      // Upsert connection
      await supabase.from("youtube_connections").upsert({
        user_id: userId,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        channel_id: channel?.id || null,
        channel_title: channel?.snippet?.title || null,
      }, { onConflict: "user_id" });

      // Redirect back to dashboard
      const appUrl = req.headers.get("origin") || "https://video-to-tiny-tales.lovable.app";
      return new Response(`<html><script>window.location.href="${appUrl}/dashboard?yt=connected";</script></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    // Action: Check connection status
    if (action === "status") {
      const { data: conn } = await supabase
        .from("youtube_connections")
        .select("channel_id, channel_title, token_expires_at")
        .eq("user_id", user.id)
        .single();
      return new Response(JSON.stringify({ connected: !!conn, channel: conn }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Upload video to YouTube
    if (action === "upload") {
      const { videoId, shortTitle, shortDescription } = await req.json();
      if (!videoId) throw new Error("Missing videoId");

      // Get user's YouTube connection
      const { data: conn } = await supabase
        .from("youtube_connections")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (!conn) throw new Error("YouTube not connected");

      // Refresh token if expired
      let accessToken = conn.access_token;
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (!refreshData.access_token) throw new Error("Failed to refresh YouTube token");
        accessToken = refreshData.access_token;
        await supabase.from("youtube_connections").update({
          access_token: accessToken,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        }).eq("user_id", user.id);
      }

      // Get the video file URL
      const { data: video } = await supabase
        .from("videos")
        .select("file_url, title")
        .eq("id", videoId)
        .eq("user_id", user.id)
        .single();
      if (!video?.file_url) throw new Error("No video file found");

      // Download the video file
      const videoRes = await fetch(video.file_url);
      if (!videoRes.ok) throw new Error("Failed to fetch video file");
      const videoBlob = await videoRes.blob();

      // Upload to YouTube as a Short
      const metadata = {
        snippet: {
          title: shortTitle || video.title || "Short",
          description: shortDescription || "Created with ShortCuts",
          categoryId: "22",
        },
        status: {
          privacyStatus: "private",
          selfDeclaredMadeForKids: false,
        },
      };

      // Resumable upload
      const initRes = await fetch(
        "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": videoBlob.size.toString(),
            "X-Upload-Content-Type": videoBlob.type || "video/mp4",
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        console.error("YouTube init error:", errText);
        throw new Error("Failed to initiate YouTube upload");
      }

      const uploadUrl = initRes.headers.get("Location");
      if (!uploadUrl) throw new Error("No upload URL returned");

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": videoBlob.type || "video/mp4",
          "Content-Length": videoBlob.size.toString(),
        },
        body: videoBlob,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error("YouTube upload error:", errText);
        throw new Error("YouTube upload failed");
      }

      const uploadData = await uploadRes.json();
      return new Response(JSON.stringify({
        success: true,
        youtubeVideoId: uploadData.id,
        youtubeUrl: `https://youtube.com/shorts/${uploadData.id}`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("youtube-upload error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
