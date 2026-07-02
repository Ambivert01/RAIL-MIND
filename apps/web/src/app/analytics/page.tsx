"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { analyticsApi } from "@/lib/api-client";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, Brain, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getDashboard().then((r) => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Operational intelligence metrics and trends</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Network Health", value: `${data?.networkHealth ?? 0}%`, icon: TrendingUp, color: "text-green-400" },
            { label: "Lessons Learned", value: data?.lessonsLearned ?? 0, icon: Brain, color: "text-purple-400" },
            { label: "AI Investigations", value: data?.agentInvestigations ?? 0, icon: Brain, color: "text-primary" },
            { label: "Resolved Incidents", value: data?.resolvedIncidents ?? 0, icon: CheckCircle2, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="card-glass p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={cn("w-4 h-4", s.color)} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card-glass p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Knowledge Growth (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={data?.knowledgeGrowth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 14%)" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(224 71% 6%)", border: "1px solid hsl(215 25% 14%)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px" }} />
                <Line type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={2} dot={false} name="Incidents" />
                <Line type="monotone" dataKey="lessons" stroke="#a855f7" strokeWidth={2} dot={false} name="Lessons" />
                <Line type="monotone" dataKey="relationships" stroke="#3b82f6" strokeWidth={2} dot={false} name="Graph Rels" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card-glass p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Asset Status Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[
                { name: "Healthy", value: data?.healthyAssets ?? 0, fill: "#22c55e" },
                { name: "Warning", value: data?.warningAssets ?? 0, fill: "#eab308" },
                { name: "Critical", value: data?.criticalAssets ?? 0, fill: "#ef4444" },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 14%)" />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "hsl(224 71% 6%)", border: "1px solid hsl(215 25% 14%)", borderRadius: "6px", color: "#e2e8f0", fontSize: "12px" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[{ fill: "#22c55e" }, { fill: "#eab308" }, { fill: "#ef4444" }].map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
