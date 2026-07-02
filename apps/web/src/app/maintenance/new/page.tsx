"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { maintenanceApi, assetsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { ArrowLeft, Wrench, Loader2, Save, Calendar } from "lucide-react";
import toast from "react-hot-toast";

const MAINTENANCE_TYPES = ["INSPECTION", "REPAIR", "REPLACEMENT", "CALIBRATION", "UPGRADE", "EMERGENCY_REPAIR", "SCHEDULED_MAINTENANCE"];
const OUTCOMES = ["SUCCESSFUL", "PARTIAL", "FAILED", "DEFERRED"];

export default function NewWorkOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    assetId: searchParams.get("assetId") ?? "",
    maintenanceType: "INSPECTION",
    description: "",
    findings: "",
    outcome: "SUCCESSFUL",
    performedAt: new Date().toISOString().slice(0, 16),
  });

  useEffect(() => {
    assetsApi.getAll().then((r) => setAssets(r.data ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.assetId || !form.description) {
      toast.error("Asset and description are required");
      return;
    }
    setLoading(true);
    try {
      await maintenanceApi.createWorkOrder({
        ...form,
        performedAt: new Date(form.performedAt).toISOString(),
      });
      toast.success("Work order created");
      router.push("/maintenance");
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? "Failed to create work order");
    } finally {
      setLoading(false);
    }
  };

  const TYPE_COLORS: Record<string, string> = {
    INSPECTION: "border-blue-500/40 text-blue-400",
    REPAIR: "border-orange-500/40 text-orange-400",
    REPLACEMENT: "border-red-500/40 text-red-400",
    CALIBRATION: "border-purple-500/40 text-purple-400",
    PREVENTIVE: "border-green-500/40 text-green-400",
    CORRECTIVE: "border-yellow-500/40 text-yellow-400",
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
            <h1 className="text-xl font-bold text-foreground">Create Work Order</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Log a maintenance activity or schedule an intervention</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Asset + Time */}
          <div className="card-glass p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Asset & Schedule</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Asset *
              </label>
              <select
                value={form.assetId}
                onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                required
                aria-label="Select asset"
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <Calendar className="w-3 h-3 inline mr-1" />
                Performed At
              </label>
              <input
                type="datetime-local"
                value={form.performedAt}
                onChange={(e) => setForm({ ...form, performedAt: e.target.value })}
                aria-label="Performed at"
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Maintenance Type */}
          <div className="card-glass p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Maintenance Type</h3>
            <div className="grid grid-cols-3 gap-2">
              {MAINTENANCE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, maintenanceType: t })}
                  className={cn(
                    "py-2 px-3 rounded-lg border text-xs font-bold transition-all text-left",
                    form.maintenanceType === t
                      ? `${TYPE_COLORS[t]} bg-white/10`
                      : "border-border text-muted-foreground hover:border-border/80"
                  )}
                >
                  <Wrench className="w-3 h-3 mb-1" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="card-glass p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Work Details</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description *</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the maintenance work performed or to be performed..."
                rows={3}
                required
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Findings</label>
              <textarea
                value={form.findings}
                onChange={(e) => setForm({ ...form, findings: e.target.value })}
                placeholder="Any observations, measurements, or anomalies found during maintenance..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>

            {/* Outcome */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Outcome</label>
              <div className="grid grid-cols-4 gap-2">
                {OUTCOMES.map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setForm({ ...form, outcome: o })}
                    className={cn(
                      "py-2 rounded-lg border text-xs font-bold transition-all",
                      form.outcome === o
                        ? "border-primary/60 text-primary bg-primary/10"
                        : "border-border text-muted-foreground hover:border-border/80"
                    )}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          </div>

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
              disabled={loading || !form.assetId || !form.description}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? "Creating..." : "Create Work Order"}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
