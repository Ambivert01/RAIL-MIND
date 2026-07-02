"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { incidentsApi, assetsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ArrowLeft, AlertTriangle, Loader2, Save } from "lucide-react";
import toast from "react-hot-toast";

const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function NewIncidentPage() {
  const router = useRouter();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    severity: "MEDIUM",
    assetId: "",
    weatherCondition: "",
    occurredAt: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    assetsApi.getAll().then((r) => setAssets(r.data ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.assetId) {
      toast.error("Title and asset are required");
      return;
    }
    setLoading(true);
    try {
      const res = await incidentsApi.create({
        ...form,
        occurredAt: new Date(form.occurredAt).toISOString(),
      });
      toast.success(`Incident ${res.data.incidentNumber} created`);
      router.push(`/incidents/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to create incident");
    } finally {
      setLoading(false);
    }
  };

  const SEV_COLORS: Record<string, string> = {
    LOW: "border-green-500/40 text-green-400",
    MEDIUM: "border-yellow-500/40 text-yellow-400",
    HIGH: "border-orange-500/40 text-orange-400",
    CRITICAL: "border-red-500/40 text-red-400",
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Report New Incident</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Log an operational incident for investigation</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="card-glass p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Incident Details</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Brief description of the incident"
                required
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detailed description of what happened, what was observed, any immediate actions taken..."
                rows={4}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Severity *</label>
              <div className="grid grid-cols-4 gap-2">
                {SEVERITIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, severity: s })}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all",
                      form.severity === s
                        ? `${SEV_COLORS[s]} bg-white/10`
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Asset + Time */}
          <div className="card-glass p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Location & Time</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Affected Asset *</label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
                aria-label="Select affected asset"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
              >
                <option value="">Select an asset...</option>
                {assets.map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} — {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Occurred At *</label>
                <input
                  type="datetime-local"
                  value={form.occurredAt}
                  onChange={(e) => setForm({ ...form, occurredAt: e.target.value })}
                  required
                  aria-label="Incident occurred at"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Weather Condition</label>
                <input
                  value={form.weatherCondition}
                  onChange={(e) => setForm({ ...form, weatherCondition: e.target.value })}
                  placeholder="e.g. Heavy Rainfall"
                  aria-label="Weather condition"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          {/* Severity banner */}
          {form.severity === "CRITICAL" && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">
                Critical severity — this incident will be immediately escalated and flagged on the Digital Twin.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !form.title || !form.assetId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? "Reporting..." : "Report Incident"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
