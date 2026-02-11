import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, LogOut, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-4 h-4 text-muted-foreground" />,
  processing: <Loader2 className="w-4 h-4 text-primary animate-spin" />,
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <AlertCircle className="w-4 h-4 text-destructive" />,
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<Tables<"videos">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setVideos(data || []);
        setLoading(false);
      });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <h2 className="text-xl font-bold font-[Space_Grotesk]">
          <span className="text-primary">Short</span>Cuts
        </h2>
        <div className="flex gap-3">
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }}>
            <LogOut className="w-4 h-4 mr-1" /> Sign Out
          </Button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Videos</h1>
          <Button onClick={() => navigate("/analyze")}>
            <Plus className="w-4 h-4 mr-1" /> New Analysis
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : videos.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No videos analyzed yet.</p>
            <Button onClick={() => navigate("/analyze")}>
              <Plus className="w-4 h-4 mr-1" /> Analyze Your First Video
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {videos.map((v) => (
              <Card
                key={v.id}
                className="p-4 flex items-center gap-4 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => v.status === "completed" && navigate(`/results/${v.id}`)}
              >
                {v.thumbnail_url && (
                  <img
                    src={v.thumbnail_url}
                    alt={v.title || "Video thumbnail"}
                    className="w-28 h-16 rounded-md object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{v.title || v.youtube_url}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-sm capitalize shrink-0">
                  {statusIcons[v.status]} {v.status}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
