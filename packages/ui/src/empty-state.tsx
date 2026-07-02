import { LucideIcon } from "lucide-react";
export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><Icon className="w-6 h-6 text-muted-foreground" /></div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
    </div>
  );
}
