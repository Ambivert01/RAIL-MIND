"use client";
import type { AskRailMindResponse } from "@railmind/shared-types";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { analyticsApi, incidentsApi, recommendationsApi, riskApi } from "@/lib/api-client";
import { getRiskColor, getStatusColor, formatRelative, cn } from "@/lib/utils";
import { AlertTriangle, ShieldAlert, Brain, Lightbulb, TrendingUp, Activity, Cpu, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function StatCard({ label, value, sub, color, icon: Icon }: any) {
  return (
    <div className="card-glass p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={cn("text-2xl font-bold mt-1", color ?? "text-foreground")}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("p-2 rounded-lg", color ? `${color.replace("text", "bg")}/10` : "bg-white/5")}>
            <Icon className={cn("w-5 h-5", color ?? "text-muted-foreground")} />
          </div>
        )}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const c = getRiskColor(severity === "MEDIUM" ? "MODERATE" : severity);
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.bg, c.text, c.border)}>
      {severity}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<any>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [topRisks, setTopRisks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.getDashboard(),
      incidentsApi.getAll({ status: "OPEN", limit: 5 }),
      recommendationsApi.getAll({ status: "PENDING", priority: "CRITICAL" }),
      riskApi.getDashboard(),
    ]).then(([a, i, r, risk]) => {
      setAnalytics(a.data);
      setIncidents(i.data ?? []);
      setRecommendations(r.data ?? []);
      setTopRisks(risk.data?.criticalAssets?.slice(0, 5) ?? []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <AppLayout>
      <PageSkeleton />
    </AppLayout>
  );

  const health = analytics?.networkHealth ?? 0;
  const healthColor = health >= 80 ? "text-green-400" : health >= 60 ? "text-yellow-400" : "text-red-400";

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Operations Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Northern Corridor Railway Network (NCRN)</p>
          </div>
          <Link href="/twin" className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
            <Activity className="w-4 h-4" />
            Open Digital Twin
          </Link>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Network Health" value={`${health}%`} sub={`${analytics?.healthyAssets ?? 0} assets healthy`} color={healthColor} icon={Activity} />
          <StatCard label="Open Incidents" value={analytics?.openIncidents ?? 0} sub={`${analytics?.totalIncidents ?? 0} total`} color={analytics?.openIncidents > 0 ? "text-red-400" : "text-green-400"} icon={AlertTriangle} />
          <StatCard label="Critical Risks" value={analytics?.criticalAssets ?? 0} sub="Require immediate action" color="text-orange-400" icon={ShieldAlert} />
          <StatCard label="Lessons Learned" value={analytics?.lessonsLearned ?? 0} sub={`${analytics?.agentInvestigations ?? 0} AI investigations`} color="text-purple-400" icon={Brain} />
        </div>

        {/* Critical alerts */}
        {topRisks.length > 0 && (
          <div className="card-glass p-5 border border-red-500/20 bg-red-500/5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <h2 className="text-sm font-semibold text-red-400">Critical Risk Alerts</h2>
            </div>
            <div className="space-y-2">
              {topRisks.map((r: any) => (
                <div key={r.assetId} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-foreground">{r.asset?.assetCode ?? r.assetId}</span>
                    <span className="text-xs text-muted-foreground ml-2">{r.asset?.station?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">{r.riskScore}/100</div>
                      <div className="text-xs text-muted-foreground">risk score</div>
                    </div>
                    <button
                      onClick={() => router.push(`/assets/${r.assetId}`)}
                      className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      Investigate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Open incidents */}
          <div className="card-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Active Incidents</h2>
              </div>
              <Link href="/incidents" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {incidents.length === 0 ? (
              <div className="flex items-center gap-2 py-6 justify-center text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-sm">No open incidents</span>
              </div>
            ) : (
              <div className="space-y-2">
                {incidents.slice(0, 5).map((inc: any) => (
                  <div
                    key={inc.id}
                    onClick={() => router.push(`/incidents/${inc.id}`)}
                    className="flex items-start justify-between py-2.5 px-3 rounded-lg bg-white/3 hover:bg-white/6 cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">{inc.incidentNumber}</span>
                        <SeverityBadge severity={inc.severity} />
                      </div>
                      <p className="text-sm text-foreground mt-0.5 truncate">{inc.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{inc.asset?.assetCode} · {formatRelative(inc.occurredAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pending recommendations */}
          <div className="card-glass p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Pending Recommendations</h2>
              </div>
              <Link href="/recommendations" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending recommendations</p>
            ) : (
              <div className="space-y-2">
                {recommendations.slice(0, 4).map((rec: any) => (
                  <div key={rec.id} onClick={() => router.push("/recommendations")}
                    className="p-3 rounded-lg bg-white/3 hover:bg-white/6 cursor-pointer transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <SeverityBadge severity={rec.priority} />
                      <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                    </div>
                    <p className="text-sm text-foreground">{rec.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{rec.asset?.assetCode}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
