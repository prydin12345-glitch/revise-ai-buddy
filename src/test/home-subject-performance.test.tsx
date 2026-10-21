import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
import { profileTopicRows } from "@/lib/subject-profile-topics";

const backend = vi.hoisted(() => ({ from: vi.fn(), normalize: vi.fn(), fail: "", owners: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: backend.from } }));
vi.mock("@/lib/normalise-topic", () => ({ normaliseTopicTags: backend.normalize }));

beforeEach(() => {
  backend.fail = ""; backend.owners = [];
  backend.normalize.mockReset().mockImplementation(async (tags: string[]) => Object.fromEntries(tags.map(tag => [tag, tag])));
  const date = "2026-10-01T12:00:00Z";
  const tables: Record<string, unknown[]> = {
    exam_submissions: [{ exam_id: "bio-exam" }, { exam_id: "chem-exam" }],
    student_answers: [
      { question_id: "bio", exam_id: "bio-exam", score: 2, submitted_at: date },
      { question_id: "chem", exam_id: "chem-exam", score: 0, submitted_at: date },
      { question_id: "zero", exam_id: "bio-exam", score: 0, submitted_at: date },
      { question_id: "pending", exam_id: "ungraded-exam", score: null, submitted_at: date },
    ],
    exam_questions: [
      { id: "bio", exam_id: "bio-exam", marks: 4, topic_tag: "Energy" },
      { id: "chem", exam_id: "chem-exam", marks: 4, topic_tag: "Energy" },
      { id: "zero", exam_id: "bio-exam", marks: 4, topic_tag: "Cells" },
      { id: "pending", exam_id: "ungraded-exam", marks: 4, topic_tag: "Ecology" },
    ],
    exams: [{ id: "bio-exam", subject_id: "subject-bio" }, { id: "chem-exam", subject_id: "Chemistry" }, { id: "ungraded-exam", subject_id: "Biology" }],
    practice_question_answers: [
      { question_id: "bio-practice", score: 4, submitted_at: date, is_correct: true },
      { question_id: "chem-practice", score: 0, submitted_at: date, is_correct: false },
      { question_id: "pending-practice", score: null, submitted_at: null },
    ],
    practice_questions: [
      { id: "bio-practice", set_id: "bio-set", marks: 4, subtopic: "Energy" },
      { id: "chem-practice", set_id: "chem-set", marks: 4, subtopic: "Energy" },
      { id: "pending-practice", set_id: "bio-set", marks: 4, subtopic: "Ecology" },
    ],
    practice_question_sets: [{ id: "bio-set", subject_id: "Biology" }, { id: "chem-set", subject_id: "Chemistry" }],
  };
  backend.from.mockImplementation((table: string) => {
    const query = {
      select: () => query,
      eq: (field: string, value: string) => { if (field === "student_id" || field === "user_id") backend.owners.push(value); return query; },
      in: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: tables[table] || [], error: backend.fail === table ? { message: "Read failed" } : null }).then(resolve),
    };
    return query;
  });
});
afterEach(cleanup);

describe("Home subject-scoped topic performance", () => {
  it("filters exam and practice data before combining same-named topics; accepts saved subject IDs and names", async () => {
    const { result } = renderHook(() => useUnifiedTopicPerformance("alice", [" SUBJECT-BIO ", "Biology"]));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const energy = result.current.topics.find(row => row.topic === "Energy")!;
    expect(energy).toMatchObject({ examScore: 50, practiceScore: 100, unifiedScore: 70, examQuestionCount: 1, practiceQuestionCount: 1 });
    expect(backend.owners).toEqual(["alice", "alice", "alice"]);
    expect(result.current.topics.find(row => row.topic === "Cells")).toMatchObject({ unifiedScore: 0, mastery: "weak" });
    expect(result.current.topics.find(row => row.topic === "Ecology")).toBeUndefined();
  });
  it("preserves the existing unscoped 60/40 weighting and keeps unmarked work out of grades", async () => {
    const { result } = renderHook(() => useUnifiedTopicPerformance("alice"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.topics.find(row => row.topic === "Energy")).toMatchObject({ examScore: 25, practiceScore: 50, unifiedScore: 35, examQuestionCount: 2, practiceQuestionCount: 2 });
    expect(result.current.topics.find(row => row.topic === "Ecology")).toBeUndefined();
  });
  it("isolates an explicitly selected subject and avoids refetching for equivalent alias arrays", async () => {
    const { result, rerender } = renderHook(({ aliases }) => useUnifiedTopicPerformance("alice", aliases), { initialProps: { aliases: ["Chemistry"] } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.topics).toHaveLength(1);
    expect(result.current.topics[0]).toMatchObject({ topic: "Energy", unifiedScore: 0 });
    const calls = backend.from.mock.calls.length;
    rerender({ aliases: [" chemistry ", "Chemistry"] });
    expect(backend.from.mock.calls).toHaveLength(calls);
  });
  it("reports a failed read instead of false zero scores, and can retry", async () => {
    backend.fail = "student_answers";
    const { result } = renderHook(() => useUnifiedTopicPerformance("alice", "Biology"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Couldn’t load topic performance. Try again.");
    expect(result.current.topics).toEqual([]);
    backend.fail = "";
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.error).toBeNull());
    expect(result.current.topics.length).toBeGreaterThan(0);
  });
  it("ignores a late result from the previous subject or account", async () => {
    let finish!: (map: Record<string, string>) => void;
    backend.normalize.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result, rerender } = renderHook(({ owner, subject }) => useUnifiedTopicPerformance(owner, subject), { initialProps: { owner: "alice", subject: "subject-bio" } });
    await waitFor(() => expect(finish).toBeDefined());
    rerender({ owner: "bob", subject: "Chemistry" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.topics[0]).toMatchObject({ subjectId: "Chemistry", unifiedScore: 0 });
    await act(async () => { finish({ Energy: "Energy", Cells: "Cells", Ecology: "Ecology" }); });
    expect(result.current.topics).toHaveLength(1);
    expect(result.current.topics[0].subjectId).toBe("Chemistry");
  });
  it("performs no query without an authenticated owner", async () => {
    backend.from.mockClear();
    const { result } = renderHook(() => useUnifiedTopicPerformance(null, "Biology"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(backend.from).not.toHaveBeenCalled();
    expect(result.current.topics).toEqual([]);
  });
});

it("matches profile topics case-insensitively without treating untested topics as zero or duplicating names", () => {
  const zero = { topic: "Cells", subjectId: "Biology", unifiedScore: 0, examScore: 0, practiceScore: null, examQuestionCount: 1, practiceQuestionCount: 0, mastery: "weak" as const, lastAttempted: null, practicedSinceLastExam: false };
  const rows = profileTopicRows([" cells ", "CELLS", "Ecology", ""], [zero]);
  expect(rows).toHaveLength(2);
  expect(rows[0]).toBe(zero);
  expect(rows[1]).toMatchObject({ topic: "Ecology", examScore: null, practiceScore: null, mastery: "untested" });
});
