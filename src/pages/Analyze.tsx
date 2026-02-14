import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";

const ASPECT_RATIOS = [
  { value: "9:16", label: "9:16 (Shorts / TikTok / Reels)" },
  { value: "1:1", label: "1:1 (Square)" },
  { value: "4:5", label: "4:5 (Instagram)" },
  { value: "16:9", label: "16:9 (Landscape)" },
];

const Analyze = () => {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [title, setTitle] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) { navigate("/auth"); return null; }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) setTitle(selected.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: "No file", description: "Please upload a video file.", variant: "destructive" });
      return;
    }

    setLoading(true);

    // Upload file
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
    const fileUrl = urlData.publicUrl;

    // Create video record (no youtube URL needed for local files)
    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        youtube_url: "local-upload",
        youtube_video_id: "local",
        title: title || file.name,
        status: "processing",
        file_url: fileUrl,
        aspect_ratio: aspectRatio,
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
          body: JSON.stringify({ videoId: video.id, title: title || file.name }),
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
            <form onSubmit={handleAnalyze} className="space-y-5">
              {/* Video title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Video Title</label>
                <Input
                  placeholder="My awesome video"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* File upload */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Upload Video File *</label>
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
                    className="w-full h-24 border-dashed"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Click to upload video</span>
                    </div>
                  </Button>
                )}
              </div>

              {/* Aspect ratio */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Shorts Aspect Ratio</label>
                <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={loading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASPECT_RATIOS.map((ar) => (
                      <SelectItem key={ar.value} value={ar.value}>{ar.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !file}>
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
                This may take 30–60 seconds. We're running AI analysis on your video.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Analyze;
