"use client";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react";

// ─── Skeleton Loader ──────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-white/5", className)} />
  );
}

export function CardSkeleton() {
  return (
    <div className="card-glass p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card-glass p-4 flex items-center gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

// ─── Page Loading State ───────────────────────────────────────────────────────
export function PageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon = CheckCircle2,
  title = "Nothing here yet",
  description,
  action,
}: {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
        <Icon className="w-8 h-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const SEVERITY_BADGE: Record<string, string> = {
  CRITICAL: "bg-red-500/20 text-red-400 border-red-500/30",
  HIGH:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  MEDIUM:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  MODERATE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  LOW:      "bg-green-500/20 text-green-400 border-green-500/30",
  OPEN:     "bg-red-500/20 text-red-400 border-red-500/30",
  INVESTIGATING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  RESOLVED: "bg-green-500/20 text-green-400 border-green-500/30",
  ARCHIVED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  HEALTHY:  "bg-green-500/20 text-green-400 border-green-500/30",
  WARNING:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  OFFLINE:  "bg-gray-500/20 text-gray-400 border-gray-500/30",
  PENDING:  "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  APPROVED: "bg-green-500/20 text-green-400 border-green-500/30",
  COMPLETED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function StatusBadge({
  label,
  size = "sm",
}: {
  label: string;
  size?: "xs" | "sm";
}) {
  const cls = SEVERITY_BADGE[label] ?? "bg-white/10 text-muted-foreground border-border";
  return (
    <span className={cn(
      "font-bold rounded-full border uppercase tracking-wider inline-block",
      size === "xs" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5",
      cls,
    )}>
      {label}
    </span>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
export function AlertBanner({
  type = "info",
  message,
}: {
  type?: "info" | "warning" | "error" | "success";
  message: string;
}) {
  const map = {
    info:    { icon: Info,          cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
    warning: { icon: AlertTriangle, cls: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400" },
    error:   { icon: AlertTriangle, cls: "bg-red-500/10 border-red-500/20 text-red-400" },
    success: { icon: CheckCircle2,  cls: "bg-green-500/10 border-green-500/20 text-green-400" },
  };
  const { icon: Icon, cls } = map[type];
  return (
    <div className={cn("flex items-center gap-3 px-4 py-3 rounded-lg border text-sm", cls)}>
      <Icon className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ─── Risk Score Display ───────────────────────────────────────────────────────
export function RiskScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const color =
    score >= 81 ? "#ef4444" :
    score >= 61 ? "#f97316" :
    score >= 31 ? "#eab308" : "#22c55e";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(215 25% 14%)" strokeWidth={6} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-foreground leading-none">{score}</span>
        <span className="text-[9px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────
export function ConfidenceBar({ value }: { value: number }) {
  const color =
    value >= 80 ? "bg-green-400" :
    value >= 60 ? "bg-yellow-400" : "bg-orange-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

// ─── Agent Thinking Indicator ─────────────────────────────────────────────────
export function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-0.5 h-4">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          style={{ animation: `thinking 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}
