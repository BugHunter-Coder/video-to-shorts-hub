import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Scissors, Zap, Clock, Copy } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  { icon: Zap, title: "AI-Powered", desc: "Gemini identifies the 10 most viral-worthy moments automatically" },
  { icon: Clock, title: "Timestamps Ready", desc: "Get exact start & end times to clip in any editor" },
  { icon: Scissors, title: "Hook Scripts", desc: "Each short comes with a scroll-stopping opening line" },
  { icon: Copy, title: "One-Click Copy", desc: "Copy titles, hooks, and descriptions instantly" },
];

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h2 className="text-xl font-bold font-[Space_Grotesk]">
          <span className="text-primary">Short</span>Cuts
        </h2>
        <div className="flex gap-3">
          {user ? (
            <Button onClick={() => navigate("/dashboard")}>Dashboard</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/auth")}>Log in</Button>
              <Button onClick={() => navigate("/auth?tab=signup")}>Get Started</Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            Powered by AI
          </span>
          <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            Turn any video into{" "}
            <span className="text-primary">10 viral shorts</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Upload your video. Get 10 perfectly timed clips with catchy titles, hook lines, and descriptions — then publish directly to YouTube.
          </p>
          <Button
            size="lg"
            className="text-lg px-8 h-14 rounded-xl"
            onClick={() => navigate(user ? "/dashboard" : "/auth?tab=signup")}
          >
            Start for Free →
          </Button>
        </motion.div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mt-24">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
              className="flex items-start gap-4 p-6 rounded-xl bg-card border text-left"
            >
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <f.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                <p className="text-muted-foreground text-sm">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Landing;
