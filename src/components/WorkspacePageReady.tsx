import { accountQuery } from "@/lib/workspace-account-query";
import { classesQuery } from "@/lib/classes-query";
import { LoadError } from "./shared/ListFeedback";
import { examLibraryQuery, quizLibraryQuery } from "@/lib/library-navigation-data";
import { useContext, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useWorkspaceSession } from "@/hooks/use-workspace-session";
import { workspaceQueryClient } from "@/lib/workspace-query-client";
import { rolesQuery, subjectsQuery, profilesQuery } from "@/lib/workspace-summary-queries";
import { examStatsQuery, accuracyTrendQuery } from "@/lib/exam-stats-query";
import { studentDashboardQuery } from "@/lib/student-dashboard-query";
import { subjectAverageQuery } from "@/lib/subject-average-query";
import { unifiedTopicQuery } from "@/lib/unified-topic-query";
import { QueryClientContext, type QueryClient, type QueryKey } from "@tanstack/react-query";

/** Read-only metadata gates. Never pre-mount a form, recover/publish a draft, or fetch private answers. */
export function WorkspacePageReady({ children }: { children: ReactNode }) {
  const [, retry] = useState(0);
  const applicationClient = useContext(QueryClientContext);
  const { store, ownerId } = useWorkspaceSession();
  const { pathname, search } = useLocation();
  if (!ownerId) return children;
  const client = workspaceQueryClient(store);
  const reads: Array<{ queryKey: QueryKey; queryFn: () => Promise<unknown>; client?: QueryClient; optional?: boolean }> = [rolesQuery(store)];
  if (/^\/(dashboard|my-subjects|my-exams|quizzes|stats|my-classes)(\/|$)/.test(pathname)) reads.push(subjectsQuery(store));
  if (/^\/my-subjects(\/|$)/.test(pathname)) reads.push(profilesQuery(store));
  if (pathname === "/my-subjects") {
    const subjects = client.getQueryData<Array<{ subject_name: string }>>(["workspace-subjects"]) || [];
    reads.push(...subjects.map(subject => ({ ...subjectAverageQuery(store, subject.subject_name), optional: true })));
  }
  if (pathname === "/stats") reads.push(examStatsQuery(store), unifiedTopicQuery(ownerId, "[]"), { ...accuracyTrendQuery(store), optional: true });
  const roles = client.getQueryData<Array<{ role: string; metadata?: unknown }>>(["workspace-roles"]);
  const primaryRole = roles?.find(role => (role.metadata as { is_primary?: boolean })?.is_primary === true)?.role || roles?.[0]?.role;
  if (pathname === "/dashboard" && roles && primaryRole !== "tutor" && primaryRole !== "teacher") {
    reads.push({ ...examStatsQuery(store), optional: true });
    if (applicationClient) reads.push({ ...studentDashboardQuery(ownerId, store.generation), client: applicationClient });
  }
  if (pathname === "/my-exams" && !store.get("exams:loaded", false)) reads.push(examLibraryQuery(store));
  if (pathname === "/quizzes" && !store.get("quizzes:loaded", false)) reads.push(quizLibraryQuery(store));
  if (pathname === "/my-classes") reads.push(classesQuery(store));
  if (pathname === "/settings" && (window.matchMedia("(min-width: 1024px)").matches || new URLSearchParams(search).get("tab") === "account")) reads.push(accountQuery(store));
  const missing = reads.filter(read => {
    const state = (read.client || client).getQueryState(read.queryKey);
    return state?.data === undefined && state?.status !== "error";
  });
  // Failed reads settle into retryable UI rather than a repeated suspension loop.
  if (missing.length) throw Promise.all(missing.map(read => (read.client || client).fetchQuery(read).catch(() => undefined)));
  const failed = reads.find(read => !read.optional && (read.client || client).getQueryState(read.queryKey)?.status === "error" && (read.client || client).getQueryData(read.queryKey) === undefined);
  if (failed) return <div className="mx-auto max-w-xl p-6"><h1 className="mb-4 text-xl font-semibold">Couldn’t open this page</h1><LoadError message="Your saved work is unchanged. Check your connection and try again." onRetry={() => { void (failed.client || client).resetQueries({ queryKey: failed.queryKey, exact: true }); retry(value => value + 1); }} /></div>;
  if (pathname === "/my-exams" && !store.get("exams:loaded", false)) {
    const data = client.getQueryData<Awaited<ReturnType<ReturnType<typeof examLibraryQuery>["queryFn"]>>>(examLibraryQuery(store).queryKey);
    if (data) {
      store.set("exams:exams", data.exams, []);
      store.set("exams:examProgress", data.progressMap, new Map());
      store.set("exams:examStates", data.statesMap, new Map());
      store.set("exams:completedExamIds", data.completedExamIds, []);
      store.set("exams:favouriteExamIds", data.favouriteIds, []);
      store.set("navigation:exam-library", data, null);
      store.set("exams:loaded", true, false);
    }
  }
  if (pathname === "/quizzes" && !store.get("quizzes:loaded", false)) {
    const data = client.getQueryData<Awaited<ReturnType<ReturnType<typeof quizLibraryQuery>["queryFn"]>>>(quizLibraryQuery(store).queryKey);
    if (data) {
      store.set("quizzes:practiceSets", data.sets, []);
      store.set("quizzes:progressMap", data.progressMap, {});
      store.set("quizzes:totalMarks", data.totalMarks, {});
      store.set("navigation:quiz-library", data, null);
      store.set("quizzes:loaded", true, false);
    }
  }
  return children;
}
