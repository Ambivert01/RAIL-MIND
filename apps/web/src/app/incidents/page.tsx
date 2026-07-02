"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { incidentsApi } from "@/lib/api-client";
import { getSeverityColor, formatDate, formatRelative, cn } from "@/lib/utils";
import { AlertTriangle, Filter, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";

const SEVERITY_OPTIONS = ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"];
const STATUS_OPTIONS = ["", "OPEN", "INVESTIGATING", "RESOLVED", "ARCHIVED"];

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

function Badge({ label, type }: { label: string; type?: "severity" | "status" }) {
  const map = type === "severity" ? SEV_COLORS : STAT_COLORS;
  const cls = map[label] ?? "bg-white/10 text-muted-foreground border-border";
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase", cls)}>{label}</span>;
}

export default function IncidentsPage() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<Array<{ id: string; incidentNumber: string; title: string; severity: string; status: string; occurredAt: string; asset: any }>>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      incidentsApi.getAll({ severity: severity || undefined, status: status || undefined }),
      incidentsApi.getStats(),
    ]).then(([inc, s]) => {
      setIncidents(inc.data ?? []);
      setStats(s.data);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [severity, status]);

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Incident Explorer</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Historical and active operational incidents</p>
          </div>
          <button
            onClick={() => router.push("/incidents/new")}
            className="px-4 py-2 rounded-lg bg-primary/15 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            + New Incident
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Open", value: stats.open, color: "text-red-400" },
              { label: "Investigating", value: stats.investigating, color: "text-blue-400" },
              { label: "Resolved", value: stats.resolved, color: "text-green-400" },
              { label: "Critical", value: stats.critical, color: "text-orange-400" },
            ].map((s) => (
              <div key={s.label} className="card-glass p-4 text-center">
                <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
          >
            <option value="">All Severities</option>
            {SEVERITY_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-foreground focus:outline-none focus:border-primary/50"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-xs text-muted-foreground ml-auto">{incidents.length} incidents</span>
        </div>

        {/* Incident list */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /><span>Loading incidents...</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <CheckCircle2 className="w-10 h-10 text-green-400/50" />
            <p>No incidents match current filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc: any) => (
              <div
                key={inc.id}
                onClick={() => router.push(`/incidents/${inc.id}`)}
                className="card-glass p-4 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-4"
              >
                <div className="flex-shrink-0">
                  <AlertTriangle className={cn("w-5 h-5",
                    inc.severity === "CRITICAL" ? "text-red-400" :
                    inc.severity === "HIGH" ? "text-orange-400" :
                    inc.severity === "MEDIUM" ? "text-yellow-400" : "text-green-400"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{inc.incidentNumber}</span>
                    <Badge label={inc.severity} type="severity" />
                    <Badge label={inc.status} type="status" />
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">{inc.title}</p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {inc.asset?.assetCode && <span className="text-xs font-mono text-primary">{inc.asset.assetCode}</span>}
                    {inc.asset?.station?.name && <span className="text-xs text-muted-foreground">{inc.asset.station.name}</span>}
                    {inc.rootCause && <span className="text-xs text-muted-foreground">Root: {inc.rootCause}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">{formatRelative(inc.occurredAt)}</p>
                  {inc.resolvedAt && <p className="text-xs text-green-400">{formatDate(inc.resolvedAt)}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
