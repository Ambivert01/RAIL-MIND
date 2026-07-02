"use client";
import type { AskRailMindResponse } from "@railmind/shared-types";
import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { agentsApi } from "@/lib/api-client";
import { useAgentStore } from "@/stores/agent.store";
import { AGENT_COLORS, formatRelative, cn } from "@/lib/utils";
import { Bot, Brain, Send, Loader2, CheckCircle2, AlertCircle, Zap, Clock } from "lucide-react";
import toast from "react-hot-toast";

const AGENT_META: Record<string, { icon: string; desc: string }> = {
  EXECUTIVE:  { icon: "🎯", desc: "Orchestrates all agents" },
  INCIDENT:   { icon: "🔍", desc: "Investigates historical incidents" },
  KNOWLEDGE:  { icon: "📚", desc: "Retrieves organizational memory" },
  RISK:       { icon: "⚠️", desc: "Calculates risk scores" },
  ENGINEER:   { icon: "🔧", desc: "Recommends technical actions" },
  PLANNER:    { icon: "📋", desc: "Plans maintenance schedules" },
};

export default function AgentsPage() {
  const [question, setQuestion] = useState("");
  const [assetId, setAssetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskRailMindResponse | null>(null);
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  const { thoughts, workflowStatus, currentQuestion, lastResponse, clearThoughts } = useAgentStore();

  useEffect(() => {
    if (lastResponse && !response) setResponse(lastResponse);
  }, [lastResponse]);

  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thoughts]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    clearThoughts();
    setResponse(null);
    try {
      const res = await agentsApi.ask(question, assetId || undefined);
      setResponse(res.data);
    } catch (err) {
      toast.error("Agent investigation failed");
    } finally {
      setLoading(false);
    }
  };

  const presetQuestions = [
    { q: "Why is Signal S11 unstable?", asset: "sig011" },
    { q: "What caused INC-044?", asset: "" },
    { q: "Which assets need immediate maintenance?", asset: "" },
    { q: "Have we seen relay failures during heavy rainfall?", asset: "" },
  ];

  return (
    <AppLayout>
      <div className="space-y-5 animate-fade-in max-w-6xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Agent Console</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI agent coordination and reasoning visualization</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Ask panel + agents status */}
          <div className="space-y-4">
            {/* Ask form */}
            <div className="card-glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Ask RailMind</h2>
              </div>
              <form onSubmit={handleAsk} className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Why is Signal S11 unstable?"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none"
                />
                <input
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="Asset ID (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                />
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {loading ? "Investigating..." : "Investigate"}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Demo Questions</p>
                <div className="space-y-1">
                  {presetQuestions.map((p, i) => (
                    <button key={i}
                      onClick={() => { setQuestion(p.q); setAssetId(p.asset); }}
                      className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                    >
                      {p.q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Agent status cards */}
            <div className="card-glass p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Agents</h3>
              <div className="space-y-2">
                {Object.entries(AGENT_META).map(([name, meta]) => {
                  const agentThoughts = thoughts.filter((t) => t.agentName === name);
                  const lastThought = agentThoughts[agentThoughts.length - 1];
                  const isActive = workflowStatus === "running" && agentThoughts.length > 0;
                  const isDone = lastThought?.isComplete;
                  return (
                    <div key={name} className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-lg transition-colors",
                      isActive && !isDone ? "bg-primary/10 border border-primary/20" : "bg-white/3"
                    )}>
                      <span className="text-base mt-0.5">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold" style={{ color: AGENT_COLORS[name] ?? "#fff" }}>
                            {name}
                          </span>
                          {isActive && !isDone && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          {isDone && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {lastThought?.step ?? meta.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Thought stream + response */}
          <div className="lg:col-span-2 space-y-4">
            {/* Thought stream */}
            <div className="card-glass p-4" style={{ minHeight: "300px" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Reasoning Stream</h2>
                  {workflowStatus === "running" && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      Live
                    </span>
                  )}
                </div>
                {thoughts.length > 0 && (
                  <button onClick={clearThoughts} className="text-xs text-muted-foreground hover:text-foreground">
                    Clear
                  </button>
                )}
              </div>

              {thoughts.length === 0 && workflowStatus === "idle" ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
                  <Bot className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Ask a question to see agents reason in real-time</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin pr-1">
                  {thoughts.map((t, i) => (
                    <div key={i} className={cn(
                      "flex items-start gap-3 py-2 px-3 rounded-lg text-xs transition-all",
                      t.isComplete ? "bg-green-500/5 border border-green-500/10" : "bg-white/3"
                    )}>
                      <span className="font-mono font-bold shrink-0 mt-0.5" style={{ color: AGENT_COLORS[t.agentName] ?? "#fff", minWidth: "70px" }}>
                        {t.agentName}
                      </span>
                      <div>
                        <span className="font-semibold text-foreground">{t.step}</span>
                        <span className="text-muted-foreground ml-2">{t.detail}</span>
                      </div>
                      {t.isComplete && <CheckCircle2 className="w-3 h-3 text-green-400 ml-auto mt-0.5 shrink-0" />}
                    </div>
                  ))}
                  <div ref={thoughtsEndRef} />
                </div>
              )}
            </div>

            {/* Final response */}
            {response && (
              <div className="card-glass p-5 border border-primary/20 animate-slide-up">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">RailMind Response</h2>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {response.processingTimeMs}ms
                  </span>
                </div>

                {/* Answer */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/15 mb-4">
                  <p className="text-sm text-foreground leading-relaxed">{response.answer}</p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-lg bg-white/3">
                    <div className={cn("text-xl font-bold", response.riskScore >= 80 ? "text-red-400" : response.riskScore >= 60 ? "text-orange-400" : "text-green-400")}>
                      {response.riskScore ?? "—"}/100
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">Risk Score</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/3">
                    <div className="text-xl font-bold text-primary">{response.confidence}%</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Confidence</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-white/3">
                    <div className="text-xl font-bold text-foreground">{response.evidence?.length ?? 0}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Evidence Items</div>
                  </div>
                </div>

                {/* Evidence */}
                {response.evidence?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Evidence</p>
                    {response.evidence.map((e: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3">
                        <span className="text-xs font-mono text-primary font-bold w-16 shrink-0">{e.type}</span>
                        <span className="text-xs text-foreground flex-1">{e.title}</span>
                        <span className="text-xs text-muted-foreground">{e.relevance}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {response.recommendations?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recommended Actions</p>
                    {response.recommendations.map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
