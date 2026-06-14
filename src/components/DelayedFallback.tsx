import { useEffect, useState } from "react";
import { PageSkeleton } from "./PageSkeleton";

/**
 * Avoids the white-flash on route changes by deferring the skeleton —
 * but never renders null, so the html layer is never exposed.
 */
export const DelayedFallback = ({ delay = 180 }: { delay?: number }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!show) return <div className="min-h-screen bg-background" aria-hidden="true" />;
  return <PageSkeleton />;
};
