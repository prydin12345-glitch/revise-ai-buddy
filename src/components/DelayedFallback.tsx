import { useEffect, useState } from "react";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Avoids the white-flash on route changes by deferring the skeleton.
 * Most lazy chunks resolve in <150ms (cached) — showing nothing during
 * that window keeps the previous page visible until the new one is ready.
 */
export const DelayedFallback = ({ delay = 180 }: { delay?: number }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return null;
  return <PageSkeleton />;
};
