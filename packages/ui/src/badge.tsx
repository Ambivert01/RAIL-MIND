import { cn } from "../lib/utils";
export function Badge({ label, variant = "default" }: { label: string; variant?: "default"|"success"|"warning"|"danger"|"info" }) {
  const v = { default:"bg-white/10 text-muted-foreground", success:"bg-green-500/10 text-green-400", warning:"bg-yellow-500/10 text-yellow-400", danger:"bg-red-500/10 text-red-400", info:"bg-blue-500/10 text-blue-400" };
  return <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold", v[variant])}>{label}</span>;
}
