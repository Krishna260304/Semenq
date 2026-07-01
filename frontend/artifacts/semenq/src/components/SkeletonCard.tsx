import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard({ count = 1, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-card-border rounded-[24px] p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          {Array.from({ length: lines - 1 }).map((_, j) => (
            <Skeleton key={j} className="h-3 w-full" />
          ))}
        </div>
      ))}
    </>
  );
}

export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card border border-card-border rounded-[24px] p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </>
  );
}
