import { LucideIcon } from "lucide-react";
export function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string|number; icon: LucideIcon; sub?: string }) {
  return (
    <div className="card-glass p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
