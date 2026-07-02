"use client";
import { PageSkeleton } from "@/components/common/skeleton";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { memoryApi } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { Brain, Search, Loader2, AlertTriangle, FileText, BookOpen, Wrench, Lightbulb } from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  INCIDENT: AlertTriangle, LESSON_LEARNED: BookOpen,
  SOP: FileText, MANUAL: FileText, MAINTENANCE: Wrench,
  RECOMMENDATION: Lightbulb,
};


const TYPE_COLORS: Record<string, string> = {
  INCIDENT: "text-red-400 bg-red-500/10 border-red-500/20",
  LESSON_LEARNED: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  SOP: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  MANUAL: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  MAINTENANCE: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  RECOMMENDATION: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
};

const PRESET_QUERIES = [
  "Signal failures during heavy rainfall",
  "Relay corrosion prevention",
  "Water ingress signal housing",
  "Have we seen this failure before?",
  "Connector degradation in humid environments",
  "Post-monsoon inspection procedures",
];

export default function MemoryPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    memoryApi.getLessons().then((r) => setLessons(r.data ?? [])).catch(() => {});
  }, []);

  const handleSearch = async (q?: string) => {
    const searchQuery = q ?? query;
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(false);
    try {
      const res = await memoryApi.search(searchQuery, { limit: 10 });
      setResults(res.data.items ?? []);
      setSearched(true);
    } catch { setResults([]); setSearched(true); }
    finally { setLoading(false); }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in max-w-5xl">
        <div>
          <h1 className="text-xl font-bold text-foreground">Railway Memory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Search organizational knowledge — incidents, lessons, procedures, and more</p>
        </div>

        {/* Search box */}
        <div className="card-glass p-6">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Search Organizational Memory</h2>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Have we seen signal failures during heavy rainfall?"
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-white/5 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 text-sm"
              />
            </div>
            <button type="submit" disabled={loading || !query.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {PRESET_QUERIES.map((q) => (
              <button key={q}
                onClick={() => { setQuery(q); handleSearch(q); }}
                className="text-xs px-3 py-1.5 rounded-full bg-white/5 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Searching organizational memory...</span>
          </div>
        )}

        {searched && !loading && results.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">No results found for "{query}"</div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{results.length} results for</span>
              <span className="text-sm font-medium text-foreground">"{query}"</span>
            </div>
            {results.map((item: any, i: number) => {
              const color = TYPE_COLORS[item.type] ?? "text-muted-foreground bg-white/5 border-border";
              return (
                <div key={item.id ?? i} className="card-glass p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-bold shrink-0", color)}>
                      <span>{item.type.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className="text-xs text-muted-foreground">{item.relevanceScore}% match</span>
                          <div className="w-12 h-1.5 rounded-full bg-white/10">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${item.relevanceScore}%` }} />
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.summary}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {item.assetCode && <span className="text-xs text-primary font-mono">{item.assetCode}</span>}
                        {item.stationName && <span className="text-xs text-muted-foreground">{item.stationName}</span>}
                        {item.date && <span className="text-xs text-muted-foreground">{formatDate(item.date)}</span>}
                        {item.tags?.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Lessons library */}
        {!searched && lessons.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Organizational Lessons Learned ({lessons.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lessons.slice(0, 6).map((l: any) => (
                <div key={l.id} className="card-glass p-4">
                  <div className="flex items-start gap-2">
                    <BookOpen className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-medium text-foreground">{l.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{l.content}</p>
                      {l.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {l.tags.slice(0, 3).map((t: string) => (
                            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
