"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Train, Eye, EyeOff, Loader2 } from "lucide-react";
import { authApi } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth.store";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("engineer@railmind.com");
  const [password, setPassword] = useState("railmind123");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      const { user, tokens } = res.data;
      setAuth(user, tokens.accessToken);
      toast.success(`Welcome, ${user.firstName}`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { label: "Railway Engineer", email: "engineer@railmind.com" },
    { label: "Control Operator", email: "operator@railmind.com" },
    { label: "Administrator", email: "admin@railmind.com" },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-primary/10 via-background to-background border-r border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Train className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-lg font-bold text-foreground">RailMind</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Cognitive OS</div>
          </div>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-foreground leading-tight">
            Preserving Railway<br />
            <span className="text-primary">Intelligence</span><br />
            Forever.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Every incident solved today becomes organizational intelligence for tomorrow.
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4">
            {[
              { label: "Incidents Stored", value: "100+" },
              { label: "Lessons Learned", value: "30" },
              { label: "Graph Relationships", value: "300+" },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-border/30">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Northern Corridor Railway Network (NCRN) — Demo Environment
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <Train className="w-6 h-6 text-primary" />
            <span className="text-lg font-bold">RailMind</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="text-muted-foreground mt-1">Access the cognitive railway platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 text-sm transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 pr-10 rounded-lg bg-white/5 border border-border text-foreground focus:outline-none focus:border-primary/60 text-sm transition-colors"
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="border border-border/50 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Demo Accounts</div>
            {demoUsers.map((u) => (
              <button
                key={u.email}
                onClick={() => setEmail(u.email)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-white/3 hover:bg-white/8 text-left transition-colors"
              >
                <span className="text-sm text-foreground">{u.label}</span>
                <span className="text-xs font-mono text-muted-foreground">{u.email}</span>
              </button>
            ))}
            <p className="text-xs text-muted-foreground pt-1">Password: <code className="text-primary">railmind123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
}
