import { Suspense, useDeferredValue, type ReactNode } from "react";
import { Routes, useLocation } from "react-router-dom";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { PageSkeleton } from "./PageSkeleton";
import { WorkspaceNavigationPendingContext } from "@/hooks/use-workspace-navigation-pending";

function DeferredRoutes({ children }: { children: ReactNode }) {
  const location = useLocation();
  const deferredLocation = useDeferredValue(location);
  const pending = location !== deferredLocation;
  return <WorkspaceNavigationPendingContext.Provider value={pending}>
    {pending && <div data-workspace-navigation-pending role="status" className="fixed inset-x-0 top-0 z-[100] border-t-2 border-primary pointer-events-none"><span className="absolute right-4 top-2 rounded-md border border-border bg-card px-3 py-1 text-xs text-foreground shadow-sm">Opening page…</span></div>}
    <Suspense fallback={<PageSkeleton />}><Routes location={deferredLocation}>{children}</Routes></Suspense>
  </WorkspaceNavigationPendingContext.Provider>;
}

/** Keep the current screen during code/data reads, but discard it immediately on account changes. */
export function WorkspaceRouteViewport({ children }: { children: ReactNode }) {
  const { store } = useWorkspaceSession();
  return <DeferredRoutes key={`${store.ownerId}:${store.generation}`} >{children}</DeferredRoutes>;
}
