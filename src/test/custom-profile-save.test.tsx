import type { PropsWithChildren } from "react";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSubjectProfiles, type ExamProfile } from "@/hooks/useSubjectProfiles";
import {
  buildCustomProfilePayload, preserveCustomProfilePayload,
  type ProfileSaveArgs, type ProfileSavePayload, type ProfileSaveResult,
} from "@/lib/custom-profile-save";
import SubjectDetail from "@/pages/SubjectDetail";

type Call = { kind?: "insert" | "update"; payload?: Record<string, unknown>; id?: string };
const backend = vi.hoisted(() => ({
  client: null as QueryClient | null,
  calls: [] as Call[],
  responses: [] as ({ data: ExamProfile | null; error: unknown } | Error)[],
  getUser: vi.fn(), success: vi.fn(), error: vi.fn(),
  modal: null as null | {
    open: boolean;
    initialData?: unknown;
    onSave: (...args: ProfileSaveArgs) => Promise<ProfileSaveResult>;
    onOpenChange: (open: boolean) => void;
  },
}));

vi.mock("@/hooks/use-workspace-query-client", () => ({
  useWorkspaceQueryScope: () => ({ client: backend.client, store: {} }),
}));
vi.mock("@/lib/workspace-summary-queries", () => ({
  profilesQuery: () => ({
    queryKey: ["workspace-profiles"], staleTime: Infinity,
    queryFn: async () => ({ masterTopics: [], examProfiles: [] }),
  }),
}));
vi.mock("sonner", () => ({ toast: { success: backend.success, error: backend.error } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: backend.getUser },
  from: () => {
    const call: Call = {};
    backend.calls.push(call);
    const execute = async () => {
      const response = backend.responses.shift();
      if (!response) throw new Error("Unexpected database request");
      if (response instanceof Error) throw response;
      return response;
    };
    const query = {
      insert: (payload: Record<string, unknown>) => { Object.assign(call, { kind: "insert", payload }); return query; },
      update: (payload: Record<string, unknown>) => { Object.assign(call, { kind: "update", payload }); return query; },
      eq: (_key: string, id: string) => { call.id = id; return query; },
      select: () => query, single: execute, maybeSingle: execute,
    };
    return query;
  },
} }));
vi.mock("@/components/dashboard/DashboardLayout", () => ({ DashboardLayout: ({ children }: PropsWithChildren) => <>{children}</> }));
vi.mock("@/lib/EditSubjectModal", () => ({ EditSubjectModal: () => null }));
vi.mock("@/hooks/useUserSubjects", () => ({ useUserSubjects: () => ({
  subjects: [{ id: "subject", subject_name: "Biology", subject_color: "green", exam_board: "AQA" }],
  isLoading: false, refetch: vi.fn(),
}) }));
vi.mock("@/hooks/useSubjectAverage", () => ({ useSubjectAverage: () => ({ percentage: null }) }));
vi.mock("@/hooks/useTopicPerformance", () => ({ useTopicPerformance: () => ({
  getPerformance: () => ({ percentage: 0, questionsAttempted: 0 }),
}) }));
vi.mock("@/components/stats/ExamProfileModal", () => ({ ExamProfileModal: (props: typeof backend.modal) => {
  backend.modal = props;
  return null;
} }));
vi.mock("@/components/subjects/ExamProfileCarousel", () => ({ ExamProfileCarousel: () => null }));
vi.mock("@/components/subjects/ExamProfileList", () => ({ ExamProfileList: ({ profiles, onEdit }: {
  profiles: ExamProfile[]; onEdit: (profile: ExamProfile) => void;
}) => <button onClick={() => onEdit(profiles[0])}>Edit saved profile</button> }));
vi.mock("@/components/subjects/TopicMasteryGrid", () => ({ TopicMasteryGrid: () => null }));
vi.mock("@/components/subjects/RecentActivityList", () => ({ RecentActivityList: () => null }));

const saveArgs: ProfileSaveArgs = ["Paper", [" Cells  ", "cells", "A/B"], 8, "My qualification", 0];
const openingPayload = () => buildCustomProfilePayload(...saveArgs);
const row = (changes: Partial<ExamProfile> = {}): ExamProfile => ({
  ...openingPayload(), id: "profile-1", subject_name: "Biology",
  created_at: "old", updated_at: "old", ...changes,
});
const respond = (data: ExamProfile | null, error: unknown = null) => backend.responses.push({ data, error });
const cachedProfiles = () => backend.client!.getQueryData<{ examProfiles: ExamProfile[] }>(["workspace-profiles"])!.examProfiles;
const seedProfiles = (profiles: ExamProfile[]) => backend.client!.setQueryData(["workspace-profiles"], { masterTopics: [], examProfiles: profiles });

