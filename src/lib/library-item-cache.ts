import type { QueryClient } from "@tanstack/react-query";
import type { WorkspaceStore } from "@/hooks/use-workspace-session";

export type LibraryKind = "exam" | "quiz";
export const LIBRARY_REVISION = "library:revision";

/** Apply only a server-confirmed change. Filters, drafts and navigation state are retained. */
export async function refreshLibraryItemCaches(store: WorkspaceStore, queryClient: QueryClient, kind: LibraryKind, id: string, status?: string) {
  const update = <T extends { id: string; status?: string | null }>(items: T[]) => status
    ? items.map(item => item.id === id ? { ...item, status } : item)
    : items.filter(item => item.id !== id);
  if (kind === "exam") {
    store.set("exams:exams", update, []);
    store.set("tutor-exams:exams", update, []);
    if (!status) {
      for (const key of ["exams:completedExamIds", "exams:favouriteExamIds"]) store.set<string[]>(key, ids => ids.filter(value => value !== id), []);
      for (const key of ["exams:examProgress", "exams:examStates"]) store.set<Map<string, unknown>>(key, previous => { const next = new Map(previous); next.delete(id); return next; }, new Map());
    }
  } else {
    store.set("quizzes:practiceSets", update, []);
    if (!status) {
      store.set<Set<string>>("quizzes:favourites", previous => { const next = new Set(previous); next.delete(id); return next; }, new Set());
      store.set<Record<string, unknown>>("quizzes:progressMap", previous => { const next = { ...previous }; delete next[id]; return next; }, {});
      store.set<Record<string, number | null>>("quizzes:totalMarks", previous => { const next = { ...previous }; delete next[id]; return next; }, {});
    }
  }
  // Lists ignore reads started before this change and refetch rather than resurrecting old rows.
  store.set<number>(LIBRARY_REVISION, previous => previous + 1, 0);
  // Home has a 60-second query cache. Remove the old snapshot before another page can reuse it.
  const key = { queryKey: ["student-dashboard", store.ownerId] };
  await queryClient.cancelQueries(key);
  queryClient.removeQueries(key);
}

/** Unknown/incomplete mark metadata must not become a fabricated zero. */
export function sumLibraryMarks(rows: ReadonlyArray<{ marks: number | null }>): number | null {
  if (!rows.length || rows.some(row => row.marks === null || !Number.isFinite(row.marks) || row.marks < 0)) return null;
  const total = rows.reduce((sum, row) => sum + row.marks!, 0);
  return total > 0 ? total : null;
}
