"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { maintenanceApi } from "@/lib/api-client";
import { cn, formatDate, formatRelative } from "@/lib/utils";
import { Wrench, AlertTriangle, Clock, CheckCircle2, Loader2, Plus, RefreshCw, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

const PRI_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/20 text-green-400 border-green-500/30",
};

function PriBadge({ v }: { v: string }) {
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", PRI_COLORS[v] ?? "bg-white/10 text-muted-foreground border-border")}>
      {v}
    </span>
  );
}

export default function MaintenancePage() {
  const router = useRouter();
  const [queue, setQueue] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "history" | "stats">("queue");

  const load = async () => {
    setLoading(true);
    try {
      const [q, w, s] = await Promise.all([
        maintenanceApi.getQueue(),
        maintenanceApi.getWorkOrders(),
        maintenanceApi.getStats(),
      ]);
      setQueue(q.data?.queue ?? []);
      setWorkOrders(w.data ?? []);
      setStats(s.data);
    } catch (e) {
      toast.error("Failed to load maintenance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tabs = [
    { id: "queue", label: `Maintenance Queue (${queue.length})` },
    { id: "history", label: `Work Orders (${workOrders.length})` },
    { id: "stats", label: "Statistics" },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Maintenance Planner</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Risk-based maintenance scheduling and work order management</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={load}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => router.push("/maintenance/new")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Work Order
            </button>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              <div className="text-xs text-muted-foreground mt-1">Total Records</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{stats.assetsNeedingMaintenance}</div>
              <div className="text-xs text-muted-foreground mt-1">Assets Need Attention</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{stats.byOutcome?.SUCCESSFUL ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Successful</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-orange-400">{stats.byOutcome?.FAILED ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Failed</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === t.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Loading maintenance data...</span>
          </div>
        ) : (
          <>
            {/* Maintenance Queue */}
            {activeTab === "queue" && (
              <div className="space-y-3">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                    <CheckCircle2 className="w-10 h-10 text-green-400/50" />
                    <p className="text-sm">No assets require immediate maintenance</p>
                  </div>
                ) : (
                  queue.map((item: any) => (
                    <div
                      key={item.assetId}
                      onClick={() => router.push(`/assets/${item.assetId}`)}
                      className="card-glass p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-sm font-mono font-bold text-primary">{item.assetCode}</span>
                            <PriBadge v={item.priority} />
                            <span className="text-xs text-muted-foreground">{item.assetType}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{item.assetName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.stationName}</p>
                          <p className="text-xs text-foreground mt-1.5">{item.recommendedAction}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {item.dueBy}
                            </span>
                            {item.lastMaintenanceAt && (
                              <span className="text-xs text-muted-foreground">
                                Last: {formatDate(item.lastMaintenanceAt)}
                              </span>
                            )}
                            {item.daysSinceLastMaintenance > 365 && (
                              <span className="text-xs text-orange-400">
                                {item.daysSinceLastMaintenance} days overdue
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={cn(
                            "text-xl font-bold",
                            item.riskScore >= 81 ? "text-red-400" :
                            item.riskScore >= 61 ? "text-orange-400" :
                            item.riskScore >= 31 ? "text-yellow-400" : "text-green-400"
                          )}>
                            {item.riskScore}<span className="text-xs text-muted-foreground">/100</span>
                          </div>
                          <div className="text-xs text-muted-foreground">risk</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Health: {item.healthScore}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Work Orders / History */}
            {activeTab === "history" && (
              <div className="space-y-3">
                {workOrders.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">No maintenance records found</div>
                ) : (
                  workOrders.map((wo: any) => (
                    <div key={wo.id} className="card-glass p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Wrench className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-medium text-foreground">
                            {wo.maintenanceType?.replace(/_/g, " ")}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            wo.outcome === "SUCCESSFUL" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                            wo.outcome === "FAILED" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                            "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          )}>
                            {wo.outcome}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(wo.performedAt)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{wo.description}</p>
                      {wo.findings && (
                        <p className="text-xs text-foreground mt-1.5 pl-3 border-l border-border/50">{wo.findings}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {wo.asset?.assetCode && (
                          <span className="font-mono text-primary">{wo.asset.assetCode}</span>
                        )}
                        {wo.asset?.station?.name && <span>{wo.asset.station.name}</span>}
                        {wo.performedBy && (
                          <span>{wo.performedBy.firstName} {wo.performedBy.lastName}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Stats */}
            {activeTab === "stats" && stats && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="card-glass p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Maintenance Type</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byType ?? {}).map(([type, count]: any) => (
                      <div key={type} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-xs text-muted-foreground">{type.replace(/_/g, " ")}</span>
                        <span className="text-sm font-bold text-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-glass p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">By Outcome</h3>
                  <div className="space-y-2">
                    {Object.entries(stats.byOutcome ?? {}).map(([outcome, count]: any) => (
                      <div key={outcome} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-xs text-muted-foreground">{outcome}</span>
                        <span className={cn(
                          "text-sm font-bold",
                          outcome === "SUCCESSFUL" ? "text-green-400" :
                          outcome === "FAILED" ? "text-red-400" : "text-yellow-400"
                        )}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
