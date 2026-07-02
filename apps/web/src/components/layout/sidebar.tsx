"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import {
  LayoutDashboard, Map, AlertTriangle, ShieldAlert,
  Brain, Lightbulb, Wrench, BarChart3, Bot,
  Settings, LogOut, Train, GitBranch,
} from "lucide-react";

const navItems = [
  { href: "/dashboard",       label: "Dashboard",      icon: LayoutDashboard, group: "main" },
  { href: "/twin",            label: "Digital Twin",   icon: Map,             group: "main" },
  { href: "/incidents",       label: "Incidents",      icon: AlertTriangle,   group: "operations" },
  { href: "/risk",            label: "Risk Center",    icon: ShieldAlert,     group: "operations" },
  { href: "/memory",          label: "Memory Search",  icon: Brain,           group: "intelligence" },
  { href: "/graph",           label: "Knowledge Graph",icon: GitBranch,       group: "intelligence" },
  { href: "/agents",          label: "Agent Console",  icon: Bot,             group: "intelligence" },
  { href: "/recommendations", label: "Recommendations",icon: Lightbulb,       group: "actions" },
  { href: "/maintenance",     label: "Maintenance",    icon: Wrench,          group: "actions" },
  { href: "/analytics",       label: "Analytics",      icon: BarChart3,       group: "insights" },
];

const groups: Record<string, string> = {
  main: "Overview",
  operations: "Operations",
  intelligence: "Intelligence",
  actions: "Actions",
  insights: "Insights",
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const groupedItems = navItems.reduce((acc, item) => {
    const g = item.group;
    if (!acc[g]) acc[g] = [];
    acc[g].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col z-30"
      style={{ width: "var(--sidebar-width)", background: "hsl(224 71% 4%)", borderRight: "1px solid hsl(215 25% 10%)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20">
          <Train className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold text-foreground tracking-wide">RailMind</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Cognitive OS</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group}>
            <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              {groups[group]}
            </div>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <item.icon className={cn("w-4 h-4 flex-shrink-0", active ? "text-primary" : "")} />
                    <span className="truncate">{item.label}</span>
                    {item.href === "/agents" && (
                      <span className="ml-auto flex h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-border/50 p-3 space-y-0.5">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-white/5">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </Link>
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold">
              {user.firstName?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-foreground truncate">{user.firstName} {user.lastName}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.role?.replace(/_/g, " ")}</div>
            </div>
            <button onClick={handleLogout} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
