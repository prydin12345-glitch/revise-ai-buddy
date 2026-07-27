import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Scheduled exams (the real sittings a student is counting down to), stored
 * locally.
 *
 * There is no table for these — `exams` holds generated papers, and
 * `revision_goals` is per-subject with a single deadline, so neither fits a
 * "Biology Paper 1 at 09:00 on 14 May" entry. This mirrors the
 * useGradeSettings approach: localStorage in the shape the eventual columns
 * would take, so migrating is a read/write swap rather than a rewrite.
 */
export interface ScheduledExam {
  id: string;
  subject: string;
  /** "Paper 1", "Mock Exam", etc. */
  paper: string;
  /** ISO datetime of the sitting. */
  startsAt: string;
}

type Store = Record<string, ScheduledExam>;

const KEY = "examly.examSchedule.v1";

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
    // Quota or private mode — keep the in-memory copy so the session works.
  }
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
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

const EMPTY: Store = {};

export const useExamSchedule = () => {
  const store = useSyncExternalStore(subscribe, read, () => EMPTY);

  /** Soonest first. Sittings more than a day past are dropped from the view
   *  but kept in storage, so a countdown doesn't linger at zero forever. */
  const exams = useMemo(() => {
    const cutoff = Date.now() - 86400000;
    return Object.values(store)
      .filter((e) => new Date(e.startsAt).getTime() > cutoff)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [store]);

  const upsert = useCallback((exam: Omit<ScheduledExam, "id"> & { id?: string }) => {
    const current = read();
    const id = exam.id ?? `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    write({ ...current, [id]: { ...exam, id } });
    return id;
  }, []);

  const remove = useCallback((id: string) => {
    const current = read();
    const next = { ...current };
    delete next[id];
    write(next);
  }, []);

  return { exams, upsert, remove };
};
