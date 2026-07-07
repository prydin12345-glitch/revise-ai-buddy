import { Skeleton } from "@/components/ui/skeleton";

interface GenerationLoadingScreenProps {
  /** Optional status line. Falls back to a steady premium message. */
  message?: string;
  /** Subject accent color for the live dot. Falls back to primary token. */
  subjectColor?: string;
  /** Kept for API back-compat; no longer used (no fake timers). */
  estimatedTime?: number;
  /** Kept for API back-compat; no longer drives choreography. */
  apiComplete?: boolean;
}

/**
 * Loading state for exam / practice generation.
 *
 * Design intent:
 *  - No dark modal takeover — renders the destination layout as a skeleton
 *    on the app background, preserving spatial continuity.
 *  - One indeterminate 1px bar at the top (honest — we don't fake progress).
 *  - One live-console style pulsing dot + one restrained status line.
 *  - All colors are design tokens. Subject color only tints the live dot.
 */
export function GenerationLoadingScreen({
  message,
  subjectColor,
}: GenerationLoadingScreenProps) {
  const statusText =
    message?.trim() ||
    "Analysing your materials and compiling your paper…";

  const dotColor = subjectColor || "hsl(var(--primary))";

  return (
    <div
      className="fixed inset-0 z-50 bg-background text-foreground overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={statusText}
    >
      {/* Indeterminate 1px progress bar — Vercel-style */}
      <div className="absolute inset-x-0 top-0 h-px overflow-hidden bg-border/60">
        <div
          className="h-full w-1/3 animate-indeterminate-bar"
          style={{
            background: `linear-gradient(90deg, transparent, ${dotColor}, transparent)`,
          }}
        />
      </div>

      {/* Destination page skeleton */}
      <div className="h-full w-full flex flex-col">
        {/* Top bar */}
        <div className="h-14 lg:h-16 border-b border-border/40 flex items-center px-4 lg:px-6 gap-3 shrink-0">
          <Skeleton className="h-6 w-6 rounded-md" />
          <Skeleton className="h-4 w-32 rounded" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-16 rounded hidden sm:block" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>

        {/* Body: sidebar (desktop) + content */}
        <div className="flex-1 flex min-h-0">
          {/* Sidebar (desktop only) */}
          <aside className="hidden lg:flex w-[280px] shrink-0 border-r border-border/40 flex-col gap-3 p-5">
            <Skeleton className="h-3 w-20 rounded" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
            <div className="mt-auto space-y-2">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0 overflow-hidden">
            <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">
              {/* Question header */}
              <div className="space-y-2">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-6 w-2/3 rounded" />
              </div>

              {/* Question card */}
              <div className="rounded-xl border border-border/50 p-5 lg:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-40 rounded" />
                  <div className="flex-1" />
                  <Skeleton className="h-5 w-12 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-4 w-11/12 rounded" />
                  <Skeleton className="h-4 w-4/5 rounded" />
                </div>
                <div className="pt-3 space-y-2">
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                  <Skeleton className="h-10 w-full rounded-md" />
                </div>
              </div>

              {/* Secondary card */}
              <div className="rounded-xl border border-border/40 p-5 space-y-3">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-3/4 rounded" />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Status line — fixed bottom-center, single voice */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border/60 bg-card/90 backdrop-blur px-3.5 py-2 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
              style={{ backgroundColor: dotColor }}
            />
            <span
              className="relative inline-flex h-2 w-2 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
          </span>
          <span className="text-[13px] font-medium tracking-tight text-foreground">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}
