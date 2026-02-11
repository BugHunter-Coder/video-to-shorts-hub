import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

const Analyze = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  if (!user) { navigate("/auth"); return null; }

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube URL.", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Create video record
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        youtube_url: url,
        youtube_video_id: videoId,
        thumbnail_url: thumbnailUrl,
        status: "processing",
      })
      .select()
      .single();

    if (insertError || !video) {
      toast({ title: "Error", description: "Failed to create analysis.", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Call edge function
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-video`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ videoId: video.id, youtubeVideoId: videoId }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Analysis failed");
      }

      navigate(`/results/${video.id}`);
    } catch (err: any) {
      toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
      await supabase.from("videos").update({ status: "failed", error_message: err.message }).eq("id", video.id);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center px-6 py-4 max-w-3xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </nav>

      <main className="max-w-xl mx-auto px-6 py-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Analyze a Video</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAnalyze} className="space-y-4">
              <Input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                disabled={loading}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing…
                  </>
                ) : (
                  "Find 10 Shorts →"
                )}
              </Button>
            </form>
            {loading && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                This may take 30–60 seconds. We're fetching the transcript and running AI analysis.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analyze;
