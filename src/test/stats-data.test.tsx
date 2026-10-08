import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useExamStats } from "@/hooks/useExamStats";

const fixture = vi.hoisted(() => ({
  failedTable: "",
  calls: [] as { table: string; steps: unknown[][] }[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "fixture-user" } } }) },
    from(table: string) {
      const call = { table, steps: [] as unknown[][] };
      fixture.calls.push(call);
      let throwErrors = false;
      const q: any = {};
      for (const method of [
        "select",
        "eq",
        "gte",
        "lte",
        "not",
        "order",
        "maybeSingle",
      ])
        q[method] = (...args: unknown[]) => {
          call.steps.push([method, ...args]);
          return q;
        };
      q.throwOnError = () => {
        throwErrors = true;
        return q;
      };
      q.then = (resolve: any, reject: any) => {
        const date = new Date().toISOString();
        const error =
          fixture.failedTable === table
            ? new Error("Fixture request failure")
            : null;
        const ranged = call.steps.some((s) => s[0] === "gte");
        const data =
          table === "exams"
            ? [
                { id: "one", status: "published" },
                { id: "two", status: "published" },
                { id: "draft", status: "draft" },
              ]
            : table === "exam_submissions"
              ? ranged
                ? [
                    {
                      time_taken_seconds: 3600,
                      submitted_at: date,
                      exams: { subject_id: "Biology" },
                    },
                  ]
                : [
                    {
                      exam_id: "one",
                      total_score: 50,
                      total_marks: 100,
                      submitted_at: date,
                      exams: { subject_id: "Biology", title: "Paper 1" },
                    },
                    {
                      exam_id: "two",
                      total_score: 0,
                      total_marks: 100,
                      submitted_at: date,
                      exams: { subject_id: "Biology", title: "Paper 2" },
                    },
                    {
                      exam_id: "three",
                      total_score: 100,
                      total_marks: 100,
                      submitted_at: date,
                      exams: { subject_id: "Chemistry", title: "Practice" },
                    },
                    {
                      exam_id: "poison",
                      total_score: 25,
                      total_marks: 0,
                      submitted_at: date,
                      exams: { subject_id: "Biology", title: "Invalid total" },
                    },
                  ]
              : table === "user_subjects"
                ? [{ subject_name: "Biology", subject_color: "#15815a" }]
                : table === "revision_tasks"
                  ? [{ date, duration: 60, subject: "Biology" }]
                  : table === "practice_set_progress"
                    ? [
                        {
                          completed_at: date,
                          time_spent_seconds: 1800,
                          practice_question_sets: { subject_id: "Biology" },
                        },
                      ]
                    : table === "revision_goals"
                      ? [
                          {
                            subject: "Biology",
                            target_percentage: 70,
                            deadline: date,
                            subject_color: "#15815a",
                          },
                        ]
                      : table === "user_streaks"
                        ? {
                            current_streak: 4,
                            longest_streak: 9,
                            last_exam_submitted_at: date,
                          }
                        : [];
        return (
          throwErrors && error
            ? Promise.reject(error)
            : Promise.resolve({ data, error })
        ).then(resolve, reject);
      };
      return q;
    },
  },
}));
beforeEach(() => {
  fixture.failedTable = "";
  fixture.calls = [];
});

it("keeps existing score, zero-mark exclusion, study-time, streak and goal calculations", async () => {
  const { result } = renderHook(() => useExamStats());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBeNull();
  expect(result.current.totalExams).toBe(2);
  expect(result.current.completedExams).toBe(4);
  expect(
    result.current.subjectPerformanceData.find((s) => s.name === "Biology"),
  ).toMatchObject({ avgScore: 25, count: 2, color: "#15815a" });
  expect(
    result.current.subjectPerformanceData.find((s) => s.name === "Chemistry"),
  ).toMatchObject({ avgScore: 100, count: 1 });
  expect(
    result.current.studyActivityData.reduce(
      (sum, row) => sum + Number(row.Biology ?? 0),
      0,
    ),
  ).toBe(2.5);
  expect(result.current.currentStreak).toBe(4);
  expect(result.current.longestStreak).toBe(9);
  expect(result.current.revisionGoals[0]).toMatchObject({
    subject: "Biology",
    targetPercentage: 70,
    currentAverage: 25,
  });
  expect(result.current.bestSubject?.name).toBe("Chemistry");
});
it("preserves range filters and does not refetch or change totals when a chart range changes", async () => {
  const { result } = renderHook(() => useExamStats());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.examResultsData).toHaveLength(7);
  const calls = fixture.calls.length;
  act(() => result.current.setTimeRange("monthly"));
  expect(result.current.examResultsData.length).toBeGreaterThanOrEqual(4);
  act(() => result.current.setTimeRange("yearly"));
  expect(result.current.examResultsData).toHaveLength(12);
  expect(fixture.calls).toHaveLength(calls);
  expect(
    fixture.calls
      .filter((c) => c.table === "exam_submissions")
      .every((c) =>
        c.steps.some(
          (s) => s[0] === "eq" && s[1] === "status" && s[2] === "graded",
        ),
      ),
  ).toBe(true);
  expect(
    result.current.subjectPerformanceData.find((s) => s.name === "Biology")
      ?.avgScore,
  ).toBe(25);
});
it.each([
  "exams",
  "exam_submissions",
  "user_subjects",
  "revision_tasks",
  "practice_set_progress",
  "revision_goals",
  "user_streaks",
])(
  "surfaces a %s failure and clears the error after a successful retry",
  async (table) => {
    fixture.failedTable = table;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { result } = renderHook(() => useExamStats());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.error?.message).toBe("Fixture request failure");
      fixture.failedTable = "";
      await act(async () => {
        await result.current.refetch();
      });
      expect(result.current.error).toBeNull();
      expect(result.current.subjectPerformanceData).toHaveLength(2);
    } finally {
      log.mockRestore();
    }
  },
);
