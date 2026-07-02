import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/5", className)} />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card-glass p-5 space-y-3">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === rows - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card-glass p-5 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-2 w-24" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/30">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === 0 ? "w-32" : "flex-1")} />
      ))}
    </div>
  );
}

export function PageSkeleton({ cards = 4, rows = 5 }: { cards?: number; rows?: number }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-72" />
      </div>
      <div className={`grid grid-cols-2 lg:grid-cols-${cards} gap-3`}>
        {Array.from({ length: cards }).map((_, i) => <StatCardSkeleton key={i} />)}
      </div>
      <div className="card-glass p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: rows }).map((_, i) => <TableRowSkeleton key={i} />)}
      </div>
    </div>
  );
}