beforeEach(() => {
  backend.client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seedProfiles([]);
  backend.calls = [];
  backend.responses = [];
  backend.modal = null;
  backend.getUser.mockReset().mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  backend.success.mockClear();
  backend.error.mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { cleanup(); backend.client!.clear(); vi.restoreAllMocks(); });

describe("custom profile payload preservation", () => {
  it("preserves all unchanged raw fields, nulls, zeroes, qualification and exact topic strings", () => {
    const opening = openingPayload();
    const saved: ProfileSavePayload = {
      ...opening, educational_tier: " Custom / local qualification ", topics: [" Cells  ", "cells", "A/B"],
      question_count: 0, written_question_count: null, time_limit_minutes: 0,
      structure_preset: null, mcq_count: null, mcq_position: "legacy-position",
      mark_distribution: null, include_extended: null, extended_marks: null,
      difficulty_progression: null, calculator_policy: null, question_structure: null,
      parent_question_count: 0, max_parts_per_question: null, mcq_options_count: 0,
      include_graphs: null, include_tables: null, assessment_tier: "Higher", exam_board: null,
      studied_texts: [{ title: "A text", role: "custom", extra: "metadata" }],
      paper_blueprint: { legacy: { future: true }, topicEdits: "malformed legacy value" },
    };
    const result = preserveCustomProfilePayload(saved, opening, { ...opening, profile_name: "Renamed" });
    expect(result).toEqual({ ...saved, profile_name: "Renamed" });
  });

  it("writes only intentional scalar/topic changes without trimming or deduplicating", () => {
    const opening = openingPayload();
    const saved = { ...opening, educational_tier: "Legacy", calculator_policy: null };
    const topics = ["  New exact topic", "New exact topic", "new exact topic"];
    const result = preserveCustomProfilePayload(saved, opening, { ...opening, topics, educational_tier: "Another arbitrary course", time_limit_minutes: null });
    expect(result).toEqual({ ...saved, topics, educational_tier: "Another arbitrary course", time_limit_minutes: null });
  });

  it("patches nested fields and stable section/question slots without losing hidden metadata", () => {
    const opening = { ...openingPayload(), paper_blueprint: {
      sections: [{ title: "A", questions: [{ marks: 4, style: "Essay" }, { marks: 4, style: "Essay" }] }],
      courseSelection: { courseId: "custom" },
    } };
    const saved = { ...opening, paper_blueprint: {
      future: { version: 9 },
      sections: [{ title: "A", sectionExtra: true, questions: [
        { marks: 4, style: "Essay", rubric: "first" }, { marks: 4, style: "Essay", rubric: "second" },
      ] }], courseSelection: { courseId: "custom", nestedExtra: 0 },
    } };
    const current = { ...opening, paper_blueprint: {
      sections: [{ title: "Renamed", questions: [{ marks: 7, style: "Essay" }, { marks: 4, style: "Essay" }] }],
      courseSelection: { courseId: "other" }, topicEdits: [{ topic: " Cells  ", label: "My cells" }],
    } };
    const snapshot = JSON.stringify(saved);
    expect(preserveCustomProfilePayload(saved, opening, current).paper_blueprint).toEqual({
      future: { version: 9 }, sections: [{ title: "Renamed", sectionExtra: true, questions: [
        { marks: 7, style: "Essay", rubric: "first" }, { marks: 4, style: "Essay", rubric: "second" },
      ] }], courseSelection: { courseId: "other", nestedExtra: 0 }, topicEdits: current.paper_blueprint.topicEdits,
    });
    expect(JSON.stringify(saved)).toBe(snapshot);
  });

  it("treats other arrays and changed-cardinality question lists as atomic", () => {
    const opening = { ...openingPayload(), paper_blueprint: { topics: ["A", "B"], sections: [{ title: "A", questions: [{ marks: 1 }, { marks: 2 }] }] } };
    const saved = { ...opening, paper_blueprint: { ...opening.paper_blueprint, sections: [{ title: "A", extra: true, questions: [{ marks: 1, extra: "first" }, { marks: 2, extra: "second" }] }] } };
    const current = { ...opening, paper_blueprint: { topics: ["C"], sections: [{ title: "A", questions: [{ marks: 2 }] }] } };
    expect(preserveCustomProfilePayload(saved, opening, current).paper_blueprint).toEqual({
      topics: ["C"], sections: [{ title: "A", extra: true, questions: [{ marks: 2 }] }],
    });
  });

  it("keeps metadata attached to IDs when questions reorder and avoids inheriting it for new IDs", () => {
    const opening = { ...openingPayload(), paper_blueprint: { sections: [{ questions: [{ id: "a", marks: 1 }, { id: "b", marks: 2 }] }] } };
    const saved = { ...opening, paper_blueprint: { sections: [{ questions: [{ id: "a", marks: 1, rubric: "A" }, { id: "b", marks: 2, rubric: "B" }] }] } };
    const current = { ...opening, paper_blueprint: { sections: [{ questions: [{ id: "b", marks: 3 }, { id: "new", marks: 1 }] }] } };
    expect(preserveCustomProfilePayload(saved, opening, current).paper_blueprint).toEqual({
      sections: [{ questions: [{ id: "b", marks: 3, rubric: "B" }, { id: "new", marks: 1 }] }],
    });
  });

  it("does not mistake a marks edit matching another question for a reorder", () => {
    const opening = { ...openingPayload(), paper_blueprint: { sections: [{ questions: [{ marks: 1 }, { marks: 2 }] }] } };
    const saved = { ...opening, paper_blueprint: { sections: [{ questions: [{ marks: 1, rubric: "A" }, { marks: 2, rubric: "B" }] }] } };
    const current = { ...opening, paper_blueprint: { sections: [{ questions: [{ marks: 2 }, { marks: 2 }] }] } };
    expect(preserveCustomProfilePayload(saved, opening, current).paper_blueprint).toEqual({
      sections: [{ questions: [{ marks: 2, rubric: "A" }, { marks: 2, rubric: "B" }] }],
    });
    const reordered = { ...opening, paper_blueprint: { sections: [{ questions: [{ marks: 2 }, { marks: 1 }] }] } };
    expect(preserveCustomProfilePayload(saved, opening, reordered).paper_blueprint).toEqual({
      sections: [{ questions: [{ marks: 2, rubric: "B" }, { marks: 1, rubric: "A" }] }],
    });
  });

  it("removes intentionally disabled layout fields while retaining unrepresented blueprint data", () => {
    const opening = { ...openingPayload(), paper_blueprint: { sections: [{ title: "A", questions: [{ marks: 4 }] }] } };
    const saved = { ...opening, paper_blueprint: { ...opening.paper_blueprint, future: true, topicEdits: [{ topic: "A", label: "Alias" }] } };
    expect(preserveCustomProfilePayload(saved, opening, { ...opening, paper_blueprint: null }).paper_blueprint)
      .toEqual({ future: true, topicEdits: [{ topic: "A", label: "Alias" }] });
  });

  it("guided application owns generated values and removes stale known contract keys", () => {
    const opening = openingPayload();
    const saved = { ...opening, mcq_count: null, calculator_policy: null, paper_blueprint: {
      paperContract: { legacy: true, mode: "full_mock", contractVersion: 1 }, courseSelection: { courseId: "old" },
      sections: [{ title: "Old" }], responseFormats: "old", visualAssessment: "old",
      biologyBCustomSettings: { stale: true }, future: true,
    } };
    const current = { ...opening, paper_blueprint: { paperContract: { courseId: "new" } } };
    expect(preserveCustomProfilePayload(saved, opening, current, { mode: "guided" })).toEqual({
      ...current, paper_blueprint: { paperContract: { courseId: "new", legacy: true }, future: true },
    });
  });

  it("explicit configuration changes clean hidden old contracts but preserve unrelated raw scalar fields", () => {
    const opening = openingPayload();
    const saved = { ...opening, calculator_policy: null, mark_distribution: null,
      paper_blueprint: { paperContract: { unrecognised: true }, courseSelection: { courseId: "old" }, future: true },
    };
    const current = { ...opening, educational_tier: "New course" };
    expect(preserveCustomProfilePayload(saved, opening, current, { blueprintConfigurationChanged: true }))
      .toEqual({ ...saved, educational_tier: "New course", paper_blueprint: { future: true } });
  });

  it.each(["custom", "guided"] as const)("preserves unchanged raw manual metadata during %s blueprint conversion", mode => {
    const visibleEdits = [{ topic: "A", label: "Alias" }];
    const opening = { ...openingPayload(), paper_blueprint: { topicEdits: visibleEdits } };
    const rawEdits = [{ topic: "A", label: "Alias", future: true }, null, "unrecognised"];
    const saved = { ...opening, paper_blueprint: { topicEdits: rawEdits, paperContract: { mode: "old" } } };
    const current = { ...opening, paper_blueprint: { topicEdits: visibleEdits, courseSelection: { courseId: "new" } } };
    expect(preserveCustomProfilePayload(saved, opening, current, { mode, blueprintConfigurationChanged: true }).paper_blueprint)
      .toEqual({ topicEdits: rawEdits, courseSelection: { courseId: "new" } });
    expect(saved.paper_blueprint.paperContract).toEqual({ mode: "old" });
  });

  it("maps an absent initial record to a complete defaulted payload", () => {
    expect(preserveCustomProfilePayload(undefined, {}, { profile_name: "New", topics: ["A"], question_count: 0 }))
      .toEqual({ ...buildCustomProfilePayload("New", ["A"], 0) });
  });

  it("uses a carried patch losslessly but only allows editable columns", () => {
    const patch = { ...openingPayload(), educational_tier: " Raw arbitrary qualification ",
      written_question_count: null, mcq_count: null, include_graphs: null, studied_texts: null,
      paper_blueprint: { topicEdits: [{ topic: "A", label: "Label" }], future: [0, null] },
      id: "injected", user_id: "other", subject_name: "other", profile_template: { bad: true },
    };
    const { id, user_id, subject_name, profile_template, ...expected } = patch;
    expect(buildCustomProfilePayload("ignored", [], 99, undefined, undefined, { profilePatch: patch })).toEqual(expected);
    expect(buildCustomProfilePayload("Paper", [], 0, null, 0, { mcqCount: null, examBoard: null }, null, { parentQuestionCount: null, includeGraphs: false }))
      .toMatchObject({ question_count: 0, educational_tier: null, time_limit_minutes: 0, mcq_count: null, written_question_count: null, parent_question_count: null, include_graphs: false });
  });
});

describe("useSubjectProfiles save outcomes", () => {
  it("returns success and updates the real query cache after create", async () => {
    respond(row());
    const { result } = renderHook(useSubjectProfiles);
    let outcome: ProfileSaveResult;
    await act(async () => { outcome = await result.current.createProfile("Biology", ...saveArgs); });
    expect(outcome!).toEqual({ ok: true, profileId: "profile-1" });
    expect(cachedProfiles()).toEqual([row()]);
    expect(backend.calls[0].payload).toMatchObject({ subject_name: "Biology", user_id: "owner", educational_tier: "My qualification", time_limit_minutes: 0 });
    expect(backend.calls[0].payload).not.toHaveProperty("assessment_tier");
    expect(backend.success).toHaveBeenCalledOnce();
  });

  it.each(["signed out", "auth error", "database error", "network error", "missing row"])("returns explicit failure for %s during create", async failure => {
    if (failure === "signed out") backend.getUser.mockResolvedValue({ data: { user: null }, error: null });
    else if (failure === "auth error") backend.getUser.mockResolvedValue({ data: { user: null }, error: new Error("Auth failed") });
    else if (failure === "database error") respond(null, { message: "Write failed" });
    else if (failure === "network error") backend.responses.push(new Error("Offline"));
    else respond(null);
    const { result } = renderHook(useSubjectProfiles);
    let outcome: ProfileSaveResult;
    await act(async () => { outcome = await result.current.createProfile("Biology", ...saveArgs); });
    expect(outcome!).toMatchObject({ ok: false, message: expect.any(String) });
    expect(outcome!.profileId).toBeUndefined();
    expect(cachedProfiles()).toEqual([]);
    expect(backend.success).not.toHaveBeenCalled();
  });

  it.each(["database", "unsupported", "network", "missing row"])("reports a partial create for a %s tier failure and supports updating its returned ID", async failure => {
    respond(row());
    if (failure === "network") backend.responses.push(new Error("Offline"));
    else respond(null, failure === "missing row" ? null : failure === "unsupported"
      ? { code: "42703", message: "assessment_tier does not exist" }
      : { code: "42501", message: "assessment_tier permission denied" });
    const args: ProfileSaveArgs = [...saveArgs];
    args[5] = { assessmentTier: "higher" };
    const { result } = renderHook(useSubjectProfiles);
    let partial: ProfileSaveResult;
    await act(async () => { partial = await result.current.createProfile("Biology", ...args); });
    expect(partial!).toMatchObject({ ok: false, profileId: "profile-1", message: expect.stringContaining("Profile created, but") });
    expect(cachedProfiles()).toEqual([row()]);
    expect(backend.success).not.toHaveBeenCalled();
    respond(row()); respond(row({ assessment_tier: "higher" }));
    let retried: ProfileSaveResult;
    await act(async () => { retried = await result.current.updateProfile(partial!.profileId!, buildCustomProfilePayload(...args)); });
    expect(retried!).toEqual({ ok: true, profileId: "profile-1" });
    expect(backend.calls.filter(call => call.kind === "insert")).toHaveLength(1);
    expect(cachedProfiles()).toEqual([row({ assessment_tier: "higher" })]);
  });

  it("returns success only after the requested tier succeeds", async () => {
    respond(row()); respond(row({ assessment_tier: "higher" }));
    const { result } = renderHook(useSubjectProfiles);
    let outcome: ProfileSaveResult;
    await act(async () => { outcome = await result.current.createProfile("Biology", "Paper", [], 8, "level2", null, { assessmentTier: "higher" }); });
    expect(outcome!).toEqual({ ok: true, profileId: "profile-1" });
    expect(cachedProfiles()[0].assessment_tier).toBe("higher");
  });

  it("preserves an unchanged raw tier and does not write a tier when omitted", async () => {
    seedProfiles([row({ assessment_tier: "Higher" })]);
    const { result } = renderHook(useSubjectProfiles);
    respond(row({ assessment_tier: "Higher", profile_name: "Rename" }));
    await act(async () => { expect(await result.current.updateProfile("profile-1", { profile_name: "Rename", assessment_tier: "Higher" })).toEqual({ ok: true, profileId: "profile-1" }); });
    respond(row({ assessment_tier: "Higher", profile_name: "Again" }));
    await act(async () => { expect(await result.current.updateProfile("profile-1", { profile_name: "Again" })).toEqual({ ok: true, profileId: "profile-1" }); });
    expect(backend.calls.map(call => call.payload)).toEqual([{ profile_name: "Rename" }, { profile_name: "Again" }]);
    expect(cachedProfiles()[0].assessment_tier).toBe("Higher");
  });

  it.each(["higher", "invalid legacy tier"])("supports explicit tier clearing from %s without a core update", async tier => {
    seedProfiles([row({ assessment_tier: tier })]);
    respond(row({ assessment_tier: tier })); respond(row());
    const { result } = renderHook(useSubjectProfiles);
    await act(async () => { expect(await result.current.updateProfile("profile-1", { assessment_tier: null })).toEqual({ ok: true, profileId: "profile-1" }); });
    expect(backend.calls.map(call => call.payload)).toEqual([undefined, { assessment_tier: null }]);
    expect(cachedProfiles()[0].assessment_tier).toBeNull();
  });

  it.each(["core", "tier", "missing row"])("reports an update failure at %s without a success toast", async failure => {
    seedProfiles([row()]);
    if (failure === "core") respond(null, { message: "Denied" });
    else if (failure === "missing row") respond(null);
    else { respond(row({ profile_name: "Changed" })); respond(null, { code: "42501", message: "Denied" }); }
    const { result } = renderHook(useSubjectProfiles);
    let outcome: ProfileSaveResult;
    await act(async () => { outcome = await result.current.updateProfile("profile-1", { profile_name: "Changed", assessment_tier: "higher" }); });
    expect(outcome!).toMatchObject({ ok: false, profileId: "profile-1", message: expect.stringContaining(failure === "tier" ? "Profile saved, but" : "Failed to update") });
    expect(cachedProfiles()[0].profile_name).toBe(failure === "tier" ? "Changed" : "Paper");
    expect(backend.success).not.toHaveBeenCalled();
  });

  it("returns the inserted ID even if the local cache update fails", async () => {
    respond(row());
    vi.spyOn(backend.client!, "cancelQueries").mockRejectedValueOnce(new Error("Cache failed"));
    const { result } = renderHook(useSubjectProfiles);
    await act(async () => {
      expect(await result.current.createProfile("Biology", ...saveArgs)).toMatchObject({
        ok: false, profileId: "profile-1", message: expect.stringContaining("Profile created, but"),
      });
    });
    respond(row());
    await act(async () => { expect(await result.current.updateProfile("profile-1", { profile_name: "Paper" })).toEqual({ ok: true, profileId: "profile-1" }); });
    expect(cachedProfiles()).toEqual([row()]);
  });

  it("uses authenticated ownership and editable patch fields in the actual insert", async () => {
    const patch = { ...openingPayload(), user_id: "other", id: "foreign-profile", subject_name: "Other subject", profile_template: { presetId: "other" } };
    respond(row());
    const { result } = renderHook(useSubjectProfiles);
    await act(async () => { expect(await result.current.createProfile("Biology", "Paper", [], 8, undefined, undefined, { profilePatch: patch })).toEqual({ ok: true, profileId: "profile-1" }); });
    expect(backend.calls[0].payload).toMatchObject({ user_id: "owner", subject_name: "Biology" });
    expect(backend.calls[0].payload).not.toHaveProperty("id");
    expect(backend.calls[0].payload).not.toHaveProperty("profile_template");
  });
});

function renderSubject() {
  render(<MemoryRouter initialEntries={["/subjects/Biology"]}><Routes>
    <Route path="/subjects/:subjectName" element={<SubjectDetail />} />
  </Routes></MemoryRouter>);
}

describe("SubjectDetail production save callback", () => {
  it("returns the real outcome and updates the inserted row on every partial-create retry", async () => {
    renderSubject();
    fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
    await waitFor(() => expect(backend.modal?.open).toBe(true));
    const args: ProfileSaveArgs = [...saveArgs]; args[5] = { assessmentTier: "higher" };
    respond(row()); respond(null, { code: "42501", message: "Denied" });
    let outcome: ProfileSaveResult;
    await act(async () => { outcome = await backend.modal!.onSave(...args); });
    expect(outcome!).toMatchObject({ ok: false, profileId: "profile-1" });
    expect(backend.modal!.initialData).toBeUndefined();
    expect(backend.modal!.open).toBe(true);
    respond(row()); respond(null, { code: "42501", message: "Denied again" });
    await act(async () => { expect(await backend.modal!.onSave(...args)).toMatchObject({ ok: false, profileId: "profile-1" }); });
    respond(row()); respond(row({ assessment_tier: "higher" }));
    await act(async () => { expect(await backend.modal!.onSave(...args)).toEqual({ ok: true, profileId: "profile-1" }); });
    expect(backend.calls.filter(call => call.kind === "insert")).toHaveLength(1);
    expect(backend.calls.filter(call => call.kind === "update").every(call => call.id === "profile-1")).toBe(true);
    await act(async () => backend.modal!.onOpenChange(false));
    fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
    respond(row({ id: "profile-2" }));
    await act(async () => { expect(await backend.modal!.onSave(...saveArgs)).toEqual({ ok: true, profileId: "profile-2" }); });
    expect(backend.calls.filter(call => call.kind === "insert")).toHaveLength(2);
  });

  it("passes the preserved payload to the actual update and returns its result", async () => {
    const opening = openingPayload();
    const saved = row({ educational_tier: "Legacy custom course", mcq_count: null, exam_board: null,
      paper_blueprint: { future: { version: 2 }, topicEdits: [{ topic: " Cells  ", label: "My label" }] },
    });
    seedProfiles([saved]);
    renderSubject();
    fireEvent.click(screen.getByRole("button", { name: "Edit saved profile" }));
    const patch = preserveCustomProfilePayload(saved, opening, { ...opening, profile_name: "Renamed" });
    const carriedPatch = { ...patch, id: "foreign-profile", user_id: "other", subject_name: "Other subject" };
    const args: ProfileSaveArgs = [...saveArgs]; args[0] = "Renamed"; args[5] = { profilePatch: carriedPatch };
    respond({ ...saved, profile_name: "Renamed" });
    await act(async () => { expect(await backend.modal!.onSave(...args)).toEqual({ ok: true, profileId: "profile-1" }); });
    const { assessment_tier, ...core } = patch;
    expect(backend.calls).toEqual([{ kind: "update", id: "profile-1", payload: core }]);
    expect(cachedProfiles()[0]).toEqual({ ...saved, profile_name: "Renamed" });
  });
});
