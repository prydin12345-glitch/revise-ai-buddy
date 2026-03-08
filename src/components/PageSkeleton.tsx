import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lightweight skeleton fallback for Suspense — replaces the spinning loader
 * so route transitions feel intentional rather than broken.
 */
export const PageSkeleton = () => (
  <div className="min-h-screen bg-background">
    {/* Simulated top bar */}
    <div className="h-14 lg:h-16 border-b border-border/30 bg-card/50 flex items-center px-6 gap-4">
      <Skeleton className="h-5 w-24 rounded" />
      <div className="flex-1" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>

    {/* Content area */}
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Page title */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      {/* Card row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/30 p-4 space-y-2">
            <Skeleton className="h-3 w-16 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border/30 bg-card/30 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-12 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
              <div className="flex-1" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
          </div>
        ))}
      </div>
    </div>
  </div>
);
