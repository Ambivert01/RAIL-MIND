"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, ChevronDown, Zap } from "lucide-react";
import { searchApi, notificationsApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function Topbar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationsApi.getUnreadCount().then((r) => setUnreadCount(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await searchApi.search(query);
        setResults(r.data.results ?? []);
        setShowResults(true);
      } catch { }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const typeColors: Record<string, string> = {
    ASSET: "text-blue-400", INCIDENT: "text-red-400",
    STATION: "text-green-400", LESSON: "text-purple-400",
  };

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center gap-4 px-6"
      style={{
        left: "var(--sidebar-width)",
        height: "var(--topbar-height)",
        background: "hsl(224 71% 4% / 0.9)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid hsl(215 25% 10%)",
      }}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          placeholder="Search incidents, assets, signals, stations..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-border/50 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-white/8 transition-all"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50">
            {results.slice(0, 6).map((r) => (
              <button
                key={r.id}
                onMouseDown={() => { router.push(r.url); setQuery(""); setShowResults(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left"
              >
                <span className={cn("text-xs font-mono font-bold w-16 shrink-0", typeColors[r.type] ?? "text-muted-foreground")}>
                  {r.type}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{r.title}</div>
                  {r.subtitle && <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-medium">Live</span>
        </div>

        {/* Notifications */}
        <button
          onClick={() => router.push("/notifications")}
          className="relative p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-[9px] text-white font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
