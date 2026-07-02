"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { graphApi } from "@/lib/api-client";
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { cn, AGENT_COLORS } from "@/lib/utils";
import { GitBranch, Search, Loader2, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const NODE_COLORS: Record<string, string> = {
  Signal: "#3b82f6", Station: "#22c55e", Incident: "#ef4444",
  Track: "#8b5cf6", Switch: "#f97316", RootCause: "#eab308",
  Resolution: "#06b6d4", LessonLearned: "#a855f7", Engineer: "#84cc16",
  WeatherEvent: "#64748b", Asset: "#94a3b8", Default: "#6b7280",
};

function nodeStyle(type: string) {
  const color = NODE_COLORS[type] ?? NODE_COLORS.Default;
  return {
    background: `${color}22`,
    border: `1.5px solid ${color}`,
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#e2e8f0",
    fontSize: "11px",
    fontFamily: "Inter, sans-serif",
    minWidth: "80px",
    maxWidth: "140px",
    textAlign: "center" as const,
  };
}

function buildFlowData(graphData: { nodes: any[]; relationships: any[] }) {
  const nodeMap = new Map<string, any>();
  graphData.nodes.forEach((n, i) => {
    nodeMap.set(n.id, {
      id: n.id,
      data: { label: n.label?.slice(0, 45) ?? n.id, type: n.type, properties: n.properties },
      position: (() => {
        // WF3-04 fix: stable position based on node ID hash — no random jitter on reload
        let h = 0;
        for (const ch of n.id) h = (h * 31 + ch.charCodeAt(0)) & 0xffff;
        return { x: (h % 7) * 170 + (i % 5) * 30, y: Math.floor(h / 7) * 110 + Math.floor(i / 5) * 25 };
      })(),
      style: nodeStyle(n.type),
    });
  });

  const edges = graphData.relationships.map((r, i) => ({
    id: r.id ?? `e${i}`,
    source: String(r.source),
    target: String(r.target),
    label: r.label,
    style: { stroke: "#334155", strokeWidth: 1.5 },
    labelStyle: { fill: "#64748b", fontSize: "9px" },
    labelBgStyle: { fill: "transparent" },
  }));

  return { nodes: Array.from(nodeMap.values()), edges };
}

function GraphContent() {
  const searchParams = useSearchParams();
  const assetId = searchParams.get("assetId");
  const assetCode = searchParams.get("assetCode");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ nodes: number; relationships: number } | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async (id?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = id
        ? await graphApi.getAssetGraph(id)
        : await graphApi.getNeighbours("sig011", "Signal", 3);
      const { nodes: fn, edges: fe } = buildFlowData(res.data);
      setNodes(fn);
      setEdges(fe);
    } catch (e: any) {
      setError("Graph unavailable — Neo4j may not be running. Showing placeholder.");
      loadPlaceholder();
    } finally { setLoading(false); }
  }, []);

  const loadPlaceholder = () => {
    const placeholder = {
      nodes: [
        { id: "sig011", type: "Signal", label: "Signal S11", properties: {} },
        { id: "inc044", type: "Incident", label: "INC-044", properties: {} },
        { id: "inc057", type: "Incident", label: "INC-057", properties: {} },
        { id: "inc081", type: "Incident", label: "INC-081", properties: {} },
        { id: "cause1", type: "RootCause", label: "Relay Corrosion", properties: {} },
        { id: "cause2", type: "RootCause", label: "Water Ingress", properties: {} },
        { id: "res1", type: "Resolution", label: "Relay Replacement", properties: {} },
        { id: "st002", type: "Station", label: "Rivergate", properties: {} },
        { id: "weather1", type: "WeatherEvent", label: "Heavy Rainfall", properties: {} },
      ],
      relationships: [
        { id: "r1", source: "sig011", target: "inc044", type: "FAILED_IN", label: "FAILED IN" },
        { id: "r2", source: "sig011", target: "inc057", type: "FAILED_IN", label: "FAILED IN" },
        { id: "r3", source: "sig011", target: "inc081", type: "FAILED_IN", label: "FAILED IN" },
        { id: "r4", source: "inc044", target: "cause1", type: "HAS_CAUSE", label: "HAS CAUSE" },
        { id: "r5", source: "inc057", target: "cause2", type: "HAS_CAUSE", label: "HAS CAUSE" },
        { id: "r6", source: "inc044", target: "res1", type: "RESOLVED_BY", label: "RESOLVED BY" },
        { id: "r7", source: "sig011", target: "st002", type: "PART_OF", label: "PART OF" },
        { id: "r8", source: "inc057", target: "weather1", type: "OCCURRED_DURING", label: "DURING" },
        { id: "r9", source: "inc044", target: "inc057", type: "SIMILAR_TO", label: "SIMILAR TO" },
      ],
    };
    const { nodes: fn, edges: fe } = buildFlowData(placeholder);
    setNodes(fn);
    setEdges(fe);
  };

  useEffect(() => {
    loadGraph(assetId ?? undefined);
    graphApi.getStats().then((r) => setStats(r.data)).catch(() => {});
  }, [assetId]);

  const handleSearch = async () => {
    if (!searchQ.trim()) return;
    setLoading(true);
    try {
      const res = await graphApi.search(searchQ);
      if (res.data.length > 0) {
        await loadGraph(res.data[0].id);
      }
    } catch { loadPlaceholder(); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in" style={{ height: "calc(100vh - 120px)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Knowledge Graph</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {assetCode ? `Graph for ${assetCode}` : "Railway relationship network"}
              {stats && ` · ${stats.nodes} nodes · ${stats.relationships} relationships`}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="flex gap-1">
              <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search nodes..."
                className="px-3 py-2 text-sm rounded-lg bg-white/5 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 w-48" />
              <button onClick={handleSearch} className="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/20 transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => loadGraph(assetId ?? undefined)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-border text-muted-foreground hover:text-foreground text-sm transition-colors">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs">
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-4" style={{ height: "calc(100% - 80px)" }}>
          {/* Graph canvas */}
          <div className="flex-1 card-glass overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading graph...</span>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedNode(node)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={2}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
                <Controls showInteractive={false} />
                <MiniMap
                  nodeColor={(n) => NODE_COLORS[n.data?.type] ?? "#6b7280"}
                  style={{ background: "hsl(224 71% 4%)", border: "1px solid hsl(215 25% 14%)" }}
                />
              </ReactFlow>
            )}
          </div>

          {/* Node detail panel */}
          <div className="w-64 space-y-3">
            <div className="card-glass p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Node Types</h3>
              <div className="space-y-1.5">
                {Object.entries(NODE_COLORS).filter(([k]) => k !== "Default").map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                    <span className="text-xs text-muted-foreground">{type}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedNode && (
              <div className="card-glass p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Selected Node</h3>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-foreground">{selectedNode.data?.label}</div>
                  <div className="text-xs text-muted-foreground">{selectedNode.data?.type}</div>
                  {Object.entries(selectedNode.data?.properties ?? {}).slice(0, 5).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="text-foreground truncate max-w-[60%]">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card-glass p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Load</h3>
              <div className="space-y-1">
                {["Signal S11", "Rivergate Station", "INC-044"].map((label) => (
                  <button key={label}
                    onClick={() => { setSearchQ(label); handleSearch(); }}
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-white/5 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={<AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppLayout>}>
      <GraphContent />
    </Suspense>
  );
}
