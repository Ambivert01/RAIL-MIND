"use client";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { incidentsApi, agentsApi } from "@/lib/api-client";
import { formatDate, formatDateTime, formatRelative, cn } from "@/lib/utils";
import { ArrowLeft, Clock, Brain, Loader2, CheckCircle2, AlertTriangle, GitBranch } from "lucide-react";
import { useAgentStore } from "@/stores/agent.store";
import toast from "react-hot-toast";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/20 text-green-400 border-green-500/30",
};
const STAT_COLORS: Record<string, string> = {
  OPEN: "bg-red-500/20 text-red-400 border-red-500/30",
  INVESTIGATING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  RESOLVED: "bg-green-500/20 text-green-400 border-green-500/30",
  ARCHIVED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};
function Badge({ label, type }: { label: string; type?: "sev" | "stat" }) {
  const map = type === "sev" ? SEV_COLORS : STAT_COLORS;
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase", map[label] ?? "bg-white/10 text-muted-foreground border-border")}>{label}</span>;
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [similar, setSimilar] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "timeline" | "similar" | "recommendations">("overview");
  const { clearThoughts, setLastResponse } = useAgentStore();

  useEffect(() => {
    Promise.all([
      incidentsApi.getOne(id),
      incidentsApi.getTimeline(id),
    ]).then(([d, t]) => {
      setData(d.data);
      setTimeline(t.data?.events ?? []);
      if (d.data?.assetId) {
        incidentsApi.getSimilar(id, d.data.assetId).then((s) => setSimilar(s.data ?? [])).catch(() => {});
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleClose = async () => {
    try {
      await incidentsApi.close(id, { resolution: "Closed via dashboard" });
      toast.success("Incident closed successfully");
      const updated = await incidentsApi.getOne(id);
      setData(updated.data);
    } catch {
      toast.error("Failed to close incident");
    }
  };

  const handleInvestigate = async () => {
    if (!data) return;
    setInvestigating(true);
    clearThoughts();
    try {
      const q = `What caused ${data.incidentNumber} — ${data.title}? What actions should be taken?`;
      const res = await agentsApi.ask(q, data.assetId);
      setLastResponse(res.data);
      toast.success("Investigation complete");
      router.push("/agents");
    } catch { toast.error("Investigation failed"); }
    finally { setInvestigating(false); }
  };

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppLayout>;
  if (!data) return <AppLayout><div className="text-center py-16 text-muted-foreground">Incident not found</div></AppLayout>;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "timeline", label: `Timeline (${timeline.length})` },
    { id: "similar", label: `Similar (${similar.length})` },
    { id: "recommendations", label: `Actions (${data.recommendations?.length ?? 0})` },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in max-w-5xl">
        <div className="flex items-start gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground mt-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">{data.incidentNumber}</span>
              <Badge label={data.severity} type="sev" />
              <Badge label={data.status} type="stat" />
            </div>
            <h1 className="text-xl font-bold text-foreground mt-1">{data.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {data.asset?.assetCode && <span className="font-mono text-primary">{data.asset.assetCode}</span>}
              {data.asset?.station?.name && <span>{data.asset.station.name}</span>}
              <span>{formatDateTime(data.occurredAt)}</span>
              {data.resolvedAt && <span className="text-green-400">Resolved {formatRelative(data.resolvedAt)}</span>}
            </div>
          </div>
          <button onClick={handleInvestigate} disabled={investigating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
            {investigating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {investigating ? "Investigating..." : "Investigate with AI"}
          </button>
        </div>

        {/* Quick info */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Asset", value: data.asset?.assetCode ?? "—" },
            { label: "Duration", value: data.resolvedAt ? `${Math.round((new Date(data.resolvedAt).getTime() - new Date(data.occurredAt).getTime()) / 3600000)}h` : "Ongoing" },
            { label: "Timeline Events", value: timeline.length },
            { label: "Similar Incidents", value: similar.length },
          ].map((s) => (
            <div key={s.label} className="card-glass p-4 text-center">
              <div className="text-lg font-bold text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                className={cn("px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="card-glass p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Description</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{data.description}</p>
              </div>
              {data.rootCause && (
                <div className="card-glass p-5 border border-orange-500/20">
                  <h3 className="text-sm font-semibold text-orange-400 mb-2">Root Cause</h3>
                  <p className="text-sm text-foreground">{data.rootCause}</p>
                </div>
              )}
              {data.weatherCondition && (
                <div className="card-glass p-4">
                  <span className="text-xs text-muted-foreground">Weather Condition: </span>
                  <span className="text-xs text-foreground">{data.weatherCondition}</span>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {data.resolution && (
                <div className="card-glass p-5 border border-green-500/20">
                  <h3 className="text-sm font-semibold text-green-400 mb-2">Resolution</h3>
                  <p className="text-sm text-foreground">{data.resolution}</p>
                </div>
              )}
              {data.lessonsLearned && (
                <div className="card-glass p-5 border border-purple-500/20">
                  <h3 className="text-sm font-semibold text-purple-400 mb-2">Lessons Learned</h3>
                  <p className="text-sm text-foreground">{data.lessonsLearned}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="relative pl-6 space-y-0">
            <div className="absolute left-2 top-0 bottom-0 w-px bg-border/50" />
            {timeline.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No timeline events</div>
            ) : (
              timeline.map((event: any, i: number) => (
                <div key={event.id ?? i} className="relative flex gap-4 pb-6">
                  <div className="absolute -left-4 mt-1">
                    <div className={cn("w-3 h-3 rounded-full border-2 border-background",
                      event.eventType?.includes("RESOLVED") ? "bg-green-400" :
                      event.eventType?.includes("CREATED") ? "bg-blue-400" : "bg-muted-foreground")} />
                  </div>
                  <div className="flex-1 card-glass p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-foreground">{event.eventType?.replace(/_/g, " ")}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    {event.agentName && <span className="text-xs text-primary mt-1 block">{event.agentName} Agent</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "similar" && (
          <div className="space-y-3">
            {similar.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No similar incidents found</div>
            ) : (
              similar.map((inc: any) => (
                <div key={inc.id} onClick={() => router.push(`/incidents/${inc.id}`)}
                  className="card-glass p-4 cursor-pointer hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{inc.incidentNumber}</span>
                    <Badge label={inc.severity} type="sev" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{inc.title}</p>
                  {inc.rootCause && <p className="text-xs text-muted-foreground mt-1">Root: {inc.rootCause}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(inc.occurredAt)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="space-y-3">
            {(data.recommendations?.length ?? 0) === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-3">No recommendations yet</p>
                <button onClick={handleInvestigate} disabled={investigating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm mx-auto hover:bg-primary/20 transition-colors">
                  <Brain className="w-4 h-4" />Generate with AI
                </button>
              </div>
            ) : (
              data.recommendations.map((rec: any) => (
                <div key={rec.id} className="card-glass p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge label={rec.priority} type="sev" />
                    <span className="text-xs text-muted-foreground">{rec.confidence}% confidence</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{rec.action}</p>
                  <p className="text-xs text-muted-foreground mt-1">{rec.reason}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {showCloseConfirm && (
        <ConfirmDialog
          title="Close Incident"
          message="Mark this incident as resolved? This will trigger the Learning Agent to capture knowledge from this incident."
          confirmLabel="Close Incident"
          variant="warning"
          onConfirm={async () => { setShowCloseConfirm(false); await handleClose(); }}
          onCancel={() => setShowCloseConfirm(false)}
        />
      )}
    </AppLayout>
  );
}
