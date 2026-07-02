import { cn } from "../lib/utils";
export function StatusDot({ status }: { status: string }) {
  const c: Record<string,string> = { OPERATIONAL:"bg-green-400", DEGRADED:"bg-yellow-400", FAILED:"bg-red-400", MAINTENANCE:"bg-blue-400", OPEN:"bg-red-400", RESOLVED:"bg-green-400", INVESTIGATING:"bg-orange-400" };
  return <span className={cn("inline-block w-2 h-2 rounded-full", c[status] ?? "bg-gray-400")} />;
}
