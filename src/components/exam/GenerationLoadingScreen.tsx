interface GenerationLoadingScreenProps {
  message?: string;
  subjectColor?: string;
  /** Kept for API back-compat; no longer used. */
  estimatedTime?: number;
  /** Kept for API back-compat; no longer used. */
  apiComplete?: boolean;
}

/**
 * Shimmering skeleton block — replaces the flat pulse Skeleton for a
 * premium "loading" feel. Uses only design tokens.
 */
function Shim({ className = "" }: { className?: string }) {
  return (
    <div
      className={
        "relative overflow-hidden rounded-md bg-muted/60 " + className
      }
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          backgroundImage:
            "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.06), transparent)",
        }}
      />
    </div>
  );
}

/**
 * Loading state for exam / practice generation.
 *
 * - No dark modal — sits on bg-background as the destination page skeleton.
 * - Sits above app chrome (z-[100]) so glowing FABs / tab bars don't leak through.
 * - One honest indeterminate 2px primary bar at the top.
 * - One pill: live dot + one restrained status line.
 * - All colors are semantic tokens. subjectColor tints only the live dot.
 */
export function GenerationLoadingScreen({
  message,
  subjectColor,
}: GenerationLoadingScreenProps) {
  const statusText =
    message?.trim() || "Analysing your materials and compiling your paper…";

  const dotColor = subjectColor || "hsl(var(--primary))";

  return (
    <div
      className="fixed inset-0 z-[100] bg-background text-foreground overflow-hidden"
      role="status"
      aria-live="polite"
      aria-label={statusText}
    >
      {/* Indeterminate progress bar — primary token, 2px, clearly visible */}
      <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-border/40">
        <div
          className="h-full w-1/3 animate-indeterminate-bar rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary)) 45%, hsl(var(--primary)) 55%, transparent)",
          }}
        />
      </div>

      {/* Destination page skeleton */}
      <div className="h-full w-full flex flex-col">
        {/* Top bar */}
        <div className="h-14 lg:h-16 border-b border-border/50 flex items-center px-4 lg:px-6 gap-3 shrink-0">
          <Shim className="h-6 w-6 rounded-md" />
          <Shim className="h-4 w-32" />
          <div className="flex-1" />
          <Shim className="h-4 w-16 hidden sm:block" />
          <Shim className="h-8 w-8 rounded-full" />
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0">
          <aside className="hidden lg:flex w-[280px] shrink-0 border-r border-border/50 flex-col gap-3 p-5">
            <Shim className="h-3 w-20" />
            <div className="space-y-2 pt-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Shim key={i} className="h-9 w-full" />
              ))}
            </div>
            <div className="mt-auto space-y-2">
              <Shim className="h-3 w-16" />
              <Shim className="h-9 w-full" />
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-hidden">
            <div className="max-w-3xl mx-auto px-4 lg:px-8 py-6 lg:py-10 space-y-6">
              <div className="space-y-2">
                <Shim className="h-3 w-24" />
                <Shim className="h-6 w-2/3" />
              </div>

              <div className="rounded-xl border border-border/60 bg-card/40 p-5 lg:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <Shim className="h-5 w-5 rounded" />
                  <Shim className="h-4 w-40" />
                  <div className="flex-1" />
                  <Shim className="h-5 w-12 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Shim className="h-4 w-full" />
                  <Shim className="h-4 w-11/12" />
                  <Shim className="h-4 w-4/5" />
                </div>
                <div className="pt-3 space-y-2">
                  <Shim className="h-10 w-full" />
                  <Shim className="h-10 w-full" />
                  <Shim className="h-10 w-full" />
                  <Shim className="h-10 w-full" />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card/30 p-5 space-y-3">
                <Shim className="h-4 w-32" />
                <Shim className="h-4 w-full" />
                <Shim className="h-4 w-3/4" />
              </div>

              {/* Bottom breathing room so the pill never overlaps the last card */}
              <div className="h-24" aria-hidden />
            </div>
          </main>
        </div>
      </div>

      {/* Status pill — strong blur, opaque enough to sit above content */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full border border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur-xl px-4 py-2 shadow-lg shadow-foreground/5">
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
