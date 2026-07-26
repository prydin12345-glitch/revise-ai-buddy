import { useCallback, useSyncExternalStore } from "react";
import type { GradeScaleId } from "@/lib/grade-scales";

/**
 * Per-subject grade settings, stored locally.
 *
 * Deliberately localStorage-backed for now: putting target grades and custom
 * boundaries on user_subjects needs a schema change, and this unblocks the
 * whole feature without one. The shape mirrors what the eventual columns
 * would hold, so migrating is a matter of swapping the read/write pair.
 */
export interface SubjectGradeSettings {
  scaleId?: GradeScaleId;
  tierId?: string;
  targetGrade?: string;
  /** Grade → minimum percentage. Sparse; missing keys fall back to defaults. */
  boundaries?: Record<string, number>;
}

type Store = Record<string, SubjectGradeSettings>;

const KEY = "examly.gradeSettings.v1";

let cache: Store | null = null;
const listeners = new Set<() => void>();

const read = (): Store => {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
};

const emit = () => listeners.forEach((l) => l());

const write = (next: Store) => {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode — keep the in-memory copy so the session still works.
  }
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  // Cross-tab: another tab writing the same key invalidates our cache.
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

const keyFor = (subject: string) => subject.trim().toLowerCase();

const EMPTY: SubjectGradeSettings = {};

/**
 * Subscribes via useSyncExternalStore so every call site stays in sync.
 * (useTheme in this codebase holds its state in a plain useState per call
 * site, which is why toggling the theme leaves other consumers stale — this
 * avoids repeating that.)
 */
export const useGradeSettings = () => {
  const store = useSyncExternalStore(subscribe, read, () => ({} as Store));

  const get = useCallback(
    (subject: string): SubjectGradeSettings => store[keyFor(subject)] ?? EMPTY,
    [store]
  );

  const update = useCallback((subject: string, patch: SubjectGradeSettings) => {
    const k = keyFor(subject);
    const current = read();
    write({ ...current, [k]: { ...(current[k] ?? {}), ...patch } });
  }, []);

  const setBoundary = useCallback((subject: string, grade: string, pct: number | null) => {
    const k = keyFor(subject);
    const current = read();
    const existing = current[k] ?? {};
    const bounds = { ...(existing.boundaries ?? {}) };
    if (pct === null || !Number.isFinite(pct)) delete bounds[grade];
    else bounds[grade] = Math.max(0, Math.min(100, Math.round(pct)));
    write({ ...current, [k]: { ...existing, boundaries: bounds } });
  }, []);

  const reset = useCallback((subject: string) => {
    const k = keyFor(subject);
    const current = read();
    const next = { ...current };
    delete next[k];
    write(next);
  }, []);

  return { get, update, setBoundary, reset };
};
