import { createElement, type PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import { workspaceQueryClient } from "@/lib/workspace-query-client";
import { profilesQuery, rolesQuery, subjectsQuery } from "@/lib/workspace-summary-queries";
import { examStatsQuery } from "@/lib/exam-stats-query";
import { examLibraryQuery, quizLibraryQuery } from "@/lib/library-navigation-data";
import { classesQuery } from "@/lib/classes-query";
import { useExamStats } from "@/hooks/useExamStats";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { useSubjectProfiles } from "@/hooks/useSubjectProfiles";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { accountQuery } from "@/lib/workspace-account-query";
import { subjectAverageQuery } from "@/lib/subject-average-query";
import { useSubjectAverage } from "@/hooks/useSubjectAverage";
import { MemoryRouter } from "react-router-dom";
import { SubjectCard } from "@/components/subjects/SubjectCard";

type ReadCall = { table: string; steps: unknown[][] };
type Response = { data: any; error: Error | null };

const fixture = vi.hoisted(() => ({
  calls: [] as ReadCall[],
  execute: (_call: ReadCall): Response | Promise<Response> => ({ data: [], error: null }),
  getUser: vi.fn(),
  invoke: vi.fn(),
  rpc: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: fixture.getUser },
    functions: { invoke: fixture.invoke },
    rpc: fixture.rpc,
    from(table: string) {
      const call: ReadCall = { table, steps: [] };
      fixture.calls.push(call);
      let throwErrors = false;
      const query: any = {};
      for (const method of ["select", "eq", "in", "gte", "lte", "not", "order", "range", "limit", "single", "maybeSingle", "ilike", "insert", "update", "delete"]) {
        query[method] = (...args: unknown[]) => {
          call.steps.push([method, ...args]);
          return query;
        };
      }
      query.throwOnError = () => { throwErrors = true; return query; };
      query.then = (resolve: (value: Response) => unknown, reject: (error: unknown) => unknown) => Promise.resolve()
        .then(() => fixture.execute(call))
        .then(result => {
          if (throwErrors && result.error) throw result.error;
          return result;
        }).then(resolve, reject);
      return query;
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useUserPreferences", () => ({ useUserPreferences: () => ({ updatePreference: fixture.updatePreference }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ primaryRole: "student" }) }));
vi.mock("@/components/settings/DangerZone", () => ({ DangerZone: () => null }));

const subject = { id: "subject-1", subject_name: "Biology", subject_color: "#15815a", subject_id: "catalogue-1", exam_board: "OCR" };
const profile = { id: "profile-1", subject_name: "Biology", profile_name: "Paper 3", topics: ["Biology"], question_count: 6 };
const topic = { id: "topic-1", subject_name: "Biology", topic: "Cells" };
const stores: WorkspaceStore[] = [];
const isWrite = (call: ReadCall) => call.steps.some(([method]) => ["insert", "update", "delete", "upsert"].includes(String(method)));
const hasFilter = (call: ReadCall, name: string, value: unknown) => call.steps.some(step => step[0] === "eq" && step[1] === name && step[2] === value);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function storeFor(ownerId = "alice", generation = 1) {
  const store = new WorkspaceStore(ownerId, generation);
  stores.push(store);
  return store;
}

function wrapperFor(store: WorkspaceStore) {
  return ({ children }: PropsWithChildren) => createElement(WorkspaceContext.Provider, {
    value: { ownerId: store.ownerId, ready: true, store },
  }, children);
}

function responseFor(call: ReadCall): Response {
  if (isWrite(call)) {
    const update = call.steps.find(([method]) => method === "update")?.[1];
    return { data: call.table === "subject_exam_profiles" ? { ...profile, ...(update as object) } : null, error: null };
  }
  const data = call.table === "user_subjects" ? [subject]
    : call.table === "subject_master_topics" ? [topic]
    : call.table === "subject_exam_profiles" ? [profile]
    : call.table === "subjects" ? { id: "catalogue-1" }
    : call.table === "exams" ? [{ id: "exam-1", status: "published", title: "Paper 3", subject_id: "Biology" }]
    : call.table === "user_streaks" ? null
    : call.table === "user_profiles" ? { first_name: "Alice" }
    : [];
  return { data, error: null };
}

function libraryAndClassResponseFor(call: ReadCall): Response {
  const base = responseFor(call);
  const data = call.table === "exams" ? [{ id: "draft-1", status: "draft", title: "Unfinished draft", subject_id: "Biology" }]
    : call.table === "exam_question_metadata" ? [{ id: "question-1", exam_id: "draft-1", marks: 3 }]
    : call.table === "practice_question_sets" ? [{ id: "quiz-1", title: "Practice", extraction_status: "completed" }]
    : call.table === "practice_questions" ? [{ id: "quiz-question-1", set_id: "quiz-1", marks: 2 }]
    : call.table === "group_members" ? [{ group_id: "group-1", joined_at: "2026-01-01", student_groups: { id: "group-1", name: "Class 1", tutor_id: "tutor-1", is_active: true, subjects_covered: ["Biology"] } }]
    : call.table === "exam_assignments" ? [{ id: "assignment-1", exam_id: "exam-1", target_id: "group-1", exams: { id: "exam-1", title: "Assigned paper", status: "published" } }]
    : call.table === "user_profiles" && call.steps.some(([method]) => method === "in") ? [{ id: "tutor-1", display_name: "Tutor" }]
    : base.data;
  return { data, error: null };
}

function subjectAverageResponseFor(call: ReadCall): Response {
  const data = call.table === "practice_question_sets" ? [{ id: "set-1" }]
    : call.table === "practice_questions" ? [{ id: "large", marks: 10 }, { id: "small", marks: 1 }, { id: "zero", marks: null }]
    : call.table === "practice_question_answers" ? [
      { question_id: "large", score: 10 }, { question_id: "small", score: 1 }, { question_id: "large", score: "5" },
      { question_id: "large", score: null }, { question_id: "small", score: 1 }, { question_id: "large", score: 0 },
      { question_id: "zero", score: 0 },
    ]
    : responseFor(call).data;
  return { data, error: null };
}

beforeEach(() => {
  fixture.calls = [];
  fixture.execute = responseFor;
  fixture.getUser.mockReset().mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
  fixture.invoke.mockReset().mockRejectedValue(new Error("Model/function calls are forbidden in navigation fixtures"));
  fixture.rpc.mockReset().mockRejectedValue(new Error("RPC calls are forbidden in navigation fixtures"));
  fixture.updatePreference.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  cleanup();
  for (const store of stores.splice(0)) {
    const client = workspaceQueryClient(store);
    await client.cancelQueries();
    client.clear();
  }
});

describe("account-scoped workspace reads", () => {
  it("deduplicates verification and simultaneous consumers of the same pending read", async () => {
    const auth = deferred<{ data: { user: { id: string } }; error: null }>();
    const rows = deferred<Response>();
    fixture.getUser.mockReturnValue(auth.promise);
    fixture.execute = call => call.table === "user_subjects" ? rows.promise : responseFor(call);
    const store = storeFor();
    const client = workspaceQueryClient(store);
    const first = client.fetchQuery(subjectsQuery(store));
    const second = client.fetchQuery(subjectsQuery(store));
    const roles = client.fetchQuery(rolesQuery(store));
    const profiles = client.fetchQuery(profilesQuery(store));
    await waitFor(() => expect(fixture.getUser).toHaveBeenCalledTimes(1));
    expect(fixture.calls).toHaveLength(0);
    auth.resolve({ data: { user: { id: "alice" } }, error: null });
    await waitFor(() => expect(fixture.calls.filter(call => call.table === "user_subjects")).toHaveLength(1));
    rows.resolve({ data: [subject], error: null });
    const [a, b] = await Promise.all([first, second, roles, profiles]);
    expect(a).toEqual([subject]);
    expect(b).toBe(a);
    await client.fetchQuery(subjectsQuery(store));
    expect(fixture.getUser).toHaveBeenCalledTimes(1);
    expect(fixture.calls.filter(call => call.table === "user_subjects")).toHaveLength(1);
    for (const call of fixture.calls) expect(hasFilter(call, "user_id", "alice")).toBe(true);
  });

  it("isolates accounts and sign-in generations even when an old account read completes late", async () => {
    const oldRows = deferred<Response>();
    const alice = storeFor("alice", 1);
    const bob = storeFor("bob", 2);
    const aliceAgain = storeFor("alice", 3);
    const oldClient = workspaceQueryClient(alice);
    const bobClient = workspaceQueryClient(bob);
    const nextClient = workspaceQueryClient(aliceAgain);
    fixture.execute = call => hasFilter(call, "user_id", "alice") ? oldRows.promise : { data: [{ ...subject, subject_name: "Bob's Chemistry" }], error: null };
    const oldRead = oldClient.fetchQuery(subjectsQuery(alice));
    await waitFor(() => expect(fixture.calls).toHaveLength(1));
    fixture.getUser.mockResolvedValue({ data: { user: { id: "bob" } }, error: null });
    const bobRows = await bobClient.fetchQuery(subjectsQuery(bob));
    expect(bobRows[0].subject_name).toBe("Bob's Chemistry");
    expect(nextClient.getQueryData(subjectsQuery(aliceAgain).queryKey)).toBeUndefined();
    oldRows.resolve({ data: [subject], error: null });
    await oldRead;
    expect(bobClient.getQueryData(subjectsQuery(bob).queryKey)).toBe(bobRows);
    expect(oldClient).not.toBe(bobClient);
    expect(oldClient).not.toBe(nextClient);
    expect(workspaceQueryClient(alice)).toBe(oldClient);
    expect(nextClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it.each([
    ["roles", rolesQuery], ["subjects", subjectsQuery], ["profiles", profilesQuery],
    ["statistics", examStatsQuery], ["exam library", examLibraryQuery],
    ["quiz library", quizLibraryQuery], ["classes", classesQuery], ["account", accountQuery],
    ["subject average", (store: WorkspaceStore) => subjectAverageQuery(store, "Biology")],
  ] as const)("rejects a verified-user mismatch before reading %s data", async (_name, query) => {
    fixture.getUser.mockResolvedValue({ data: { user: { id: "someone-else" } }, error: null });
    const store = storeFor("alice");
    // Each query has a different result shape, but all must verify ownership first.
    await expect(query(store).queryFn()).rejects.toThrow("Your account changed. Reopen this page.");
    expect(fixture.calls).toHaveLength(0);
    expect(fixture.invoke).not.toHaveBeenCalled();
  });

  it("starts all independent statistics reads without waiting for an earlier table", async () => {
    const gate = deferred<void>();
    fixture.execute = async call => { await gate.promise; return responseFor(call); };
    const store = storeFor();
    const pending = workspaceQueryClient(store).fetchQuery(examStatsQuery(store));
    await waitFor(() => expect(fixture.calls).toHaveLength(8));
    expect(fixture.calls.map(call => call.table)).toEqual([
      "exams", "exam_submissions", "user_subjects", "revision_tasks", "exam_submissions", "practice_set_progress", "revision_goals", "user_streaks",
    ]);
    expect(fixture.calls.filter(call => call.table === "exam_submissions").every(call => hasFilter(call, "status", "graded") && hasFilter(call, "student_id", "alice"))).toBe(true);
    gate.resolve();
    expect((await pending).totalExams).toBe(1);
    expect(fixture.getUser).toHaveBeenCalledTimes(1);
  });

  it("turns a stalled metadata read into a retryable error and ignores its late result", async () => {
    vi.useFakeTimers();
    try {
      const rows = deferred<Response>();
      fixture.execute = () => rows.promise;
      const store = storeFor();
      const client = workspaceQueryClient(store);
      const pending = client.fetchQuery(subjectsQuery(store));
      const assertion = expect(pending).rejects.toThrow("This page took too long to load. Please retry.");
      await vi.advanceTimersByTimeAsync(15_001);
      await assertion;
      rows.resolve({ data: [subject], error: null });
      await vi.advanceTimersByTimeAsync(0);
      expect(client.getQueryData(["workspace-subjects"])).toBeUndefined();
      expect(client.getQueryState(["workspace-subjects"])?.status).toBe("error");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the previous statistics visible when a background refresh fails and supports retry", async () => {
    const store = storeFor();
    const { result } = renderHook(() => useExamStats(), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.hasData).toBe(true));
    expect(result.current.totalExams).toBe(1);
    const gate = deferred<Response>();
    fixture.execute = call => call.table === "revision_tasks" ? gate.promise : responseFor(call);
    let refresh!: Promise<unknown>;
    act(() => { refresh = result.current.refetch(); });
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.totalExams).toBe(1);
    await act(async () => { gate.resolve({ data: null, error: new Error("Offline fixture") }); await refresh; });
    await waitFor(() => expect(result.current.error?.message).toBe("Offline fixture"));
    expect(result.current.hasData).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.totalExams).toBe(1);
    fixture.execute = responseFor;
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
  });

  it("preserves subject accuracy weighting, attempted count, nullable scores and last-three trend", async () => {
    fixture.execute = subjectAverageResponseFor;
    const store = storeFor();
    const result = await workspaceQueryClient(store).fetchQuery(subjectAverageQuery(store, "Biology"));
    // 17 marks earned out of 42, rather than averaging question percentages.
    expect(result).toEqual({ percentage: 40, average: 40, questionsAttempted: 7, trend: "up" });
    expect(fixture.calls.map(call => call.table)).toEqual(["practice_question_sets", "practice_questions", "practice_question_answers"]);
    expect(hasFilter(fixture.calls[0], "subject_id", "Biology")).toBe(true);
    expect(hasFilter(fixture.calls[0], "user_id", "alice")).toBe(true);
    expect(hasFilter(fixture.calls[2], "user_id", "alice")).toBe(true);
    expect(fixture.calls[2].steps).toContainEqual(["order", "submitted_at", { ascending: false, nullsFirst: false }]);
    expect(fixture.calls.every(call => !isWrite(call))).toBe(true);
    expect(fixture.invoke).not.toHaveBeenCalled();
  });

  it("opens subject accuracy consumers immediately from a shared prepared snapshot", async () => {
    fixture.execute = subjectAverageResponseFor;
    const store = storeFor();
    await workspaceQueryClient(store).fetchQuery(subjectAverageQuery(store, "Biology"));
    const calls = fixture.calls.length;
    fixture.execute = call => {
      const response = subjectAverageResponseFor(call);
      return call.table === "practice_question_answers" ? { data: response.data.map((answer: object) => ({ ...answer, score: 0 })), error: null } : response;
    };
    const { result } = renderHook(() => [useSubjectAverage("Biology"), useSubjectAverage("Biology")], { wrapper: wrapperFor(store) });
    expect(result.current.every(value => !value.loading && value.percentage === 40 && value.error === null)).toBe(true);
    await waitFor(() => expect(result.current.every(value => !value.loading && value.percentage === 0)).toBe(true));
    expect(fixture.calls).toHaveLength(calls + 3);
    expect(workspaceQueryClient(store).getQueryData(subjectAverageQuery(store, "Chemistry").queryKey)).toBeUndefined();
  });

  it.each(["practice_question_sets", "practice_questions", "practice_question_answers"])("surfaces %s subject-average failures and retries without turning them into accuracy", async table => {
    fixture.execute = call => call.table === table
      ? { data: null, error: new Error(`Unavailable ${table}`) }
      : subjectAverageResponseFor(call);
    const store = storeFor();
    const { result } = renderHook(() => useSubjectAverage("Biology"), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.error?.message).toBe(`Unavailable ${table}`));
    expect(result.current.loading).toBe(false);
    expect(result.current.percentage).toBeNull();
    expect(workspaceQueryClient(store).getQueryData(subjectAverageQuery(store, "Biology").queryKey)).toBeUndefined();
    fixture.execute = subjectAverageResponseFor;
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.percentage).toBe(40));
    expect(result.current.error).toBeNull();
  });

  it("shows a failed subject score honestly and retries through a separate accessible control", async () => {
    const store = storeFor();
    fixture.execute = () => ({ data: null, error: new Error("Practice scores unavailable") });
    await expect(workspaceQueryClient(store).fetchQuery(subjectAverageQuery(store, "Biology"))).rejects.toThrow("Practice scores unavailable");
    const failedReads = fixture.calls.length;
    const { container } = render(createElement(MemoryRouter, {
      future: { v7_startTransition: true, v7_relativeSplatPath: true },
    }, createElement(SubjectCard, { subject, profileCount: 1 })), { wrapper: wrapperFor(store) });
    expect(screen.getByText("score unavailable")).toBeVisible();
    expect(screen.queryByText("no attempts recorded")).not.toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Retry Biology score" });
    expect(retry).toBeEnabled();
    expect(container.querySelector("button button")).toBeNull();
    await act(async () => { await Promise.resolve(); });
    expect(fixture.calls).toHaveLength(failedReads);

    fixture.execute = subjectAverageResponseFor;
    fireEvent.click(retry);
    expect(await screen.findByText("40%")).toBeVisible();
    expect(screen.getByText("average score")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Retry Biology score" })).not.toBeInTheDocument();
    expect(fixture.calls).toHaveLength(failedReads + 3);
    expect(fixture.calls.every(call => !isWrite(call))).toBe(true);
    expect(fixture.invoke).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });

  it("does not let an older subject refresh overwrite a confirmed subject edit", async () => {
    const store = storeFor();
    const { result } = renderHook(() => useUserSubjects(), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.subjects).toHaveLength(1));
    const oldRows = deferred<Response>();
    fixture.execute = call => call.table === "user_subjects" && !isWrite(call) ? oldRows.promise : responseFor(call);
    let refresh!: Promise<unknown>;
    act(() => { refresh = result.current.refetch(); });
    await waitFor(() => expect(fixture.calls.filter(call => call.table === "user_subjects" && !isWrite(call))).toHaveLength(2));
    await act(async () => { await result.current.saveOrUpdateSubject("Biology", "#005ea8", "AQA"); });
    await waitFor(() => expect(result.current.subjects[0]).toMatchObject({ subject_color: "#005ea8", exam_board: "AQA" }));
    await act(async () => { oldRows.resolve({ data: [subject], error: null }); await refresh; });
    expect(result.current.subjects[0]).toMatchObject({ subject_color: "#005ea8", exam_board: "AQA" });
    expect(workspaceQueryClient(store).getQueryData(["workspace-subjects"])).toEqual(result.current.subjects);
    expect(fixture.calls.some(call => call.table === "user_subjects" && isWrite(call) && hasFilter(call, "id", subject.id))).toBe(true);
  });

  it("does not let an older profile refresh restore a profile after confirmed deletion", async () => {
    const store = storeFor();
    const { result } = renderHook(() => useSubjectProfiles(), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(result.current.examProfiles).toHaveLength(1));
    const oldRows = deferred<Response>();
    fixture.execute = call => call.table === "subject_exam_profiles" && !isWrite(call) ? oldRows.promise : responseFor(call);
    let refresh!: Promise<unknown>;
    act(() => { refresh = result.current.refetch(); });
    await waitFor(() => expect(fixture.calls.filter(call => call.table === "subject_exam_profiles" && !isWrite(call))).toHaveLength(2));
    await act(async () => { await result.current.deleteProfile(profile.id); });
    await waitFor(() => expect(result.current.examProfiles).toHaveLength(0));
    await act(async () => { oldRows.resolve({ data: [profile], error: null }); await refresh; });
    expect(result.current.examProfiles).toHaveLength(0);
    expect(result.current.masterTopics).toEqual([topic]);
    expect(fixture.calls.some(call => call.table === "subject_exam_profiles" && isWrite(call) && hasFilter(call, "id", profile.id))).toBe(true);
  });

  it.each([
    { state: "unsaved", save: false },
    { state: "confirmed saved", save: true },
  ])("preserves $state account edits when an older account read returns", async ({ save }) => {
    const store = storeFor();
    const client = workspaceQueryClient(store);
    const account = {
      user: { id: "alice", email: "alice@example.test" },
      profile: { first_name: "Alice", last_name: "Example", display_name: "Alice Example", student_code: "AE1234", avatar_url: null },
      avatarUrl: null,
    };
    client.setQueryData(["workspace-account"], account, { updatedAt: Date.now() - 60_000 });
    const staleRead = deferred<Response>();
    fixture.execute = call => call.table === "user_profiles" && !isWrite(call) ? staleRead.promise : responseFor(call);
    render(createElement(AccountSection), { wrapper: wrapperFor(store) });
    await waitFor(() => expect(fixture.calls.filter(call => call.table === "user_profiles")).toHaveLength(1));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alicia" } });
    if (save) {
      fireEvent.click(await screen.findByRole("button", { name: "Save changes" }));
      await waitFor(() => expect(fixture.updatePreference).toHaveBeenCalledWith({ display_name: "Alicia Example" }));
      expect(fixture.calls.some(call => call.table === "user_profiles" && isWrite(call) && hasFilter(call, "id", "alice"))).toBe(true);
    }
    await act(async () => {
      staleRead.resolve({ data: { ...account.profile, first_name: "Stale name" }, error: null });
      await staleRead.promise;
    });
    expect(screen.getByLabelText("First name")).toHaveValue("Alicia");
    expect(screen.getByLabelText("Last name")).toHaveValue("Example");
    if (save) {
      expect(client.getQueryData(["workspace-account"])).toMatchObject({ profile: { first_name: "Alicia" } });
      expect(screen.queryByText("Couldn’t refresh your account details. Your edits are still here.")).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
      expect(fixture.calls.every(call => !isWrite(call))).toBe(true);
    }
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.invoke).not.toHaveBeenCalled();
  });

  it("prepares libraries and classes using read-only metadata without publication, recovery or model calls", async () => {
    fixture.execute = libraryAndClassResponseFor;
    const store = storeFor();
    const client = workspaceQueryClient(store);
    const [exams, quizzes, classes] = await Promise.all([
      client.fetchQuery(examLibraryQuery(store)), client.fetchQuery(quizLibraryQuery(store)), client.fetchQuery(classesQuery(store)),
    ]);
    expect(exams.statesMap.get("draft-1")).toBe("not-started");
    expect(exams.progressMap.get("draft-1")?.totalMarks).toBe(3);
    expect(quizzes.totalMarks["quiz-1"]).toBe(2);
    expect(classes.groups[0].id).toBe("group-1");
    expect(classes.assignments[0].exam_id).toBe("exam-1");
    expect(fixture.calls.every(call => !isWrite(call))).toBe(true);
    expect(fixture.invoke).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
    expect(fixture.calls.some(call => call.table === "exam_submissions" || call.table === "exam_questions")).toBe(false);
    const metadataReads = fixture.calls.filter(call => ["exam_question_metadata", "practice_questions", "student_answers"].includes(call.table));
    expect(metadataReads).toHaveLength(3);
    for (const call of metadataReads) {
      const columns = call.steps.find(([method]) => method === "select")?.[1];
      expect(columns).not.toBe("*");
      expect(String(columns)).not.toMatch(/correct_answer|mark_scheme|answer_text|feedback|solution/);
    }
    expect(fixture.calls.filter(call => ["student_answers", "exam_submission_metadata", "question_feedback_threads"].includes(call.table)).every(call => hasFilter(call, "student_id", "alice"))).toBe(true);
  });

  it("does not request dependent class data when no active groups exist", async () => {
    const store = storeFor();
    const result = await workspaceQueryClient(store).fetchQuery(classesQuery(store));
    expect(result.groups).toEqual([]);
    expect(fixture.calls.map(call => call.table).sort()).toEqual(["group_members", "user_profiles"]);
    expect(fixture.calls.some(call => call.steps.some(([method]) => method === "in"))).toBe(false);
  });

  it.each(["group_members", "exam_assignments", "exam_submission_metadata"])("rejects a %s error instead of caching partial class data as success", async table => {
    fixture.execute = call => call.table === table
      ? { data: null, error: new Error(`Unavailable ${table}`) }
      : libraryAndClassResponseFor(call);
    const store = storeFor();
    const client = workspaceQueryClient(store);
    await expect(client.fetchQuery(classesQuery(store))).rejects.toThrow(`Unavailable ${table}`);
    expect(client.getQueryData(["workspace-classes"])).toBeUndefined();
    expect(fixture.calls.every(call => !isWrite(call))).toBe(true);
  });
});
