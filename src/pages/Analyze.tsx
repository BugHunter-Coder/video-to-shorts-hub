import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

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
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) { navigate("/auth"); return null; }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const maxSize = 500 * 1024 * 1024; // 500MB
      if (selected.size > maxSize) {
        toast({ title: "File too large", description: "Maximum file size is 500MB.", variant: "destructive" });
        return;
      }
      setFile(selected);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const videoId = extractVideoId(url);
    if (!videoId) {
      toast({ title: "Invalid URL", description: "Please enter a valid YouTube URL.", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Upload file if provided
    let fileUrl: string | null = null;
    if (file) {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("user-videos")
        .upload(filePath, file);
      if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        setLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("user-videos").getPublicUrl(filePath);
      fileUrl = urlData.publicUrl;
    }

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
        file_url: fileUrl,
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

              {/* File upload (optional) */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Optionally attach your video file for reference:</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                {file ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
                    <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <Upload className="w-4 h-4 mr-2" /> Attach video file
                  </Button>
                )}
              </div>

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
