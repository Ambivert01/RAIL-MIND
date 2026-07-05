"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { riskApi } from "@/lib/api-client";
import { getRiskColor, cn, formatRelative } from "@/lib/utils";
import { ShieldAlert, Loader2, TrendingUp, AlertTriangle, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

function RiskBar({ score }: { score: number }) {
  const color = score >= 81 ? "bg-red-400" : score >= 61 ? "bg-orange-400" : score >= 31 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-foreground w-6 text-right">{score}</span>
    </div>
  );
}

function RiskBadge({ severity }: { severity: string }) {
  const c = getRiskColor(severity);
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.bg, c.text, c.border)}>{severity}</span>;
}

export default function RiskPage() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [heatmap, setHeatmap] = useState<Array<{ assetId: string; assetCode: string; riskScore: number; severity: string }>>([]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      riskApi.getDashboard(),
      riskApi.getHeatmap().catch(() => ({ data: [] })),
    ]).then(([dash, hm]) => {
      setDashboard(dash.data);
      setHeatmap(hm.data ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await riskApi.recalculate();
      toast.success("Risk scores recalculated");
      loadData();
    } catch { toast.error("Recalculation failed"); }
    finally { setRecalculating(false); }
  };

  if (loading) return (
    <AppLayout>
      <PageSkeleton />
    </AppLayout>
  );

  const dist = dashboard?.riskDistribution ?? {};
  const totalRisked = Object.values(dist).reduce((a: any, b: any) => a + b, 0) as number;

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Risk Intelligence Center</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Network-wide operational risk assessment</p>
          </div>
          <button onClick={handleRecalculate} disabled={recalculating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors">
            <RefreshCw className={cn("w-4 h-4", recalculating && "animate-spin")} />
            Recalculate
          </button>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{dashboard?.networkRiskScore ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Network Risk Score</div>
          </div>
          {[
            { label: "Critical", key: "CRITICAL", color: "text-red-400" },
            { label: "High", key: "HIGH", color: "text-orange-400" },
            { label: "Moderate", key: "MODERATE", color: "text-yellow-400" },
            { label: "Low", key: "LOW", color: "text-green-400" },
          ].map((s) => (
            <div key={s.key} className="card-glass p-4 text-center">
              <div className={cn("text-2xl font-bold", s.color)}>{dist[s.key] ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Distribution bar */}
        {totalRisked > 0 && (
          <div className="card-glass p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Risk Distribution</h3>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {[
                { key: "CRITICAL", color: "bg-red-400" },
                { key: "HIGH", color: "bg-orange-400" },
                { key: "MODERATE", color: "bg-yellow-400" },
                { key: "LOW", color: "bg-green-400" },
              ].map(({ key, color }) => {
                const pct = ((dist[key] ?? 0) / totalRisked) * 100;
                return pct > 0 ? (
                  <div key={key} className={cn(color, "h-full transition-all")} style={{ width: `${pct}%` }}
                    title={`${key}: ${dist[key]}`} />
                ) : null;
              })}
            </div>
            <div className="flex gap-4 mt-2 flex-wrap">
              {[
                { key: "CRITICAL", color: "bg-red-400" },
                { key: "HIGH", color: "bg-orange-400" },
                { key: "MODERATE", color: "bg-yellow-400" },
                { key: "LOW", color: "bg-green-400" },
              ].map(({ key, color }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", color)} />
                  <span className="text-xs text-muted-foreground">{key} ({dist[key] ?? 0})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Critical assets */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-foreground">Critical Risk Assets</h2>
            </div>
            {(dashboard?.criticalAssets?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No critical risks detected</div>
            ) : (
              <div className="space-y-3">
                {dashboard?.criticalAssets?.slice(0, 8).map((r: any) => (
                  <div key={r.id}
                    onClick={() => router.push(`/assets/${r.assetId}`)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/3 hover:bg-white/6 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{r.asset?.assetCode ?? r.assetId}</span>
                        <RiskBadge severity={r.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.asset?.station?.name}</p>
                      {r.possibleFailure && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.possibleFailure}</p>}
                    </div>
                    <div className="text-right shrink-0 w-24">
                      <RiskBar score={r.riskScore} />
                      <p className="text-xs text-muted-foreground mt-0.5">{r.confidence}% conf.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* High risk assets */}
          <div className="card-glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-foreground">High Risk Assets</h2>
            </div>
            {(dashboard?.highRiskAssets?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">No high risk assets</div>
            ) : (
              <div className="space-y-3">
                {dashboard?.highRiskAssets?.slice(0, 8).map((r: any) => (
                  <div key={r.id}
                    onClick={() => router.push(`/assets/${r.assetId}`)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/3 hover:bg-white/6 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{r.asset?.assetCode ?? r.assetId}</span>
                        <RiskBadge severity={r.severity} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{r.asset?.station?.name}</p>
                    </div>
                    <div className="shrink-0 w-24">
                      <RiskBar score={r.riskScore} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>


        {/* Risk Heatmap (RM-052) */}
        {heatmap.length > 0 && (
          <div className="card-glass p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Risk Heatmap — Asset Grid</h2>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {heatmap.map((cell: any) => {
                const score = cell.riskScore ?? 0;
                const bg = score >= 81 ? "bg-red-500/70" : score >= 61 ? "bg-orange-500/70" : score >= 31 ? "bg-yellow-500/70" : "bg-green-500/70";
                return (
                  <button
                    key={cell.assetId}
                    onClick={() => router.push(`/assets/${cell.assetId}`)}
                    title={`${cell.assetCode ?? cell.assetId}: ${score}/100`}
                    className={`${bg} rounded p-1.5 text-center cursor-pointer hover:scale-110 transition-transform`}
                  >
                    <div className="text-[9px] font-mono text-white font-bold truncate">{cell.assetCode ?? "—"}</div>
                    <div className="text-[10px] font-bold text-white">{score}</div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500/70" /><span>Low (&lt;31)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500/70" /><span>Medium (31–60)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-orange-500/70" /><span>High (61–80)</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500/70" /><span>Critical (&gt;80)</span></div>
            </div>
          </div>
        )}

        {/* All risks table */}
        <div className="card-glass p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">All Active Risks</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 pr-4">Asset</th>
                  <th className="text-left py-2 pr-4">Station</th>
                  <th className="text-left py-2 pr-4">Severity</th>
                  <th className="text-left py-2 pr-4">Score</th>
                  <th className="text-left py-2 pr-4">Possible Failure</th>
                  <th className="text-right py-2">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {dashboard?.topRisks?.map((r: any) => (
                  <tr key={r.id}
                    onClick={() => router.push(`/assets/${r.assetId}`)}
                    className="hover:bg-white/3 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 pr-4 font-mono text-primary text-xs">{r.asset?.assetCode ?? r.assetId}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs">{r.asset?.station?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4"><RiskBadge severity={r.severity} /></td>
                    <td className="py-2.5 pr-4 font-bold">{r.riskScore}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground text-xs truncate max-w-[200px]">{r.possibleFailure ?? "—"}</td>
                    <td className="py-2.5 text-right text-muted-foreground text-xs">{r.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
