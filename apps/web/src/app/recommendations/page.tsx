"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { recommendationsApi } from "@/lib/api-client";
import { cn, formatRelative } from "@/lib/utils";
import { Lightbulb, CheckCircle2, XCircle, Clock, Loader2, Filter } from "lucide-react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import toast from "react-hot-toast";

const PRI_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/20 text-green-400 border-green-500/30",
};
const STAT_COLORS: Record<string, string> = {
  PENDING: "text-yellow-400",
  APPROVED: "text-green-400",
  REJECTED: "text-red-400",
  COMPLETED: "text-blue-400",
  IN_PROGRESS: "text-purple-400",
};

function PriBadge({ v }: { v: string }) {
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", PRI_COLORS[v] ?? "bg-white/10 text-muted-foreground border-border")}>{v}</span>;
}

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [acting, setActing] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      recommendationsApi.getAll({ status: filter || undefined }),
      recommendationsApi.getStats(),
    ]).then(([r, s]) => {
      setRecs(r.data ?? []);
      setStats(s.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filter]);

  const act = async (id: string, action: "approve" | "reject" | "complete") => {
    setActing(id);
    try {
      if (action === "approve") await recommendationsApi.approve(id);
      else if (action === "reject") await recommendationsApi.reject(id);
      else await recommendationsApi.complete(id);
      toast.success(`Recommendation ${action}d`);
      load();
    } catch { toast.error("Action failed"); }
    finally { setActing(null); }
  };

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">Recommendations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Evidence-based operational actions from RailMind AI</p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Pending", value: stats.pending, color: "text-yellow-400" },
              { label: "Approved", value: stats.approved, color: "text-green-400" },
              { label: "Completed", value: stats.completed, color: "text-blue-400" },
              { label: "Critical", value: stats.critical, color: "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="card-glass p-4 text-center">
                <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {["", "PENDING", "APPROVED", "COMPLETED", "REJECTED"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filter === s ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/5 text-muted-foreground hover:text-foreground border border-border")}>
              {s || "All"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Loading recommendations...</span>
          </div>
        ) : recs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Lightbulb className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No recommendations match current filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recs.map((rec: any) => (
              <div key={rec.id} className="card-glass p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <PriBadge v={rec.priority} />
                      <span className={cn("text-xs font-medium", STAT_COLORS[rec.status] ?? "text-muted-foreground")}>
                        {rec.status}
                      </span>
                      <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                    </div>
                    <h3 className="text-sm font-semibold text-foreground">{rec.action}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>

                    {/* Asset + incident */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {rec.asset?.assetCode && (
                        <span className="text-xs font-mono text-primary">{rec.asset.assetCode}</span>
                      )}
                      {rec.incident?.incidentNumber && (
                        <span className="text-xs text-muted-foreground">↔ {rec.incident.incidentNumber}</span>
                      )}
                      {rec.estimatedResolutionTime && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />{rec.estimatedResolutionTime}
                        </span>
                      )}
                    </div>

                    {/* Evidence */}
                    {(rec.evidence as any[])?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground mr-1">Evidence:</span>
                        {(rec.evidence as any[]).slice(0, 4).map((e: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {e.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {rec.status === "PENDING" && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => act(rec.id, "approve")}
                        disabled={acting === rec.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/20 disabled:opacity-50 transition-colors"
                      >
                        {acting === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Approve
                      </button>
                      <button
                        onClick={() => setConfirmReject(rec.id)}
                        disabled={acting === rec.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-3 h-3" />Reject
                      </button>
                    </div>
                  )}
                  {rec.status === "APPROVED" && (
                    <button
                      onClick={() => act(rec.id, "complete")}
                      disabled={acting === rec.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/20 disabled:opacity-50 transition-colors shrink-0"
                    >
                      <CheckCircle2 className="w-3 h-3" />Complete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {confirmReject && (
        <ConfirmDialog
          title="Reject Recommendation"
          message="This recommendation will be marked as rejected and removed from the active queue. This action cannot be undone."
          confirmLabel="Reject"
          variant="danger"
          onConfirm={async () => { await act(confirmReject, "reject"); setConfirmReject(null); }}
          onCancel={() => setConfirmReject(null)}
        />
      )}
    </AppLayout>
  );
}
