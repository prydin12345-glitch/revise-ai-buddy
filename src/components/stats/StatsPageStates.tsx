import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";

export function StatsPageHeading() {
  return (
    <header className="mb-6 space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Your progress
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
        See what’s improving, where to focus and how your revision is taking
        shape.
      </p>
    </header>
  );
}

export function StatsLoading() {
  return (
    <div
      tabIndex={0}
      role="status"
      aria-label="Loading your statistics"
      aria-busy="true"
    >
      <span className="sr-only">Loading your statistics…</span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-11 w-64 max-w-full" />
        <div className="stats-dashboard">
          <div className="stats-dashboard-column">
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-28 rounded-t-full" />
              <Skeleton className="h-28 rounded-t-full" />
            </div>
          </div>
          <div className="stats-dashboard-column">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
          <div className="stats-dashboard-column stats-dashboard-subjects">
            <div className="stats-panel p-5">
              <Skeleton className="mb-4 h-5 w-32" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StatsError({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      role="alert"
      className="stats-panel flex flex-col items-start gap-4 p-6"
    >
      <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold">Your statistics couldn’t load</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Try again to load your results. This does not change your saved work.
        </p>
      </div>
      <Button onClick={onRetry}>
        <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
        Retry
      </Button>
    </section>
  );
}
