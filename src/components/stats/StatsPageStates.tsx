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
    <div tabIndex={0} role="status" aria-label="Loading your statistics" aria-busy="true">
      <span className="sr-only">Loading your statistics…</span>
      <div aria-hidden="true" className="space-y-5">
        <Skeleton className="h-11 w-64 max-w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="stats-panel space-y-4 p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="stats-panel space-y-5 p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-56 w-full" />
            </div>
          ))}
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
