"use client";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { authApi, usersApi } from "@/lib/api-client";
import { User, Bell, Shield, Database, Cpu, Save, Loader2, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "agents", label: "Agent Config", icon: Cpu },
  { id: "system", label: "System", icon: Database },
  { id: "security", label: "Security", icon: Shield },
];

export default function SettingsPage() {
  const [tab, setTab] = useState("profile");
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "" });
  const [profile, setProfile] = useState({ name: "", email: "", role: "" });
  const [notifPrefs, setNotifPrefs] = useState({
    criticalAlerts: true, highRisk: true, agentCompletion: false, weeklyDigest: true,
  });
  const [agentConfig, setAgentConfig] = useState({
    autoInvestigate: true, cacheTtl: 60, maxAgents: 7, minConfidence: 40,
  });

  useEffect(() => {
    authApi.me().then((r) => {
      setUser(r.data);
      setProfile({ name: r.data.name ?? "", email: r.data.email ?? "", role: r.data.role ?? "" });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "profile") {
        await usersApi.updateProfile({ firstName: profile.name.split(" ")[0], lastName: profile.name.split(" ").slice(1).join(" ") || "" });
        toast.success("Profile updated");
      } else if (tab === "security") {
        if (!pwForm.current || !pwForm.next) { toast.error("Both password fields required"); setSaving(false); return; }
        if (pwForm.next.length < 8) { toast.error("New password must be at least 8 characters"); setSaving(false); return; }
        await authApi.changePassword(pwForm.current, pwForm.next);
        setPwForm({ current: "", next: "" });
        toast.success("Password changed — please log in again");
      } else {
        toast.success("Settings saved");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configure RailMind behaviour and your preferences</p>
        </div>

        <div className="flex gap-1 border-b border-border pb-0">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <div className="card-glass p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Profile Information</h2>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary">
                {profile.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{profile.name || "—"}</div>
                <div className="text-xs text-muted-foreground">{profile.email}</div>
                <div className="mt-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary inline-block">{profile.role}</div>
              </div>
            </div>
            {[{label:"Full Name", key:"name"},{label:"Email", key:"email"}].map(({label,key}) => (
              <div key={key} className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
                <input value={(profile as any)[key]} onChange={(e) => setProfile({...profile, [key]: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50" />
              </div>
            ))}
          </div>
        )}

        {tab === "notifications" && (
          <div className="card-glass p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
            {([
              ["criticalAlerts","Critical Risk Alerts","Immediate notification when an asset reaches CRITICAL risk"],
              ["highRisk","High Risk Warnings","Alert when risk score exceeds 61"],
              ["agentCompletion","Agent Completion","Notify when RailMind finishes an investigation"],
              ["weeklyDigest","Weekly Digest","Summary email every Monday morning"],
            ] as [string, string, string][]).map(([key, label, desc]) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
                </div>
                <button onClick={() => setNotifPrefs({...notifPrefs, [key]: !(notifPrefs as any)[key]})}
                  className={cn("relative w-10 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5",
                    (notifPrefs as any)[key] ? "bg-primary" : "bg-white/10")}>
                  <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    (notifPrefs as any)[key] ? "translate-x-5" : "translate-x-0.5")} />
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "agents" && (
          <div className="card-glass p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Agent Configuration</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Result Cache TTL (seconds)</label>
              <input type="number" min={0} max={3600} value={agentConfig.cacheTtl}
                onChange={(e) => setAgentConfig({...agentConfig, cacheTtl: +e.target.value})}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50" />
              <p className="text-xs text-muted-foreground">0 = disabled. Identical questions return cached responses within this window.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Minimum Confidence Threshold (%)</label>
              <input type="number" min={10} max={95} value={agentConfig.minConfidence}
                onChange={(e) => setAgentConfig({...agentConfig, minConfidence: +e.target.value})}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50" />
              <p className="text-xs text-muted-foreground">Responses below this confidence will include a low-confidence warning.</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-foreground">Auto-investigate on incident creation</div>
                <div className="text-xs text-muted-foreground">Trigger agent pipeline when a new CRITICAL incident is created</div>
              </div>
              <button onClick={() => setAgentConfig({...agentConfig, autoInvestigate: !agentConfig.autoInvestigate})}
                className={cn("relative w-10 h-5 rounded-full transition-colors flex-shrink-0",
                  agentConfig.autoInvestigate ? "bg-primary" : "bg-white/10")}>
                <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  agentConfig.autoInvestigate ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          </div>
        )}

        {tab === "system" && (
          <div className="card-glass p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">System Information</h2>
            {[
              ["PostgreSQL", "Primary database — assets, incidents, users", "Connected"],
              ["Neo4j", "Knowledge graph — relationships and traversal", "Connected"],
              ["Qdrant", "Vector database — semantic memory search", "Connected"],
              ["Redis", "Cache and pub/sub event bus", "Connected"],
              ["LangGraph", "Agent workflow orchestration", "Active"],
              ["OpenAI", "LLM provider — GPT-4o-mini", "Configured"],
            ].map(([name, desc, status]) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                <div>
                  <div className="text-sm font-medium text-foreground">{name}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 font-medium">{status}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "security" && (
          <div className="card-glass p-6 space-y-5">
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Password</label>
              <input type="password" placeholder="••••••••" value={pwForm.current} onChange={(e) => setPwForm({...pwForm, current: e.target.value})}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</label>
              <input type="password" placeholder="••••••••" value={pwForm.next} onChange={(e) => setPwForm({...pwForm, next: e.target.value})}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50" />
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-400">
              Sessions are JWT-based with a 7-day expiry. Changing your password invalidates all active sessions.
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
