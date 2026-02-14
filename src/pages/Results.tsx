import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Clock, Loader2, Upload, Youtube } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const Results = () => {
  const { id } = useParams<{ id: string }>();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Tables<"videos"> | null>(null);
  const [shorts, setShorts] = useState<Tables<"shorts">[]>([]);
  const [loading, setLoading] = useState(true);
  const [ytConnected, setYtConnected] = useState(false);
  const [ytChannel, setYtChannel] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !id) { navigate("/auth"); return; }

    const fetchData = async () => {
      const [videoRes, shortsRes] = await Promise.all([
        supabase.from("videos").select("*").eq("id", id).single(),
        supabase.from("shorts").select("*").eq("video_id", id).order("short_number"),
      ]);
      setVideo(videoRes.data);
      setShorts(shortsRes.data || []);
      setLoading(false);
    };

    const checkYouTube = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-upload?action=status`,
          { headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
        const data = await res.json();
        setYtConnected(data.connected);
        setYtChannel(data.channel?.channel_title || null);
      } catch {}
    };

    fetchData();
    checkYouTube();
  }, [user, id, navigate, session]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: "Copied to clipboard." });
  };

  const copyAll = () => {
    const text = shorts
      .map(
        (s) =>
          `#${s.short_number} — ${s.title}\nTimestamp: ${s.start_timestamp} – ${s.end_timestamp}\nHook: ${s.hook_line}\n${s.description}`
      )
      .join("\n\n---\n\n");
    copyToClipboard(text);
  };

  const connectYouTube = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-upload?action=auth-url`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Error", description: data.error || "Failed to get auth URL", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to connect YouTube", variant: "destructive" });
    }
  };

  const uploadToYouTube = async (short: Tables<"shorts">) => {
    if (!video) return;
    setUploading(short.id);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-upload?action=upload`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            videoId: video.id,
            shortTitle: short.title,
            shortDescription: `${short.hook_line}\n\n${short.description}`,
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Uploaded to YouTube!",
          description: `Published as private. View at ${data.youtubeUrl}`,
        });
      } else {
        throw new Error(data.error || "Upload failed");
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Video not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center px-6 py-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
        </Button>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Video header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-1">{video.title || "Video Analysis"}</h1>
          </div>
        </div>

        {/* YouTube connection */}
        <Card className="mb-6 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Youtube className="w-6 h-6 text-destructive" />
              {ytConnected ? (
                <div>
                  <p className="font-medium text-sm">Connected to YouTube</p>
                  {ytChannel && <p className="text-xs text-muted-foreground">{ytChannel}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Connect YouTube to upload shorts directly</p>
              )}
            </div>
            {!ytConnected && (
              <Button size="sm" onClick={connectYouTube}>
                <Youtube className="w-4 h-4 mr-1" /> Connect YouTube
              </Button>
            )}
          </div>
        </Card>

        {shorts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {video.status === "failed"
                ? `Analysis failed: ${video.error_message || "Unknown error"}`
                : "No shorts generated yet."}
            </p>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">{shorts.length} Shorts Found</h2>
              <Button variant="outline" size="sm" onClick={copyAll}>
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
            </div>

            <div className="grid gap-4">
              {shorts.map((s) => (
                <Card key={s.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">
                        <span className="text-primary mr-2">#{s.short_number}</span>
                        {s.title}
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() =>
                          copyToClipboard(
                            `${s.title}\nTimestamp: ${s.start_timestamp} – ${s.end_timestamp}\nHook: ${s.hook_line}\n${s.description}`
                          )
                        }
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="font-mono">
                        {s.start_timestamp} – {s.end_timestamp}
                      </span>
                      {s.duration_seconds && (
                        <span className="text-muted-foreground">({s.duration_seconds}s)</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-accent mb-0.5">Hook</p>
                      <p className="text-sm italic">"{s.hook_line}"</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-0.5">Why it works</p>
                      <p className="text-sm">{s.description}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      {ytConnected && (
                        <Button
                          size="sm"
                          onClick={() => uploadToYouTube(s)}
                          disabled={uploading === s.id}
                        >
                          {uploading === s.id ? (
                            <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Uploading…</>
                          ) : (
                            <><Upload className="w-4 h-4 mr-1" /> Upload to YouTube</>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          copyToClipboard(`${s.title}\n${s.hook_line}\n${s.description}`)
                        }
                      >
                        <Copy className="w-4 h-4 mr-1" /> Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Results;
