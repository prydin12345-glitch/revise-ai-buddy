import { PageSkeleton } from "./PageSkeleton";

/** Immediate layout feedback: route loading never exposes an empty screen. */
export const DelayedFallback = () => <PageSkeleton />;
