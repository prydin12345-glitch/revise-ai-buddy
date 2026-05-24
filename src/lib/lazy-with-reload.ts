import { lazy, ComponentType } from "react";

/**
 * React.lazy wrapper that:
 *  1) Retries the dynamic import once if the first attempt fails or the
 *     resolved module is missing a default export (stale/partial chunk).
 *  2) Forces a one-shot full page reload if the retry still fails — recovers
 *     blank-screen "_result.default is undefined" runtime errors after a deploy.
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
      const last = Number(sessionStorage.getItem(reloadKey) ?? "0");
      const now = Date.now();
      if (now - last > 10_000) {
        sessionStorage.setItem(reloadKey, String(now));
        window.location.reload();
        return new Promise(() => {}) as any;
      }
      return null;
    };

    try {
      const result = await load();
      sessionStorage.removeItem(reloadKey);
      return result;
    } catch (err) {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const result = await load();
        sessionStorage.removeItem(reloadKey);
        return result;
      } catch (err2) {
        const reloaded = tryReload();
        if (reloaded) return reloaded;
        throw err2;
      }
    }
  });
}
