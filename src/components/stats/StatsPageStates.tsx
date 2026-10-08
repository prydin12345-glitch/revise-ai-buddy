import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { AlertCircle, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

export function StatsPageHeading({ actions }: { actions?: ReactNode }) {
  return (
    <header className="stats-page-heading">
      <div className="stats-heading-copy space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Your progress</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          See what’s improving, where to focus and how your revision is taking
          shape.
        </p>
      </div>
      {actions && <div className="stats-heading-actions">{actions}</div>}
    </header>
  );
}

export function StatsLoading({ showTabs = true }: { showTabs?: boolean }) {
  return (
    <div
      tabIndex={0}
      role="status"
      aria-label="Loading your statistics"
      aria-busy="true"
    >
      <span className="sr-only">Loading your statistics…</span>
      <div aria-hidden="true" className="space-y-5">
        {showTabs && <Skeleton className="h-11 w-64 max-w-full" />}
        <div className="stats-dashboard">
          <div className="stats-dashboard-column">
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-44 w-full" />
            </div>
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
          <div className="stats-dashboard-column">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <div className="space-y-4 p-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-44 w-full" />
            </div>
          </div>
          <div className="stats-dashboard-column stats-dashboard-subjects">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
            <div className="stats-panel space-y-4 p-5">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-40 w-full" />
            </div>
          </div>
          <div className="stats-dashboard-progress">
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-28 rounded-t-full" />
              <Skeleton className="h-28 rounded-t-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="mx-auto h-28 w-28 rounded-full" />
              <Skeleton className="mx-auto h-28 w-28 rounded-full" />
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
