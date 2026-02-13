import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { videoId, title } = await req.json();
    if (!videoId) throw new Error("Missing videoId");

    const { data: video } = await supabase
      .from("videos")
      .select("*")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .single();
    if (!video) throw new Error("Video not found");

    const videoTitle = title || video.title || "Untitled video";

    // Update title if provided
    if (title && title !== video.title) {
      await supabase.from("videos").update({ title }).eq("id", videoId);
    }

    console.log("Analyzing video:", videoTitle);

    // AI Analysis - generate shorts suggestions based on title/description
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are an expert short-form content strategist. Based on the video title provided, suggest 10 creative short-form video ideas that could be extracted from this content (TikTok, YouTube Shorts, Reels).

For each moment, return:
- short_number (1-10)
- title: a catchy, platform-ready title (max 60 chars)
- hook_line: the opening line that would stop someone from scrolling (1 sentence)
- description: why this angle works as a short (2-3 sentences)
- start_timestamp: format "0:00" (estimated)
- end_timestamp: format "0:30" (estimated)
- duration_seconds: estimated duration in seconds (15-60 range)

Be creative and focus on angles that tend to go viral.`;

    const userContent = `Video title: "${videoTitle}". Suggest 10 short-form video ideas based on the topic.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_shorts",
              description: "Save the 10 identified short-form video moments",
              parameters: {
                type: "object",
                properties: {
                  shorts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        short_number: { type: "number" },
                        title: { type: "string" },
                        hook_line: { type: "string" },
                        description: { type: "string" },
                        start_timestamp: { type: "string" },
                        end_timestamp: { type: "string" },
                        duration_seconds: { type: "number" },
                      },
                      required: ["short_number", "title", "hook_line", "description", "start_timestamp", "end_timestamp", "duration_seconds"],
                    },
                  },
                },
                required: ["shorts"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_shorts" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        await supabase.from("videos").update({ status: "failed", error_message: "Rate limited." }).eq("id", videoId);
        return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        await supabase.from("videos").update({ status: "failed", error_message: "AI credits exhausted." }).eq("id", videoId);
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI analysis failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return structured data");

    const { shorts } = JSON.parse(toolCall.function.arguments);

    const shortsToInsert = shorts.map((s: any) => ({
      video_id: videoId,
      short_number: s.short_number,
      title: s.title,
      hook_line: s.hook_line,
      description: s.description,
      start_timestamp: s.start_timestamp,
      end_timestamp: s.end_timestamp,
      duration_seconds: s.duration_seconds,
    }));

    const { error: insertError } = await supabase.from("shorts").insert(shortsToInsert);
    if (insertError) {
      console.error("Insert shorts error:", insertError);
      throw new Error("Failed to save shorts");
    }

    await supabase.from("videos").update({ status: "completed" }).eq("id", videoId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-video error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
