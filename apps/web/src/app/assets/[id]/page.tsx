"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { assetsApi, agentsApi } from "@/lib/api-client";
import { getRiskColor, getSeverityColor, formatDate, formatRelative, cn } from "@/lib/utils";
import {
  ArrowLeft, AlertTriangle, Wrench, Lightbulb, GitBranch,
  Loader2, Brain, ChevronRight, CheckCircle2, Clock, Zap
} from "lucide-react";
import { useAgentStore } from "@/stores/agent.store";
import toast from "react-hot-toast";

function Badge({ label, variant = "default" }: { label: string; variant?: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
    HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    MODERATE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOW: "bg-green-500/20 text-green-400 border-green-500/30",
    RESOLVED: "bg-green-500/20 text-green-400 border-green-500/30",
    OPEN: "bg-red-500/20 text-red-400 border-red-500/30",
    INVESTIGATING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    HEALTHY: "bg-green-500/20 text-green-400 border-green-500/30",
    WARNING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    default: "bg-white/10 text-muted-foreground border-border",
  };
  return (
    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider", map[label] ?? map.default)}>
      {label}
    </span>
  );
}

export default function AssetProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "incidents" | "maintenance" | "recommendations" | "graph">("overview");
  const { clearThoughts, setLastResponse } = useAgentStore();

  useEffect(() => {
    assetsApi.getProfile(id).then((r) => { setProfile(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, [id]);

  const handleAskRailMind = async () => {
    if (!profile) return;
    setAsking(true);
    clearThoughts();
    try {
      const question = `Why is ${profile.asset.assetCode} unstable? What should be done?`;
      toast.loading("RailMind is investigating...", { id: "ask" });
      const res = await agentsApi.ask(question, id);
      setLastResponse(res.data);
      toast.success("Investigation complete", { id: "ask" });
      router.push("/agents");
    } catch (e) {
      toast.error("Investigation failed — check API connection", { id: "ask" });
    } finally {
      setAsking(false);
    }
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  if (!profile) return (
    <AppLayout>
      <div className="text-center py-16 text-muted-foreground">Asset not found</div>
    </AppLayout>
  );

  const { asset, riskSummary, incidentHistory, maintenanceHistory, activeRecommendations, stats, activeAlerts } = profile;
  const riskColor = riskSummary ? getRiskColor(riskSummary.severity) : null;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "incidents", label: `Incidents (${incidentHistory?.length ?? 0})` },
    { id: "maintenance", label: `Maintenance (${maintenanceHistory?.length ?? 0})` },
    { id: "recommendations", label: `Actions (${activeRecommendations?.length ?? 0})` },
    { id: "graph", label: "Graph" },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in max-w-6xl">
        {/* Header */}
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground mt-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{asset.assetCode}</h1>
              <Badge label={asset.status} />
              <Badge label={asset.assetType} />
              {riskSummary && <Badge label={riskSummary.severity} />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{asset.name}</p>
            <p className="text-xs text-muted-foreground">{asset.station?.name} · {asset.station?.stationCode}</p>
          </div>
          <button
            onClick={handleAskRailMind}
            disabled={asking}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
          >
            {asking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {asking ? "Investigating..." : "Ask RailMind"}
          </button>
        </div>

        {/* Risk banner for critical assets */}
        {riskSummary && riskSummary.riskScore >= 61 && (
          <div className={cn("p-4 rounded-lg border flex items-start gap-3", riskColor?.bg, `border-${riskColor?.text.split("-")[1]}-500/30`)}>
            <Zap className={cn("w-5 h-5 mt-0.5 flex-shrink-0", riskColor?.text)} />
            <div>
              <div className={cn("text-sm font-semibold", riskColor?.text)}>
                Risk Score {riskSummary.riskScore}/100 — {riskSummary.severity}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {riskSummary.possibleFailure} · Confidence: {riskSummary.confidence}%
              </div>
              {riskSummary.topRiskFactors?.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  Risk factors: {riskSummary.topRiskFactors.join(" · ")}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Health Score", value: `${asset.healthScore}%`, color: asset.healthScore >= 70 ? "text-green-400" : asset.healthScore >= 40 ? "text-yellow-400" : "text-red-400" },
            { label: "Total Incidents", value: stats?.totalIncidents ?? 0, color: "text-foreground" },
            { label: "Days Since Maint.", value: stats?.daysSinceLastMaintenance ?? "N/A", color: (stats?.daysSinceLastMaintenance ?? 0) > 180 ? "text-orange-400" : "text-foreground" },
            { label: "Active Alerts", value: activeAlerts?.length ?? 0, color: (activeAlerts?.length ?? 0) > 0 ? "text-red-400" : "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="card-glass p-4 text-center">
              <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Active alerts */}
        {activeAlerts?.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map((alert: any) => (
              <div key={alert.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span className="text-sm text-foreground">{alert.message}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatRelative(alert.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
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

        {/* Tab content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="card-glass p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Asset Information</h3>
              {[
                { label: "Asset Code", value: asset.assetCode },
                { label: "Type", value: asset.assetType },
                { label: "Station", value: `${asset.station?.name} (${asset.station?.stationCode})` },
                { label: "Installation Date", value: asset.installationDate ? formatDate(asset.installationDate) : "N/A" },
                { label: "Last Maintenance", value: asset.lastMaintenanceAt ? formatDate(asset.lastMaintenanceAt) : "Never" },
                { label: "Description", value: asset.description ?? "No description" },
              ].map((f) => (
                <div key={f.label} className="flex justify-between py-2 border-b border-border/30 last:border-0">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="text-xs text-foreground text-right max-w-[60%]">{f.value}</span>
                </div>
              ))}
            </div>

            {/* Top recommendations preview */}
            <div className="card-glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Active Recommendations</h3>
              </div>
              {activeRecommendations?.length === 0 ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm">No pending actions</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeRecommendations?.slice(0, 3).map((rec: any) => (
                    <div key={rec.id} className="p-3 rounded-lg bg-white/3 border border-border/30">
                      <div className="flex items-center justify-between mb-1">
                        <Badge label={rec.priority} />
                        <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                      </div>
                      <p className="text-sm text-foreground">{rec.action}</p>
                      {rec.estimatedResolutionTime && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{rec.estimatedResolutionTime}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="space-y-3">
            {incidentHistory?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No incident history</div>
            ) : (
              incidentHistory?.map((inc: any) => (
                <div key={inc.id}
                  onClick={() => router.push(`/incidents/${inc.id}`)}
                  className="card-glass p-4 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{inc.incidentNumber}</span>
                      <Badge label={inc.severity} />
                      <Badge label={inc.status} />
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span>{formatDate(inc.occurredAt)}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground">{inc.title}</p>
                  {inc.rootCause && (
                    <p className="text-xs text-muted-foreground mt-1">Root cause: {inc.rootCause}</p>
                  )}
                  {inc.resolution && (
                    <p className="text-xs text-green-400 mt-0.5">Resolution: {inc.resolution}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-3">
            {maintenanceHistory?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No maintenance records</div>
            ) : (
              maintenanceHistory?.map((m: any) => (
                <div key={m.id} className="card-glass p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-foreground">{m.maintenanceType.replace(/_/g, " ")}</span>
                      <Badge label={m.outcome} />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(m.performedAt)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{m.description}</p>
                  {m.findings && <p className="text-xs text-foreground mt-1">{m.findings}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="space-y-3">
            {activeRecommendations?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No active recommendations</div>
            ) : (
              activeRecommendations?.map((rec: any) => (
                <div key={rec.id} className="card-glass p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge label={rec.priority} />
                    <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{rec.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                  {(rec.evidence as any[])?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(rec.evidence as any[]).slice(0, 4).map((e: any, i: number) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                          {e.title}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "graph" && <AssetGraphTab assetId={id} assetCode={asset.assetCode} />}
      </div>
    </AppLayout>
  );
}

function AssetGraphTab({ assetId, assetCode }: { assetId: string; assetCode: string }) {
  const router = useRouter();
  return (
    <div className="card-glass p-8 text-center space-y-4">
      <GitBranch className="w-12 h-12 text-primary/50 mx-auto" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Knowledge Graph</h3>
        <p className="text-sm text-muted-foreground mt-1">
          View all relationships for {assetCode} — incidents, causes, resolutions, and lessons learned.
        </p>
      </div>
      <button
        onClick={() => router.push(`/graph?assetId=${assetId}&assetCode=${assetCode}`)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors mx-auto"
      >
        <GitBranch className="w-4 h-4" />
        Open in Graph Explorer
      </button>
    </div>
  );
}
