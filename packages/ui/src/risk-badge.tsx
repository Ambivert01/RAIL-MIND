import { cn } from "../lib/utils";
export function RiskBadge({ score }: { score: number }) {
  const { label, cls } = score >= 81 ? { label:"CRITICAL", cls:"bg-red-500/20 text-red-400 border-red-500/30" } :
    score >= 61 ? { label:"HIGH", cls:"bg-orange-500/20 text-orange-400 border-orange-500/30" } :
    score >= 31 ? { label:"MODERATE", cls:"bg-yellow-500/20 text-yellow-400 border-yellow-500/30" } :
    { label:"LOW", cls:"bg-green-500/20 text-green-400 border-green-500/30" };
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold border", cls)}>{label} {score}</span>;
}
