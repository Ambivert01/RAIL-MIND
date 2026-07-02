import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RISK_COLORS = {
  LOW: { bg: "bg-green-500/20", text: "text-green-400", border: "border-green-500/30", hex: "#22c55e" },
  MODERATE: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30", hex: "#eab308" },
  HIGH: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", hex: "#f97316" },
  CRITICAL: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", hex: "#ef4444" },
} as const;

export const STATUS_COLORS = {
  HEALTHY: { dot: "bg-green-400", text: "text-green-400", hex: "#4ade80" },
  WARNING: { dot: "bg-yellow-400", text: "text-yellow-400", hex: "#facc15" },
  CRITICAL: { dot: "bg-red-400", text: "text-red-400", hex: "#f87171" },
  OFFLINE: { dot: "bg-gray-500", text: "text-gray-400", hex: "#6b7280" },
  MAINTENANCE: { dot: "bg-blue-400", text: "text-blue-400", hex: "#60a5fa" },
} as const;

export const SEVERITY_COLORS = {
  LOW: RISK_COLORS.LOW,
  MEDIUM: RISK_COLORS.MODERATE,
  HIGH: RISK_COLORS.HIGH,
  CRITICAL: RISK_COLORS.CRITICAL,
} as const;

export const AGENT_COLORS: Record<string, string> = {
  EXECUTIVE: "#8b5cf6",
  INCIDENT: "#ef4444",
  KNOWLEDGE: "#3b82f6",
  RISK: "#f97316",
  ENGINEER: "#22c55e",
  PLANNER: "#06b6d4",
  LEARNING: "#a855f7",
};

export function getRiskColor(severity: string) {
  return RISK_COLORS[severity as keyof typeof RISK_COLORS] ?? RISK_COLORS.LOW;
}

export function getStatusColor(status: string) {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.OFFLINE;
}

export function getSeverityColor(severity: string) {
  return SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] ?? SEVERITY_COLORS.LOW;
}

export function formatDate(date: string | Date, fmt = "MMM d, yyyy") {
  return format(new Date(date), fmt);
}

export function formatRelative(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "MMM d, yyyy HH:mm");
}

export function riskScoreToSeverity(score: number): string {
  if (score >= 81) return "CRITICAL";
  if (score >= 61) return "HIGH";
  if (score >= 31) return "MODERATE";
  return "LOW";
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 85) return "High Confidence";
  if (confidence >= 65) return "Moderate Confidence";
  return "Low Confidence";
}
