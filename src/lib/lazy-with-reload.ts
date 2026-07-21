import { createElement, lazy, ComponentType } from "react";

/**
 * React.lazy wrapper that recovers from stale/broken chunks after a deploy:
 *  1) Retries the dynamic import once on failure or missing default export.
 *  2) If still failing, forces a cache-busting full page reload (once per
 *     60s to avoid infinite loops).
 *  3) After the throttle window, renders a minimal inline fallback instead
 *     of throwing — prevents the blank-screen "Lazy module missing default
 *     export" runtime error.
 */
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    const reloadKey = "examly:lazy-reload-at";
    const load = async () => {
      const mod = await factory();
      if (!mod || !(mod as any).default) {
        throw new Error("Lazy module missing default export");
      }
      return mod as { default: T };
    };

    const tryReload = () => {
      try {
        const last = Number(sessionStorage.getItem(reloadKey) ?? "0");
        const now = Date.now();
        if (now - last > 60_000) {
          sessionStorage.setItem(reloadKey, String(now));
          const url = new URL(window.location.href);
          url.searchParams.set("_r", String(now));
          window.location.replace(url.toString());
          return new Promise(() => {}) as any;
        }
      } catch {
        /* storage unavailable — fall through to fallback */
      }
      return null;
    };

    try {
      const result = await load();
      try { sessionStorage.removeItem(reloadKey); } catch { /* noop */ }
      return result;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
      try {
        const result = await load();
        try { sessionStorage.removeItem(reloadKey); } catch { /* noop */ }
        return result;
      } catch {
        const reloaded = tryReload();
        if (reloaded) return reloaded;
        // Throttled — return a tiny inline fallback so React doesn't blank.
        const Fallback: any = () =>
          createElement(
            "div",
            {
              style: {
                padding: "2rem",
                textAlign: "center",
                fontFamily: "system-ui, sans-serif",
                color: "#64748b",
              },
            },
            createElement("p", null, "This page didn't load correctly."),
            createElement(
              "button",
              {
                onClick: () => {
                  try { sessionStorage.removeItem(reloadKey); } catch { /* noop */ }
                  window.location.reload();
                },
                style: {
                  marginTop: "0.75rem",
                  padding: "0.5rem 1rem",
                  background: "#3B82F6",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                },
              },
              "Reload",
            ),
          );
        return { default: Fallback as T };
      }
    }
  });
}
