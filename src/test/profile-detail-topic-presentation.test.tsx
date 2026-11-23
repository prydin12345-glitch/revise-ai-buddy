import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ProfileDetail from "@/pages/ProfileDetail";
import { ProfileTopicGrid } from "@/components/subjects/ProfileTopicGrid";

const fixture = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  queries: [] as Array<{ table: string; selection: string; filters: Array<[string, unknown]> }>,
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/subjects/ProfileScoreTrend", () => ({ ProfileScoreTrend: () => null }));
vi.mock("@/components/subjects/ProfileExamList", () => ({ ProfileExamList: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "synthetic-owner" } } }) },
  from: (table: string) => {
    const read = { table, selection: "", filters: [] as Array<[string, unknown]> };
    fixture.queries.push(read);
    const query = {
      select: (selection: string) => { read.selection = selection; return query; },
      eq: (key: string, value: unknown) => { read.filters.push([key, value]); return query; },
      single: () => query,
      in: () => query,
      not: () => query,
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => {
        let data: unknown;
        switch (table) {
          case "subject_exam_profiles": data = fixture.profile; break;
          case "exam_submissions":
          case "practice_question_sets": data = []; break;
          case "student_answers": data = [{ score: 1, exam_questions: {
            topic_tag: "2.1.3 Enzyme Action (BIO101)", marks: 4, profile_id: "synthetic-profile",
          } }]; break;
          case "practice_question_answers": data = [{ score: 2, practice_questions: {
            subtopic: "2.1.3 Enzyme Action (BIO101)", marks: 6, profile_id: "synthetic-profile",
          } }]; break;
          default: throw Error(`Unexpected fixture read: ${table}`);
        }
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  },
} }));

const canonical = "2.1.3 Enzyme Action (BIO101)";
const unstarted = "DNA & RNA";
const alias = "My Enzyme Revision";
const privateNote = "Private owner reminder, never part of quiz navigation.";
const profileTopics = [canonical, unstarted];

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function Destination() {
  const location = useLocation();
  return <output aria-label="Quiz destination">{location.pathname + location.search}</output>;
}

function open() {
  return render(<MemoryRouter initialEntries={["/my-subjects/Biology/synthetic-profile"]}>
    <Routes>
      <Route path="/my-subjects/:subjectName/:profileId" element={<ProfileDetail />} />
      <Route path="/create-practice-questions" element={<Destination />} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  fixture.queries = [];
  fixture.profile = {
    id: "synthetic-profile", profile_name: "Synthetic profile", topics: [...profileTopics],
    question_count: 2, educational_tier: "level3", exam_board: "OCR", time_limit_minutes: 30,
    profile_template: { template: { topics: [...profileTopics], topicEdits: [{ topic: canonical, label: alias, notes: privateNote }] } },
  };
});
afterEach(cleanup);

describe("saved profile topic display", () => {
  it("renders the saved alias while combining canonical exam/quiz scores and navigating with the canonical topic and profile ID", async () => {
    fixture.profile = freeze(fixture.profile);
    const original = JSON.stringify(fixture.profile);
    open();
    const label = await screen.findByText(alias);
    const row = label.closest("button")!;
    expect(row).toBeEnabled();
    expect(within(row).getByText("30%")).toBeVisible();
    expect(within(row).getByText("Review needed")).toBeVisible();
    expect(within(row).getByTitle("exam + quiz")).toHaveTextContent("2×");
    expect(screen.queryByText(canonical)).toBeNull();
    expect(screen.queryByText(privateNote)).toBeNull();
    const untouched = screen.getByText(unstarted).closest("button")!;
    expect(untouched).toBeDisabled();
    expect(within(untouched).getByText("Not started")).toBeVisible();

    expect(fixture.queries.find(query => query.table === "student_answers")).toMatchObject({
      selection: "score, is_correct, exam_questions!inner(topic_tag, marks, profile_id)",
      filters: [["student_id", "synthetic-owner"], ["exam_questions.profile_id", "synthetic-profile"]],
    });
    expect(fixture.queries.find(query => query.table === "practice_question_answers")).toMatchObject({
      selection: "score, is_correct, practice_questions!inner(subtopic, marks, profile_id)",
      filters: [["user_id", "synthetic-owner"], ["practice_questions.profile_id", "synthetic-profile"]],
    });
    expect(JSON.stringify(fixture.queries)).not.toContain(alias);
    expect(JSON.stringify(fixture.profile)).toBe(original);
    fireEvent.click(row);
    const destination = await screen.findByLabelText("Quiz destination");
    const url = new URL(destination.textContent!, "https://fixture.invalid");
    expect(url.pathname).toBe("/create-practice-questions");
    expect(Object.fromEntries(url.searchParams)).toEqual({ subject: "Biology", subtopic: canonical, profileId: "synthetic-profile" });
    expect(destination).not.toHaveTextContent(alias);
    expect(destination).not.toHaveTextContent(privateNote);
  });

  it.each(["unedited template", "legacy profile"])("preserves exact canonical labels and scores for an %s", async kind => {
    if (kind === "legacy profile") delete fixture.profile!.profile_template;
    else fixture.profile!.profile_template = { template: { topics: [...profileTopics] } };
    fixture.profile = freeze(fixture.profile);
    open();
    const row = (await screen.findByText(canonical)).closest("button")!;
    expect(within(row).getByText("30%")).toBeVisible();
    expect(screen.getByText(unstarted).closest("button")).toBeDisabled();
    expect(screen.queryByText(alias)).toBeNull();
    fireEvent.click(row);
    const destination = await screen.findByLabelText("Quiz destination");
    expect(new URL(destination.textContent!, "https://fixture.invalid").searchParams.get("subtopic")).toBe(canonical);
  });

  it("keeps the grid's callback optional for existing callers", async () => {
    render(<MemoryRouter><ProfileTopicGrid profileId="synthetic-profile" subjectName="Biology" profileTopics={profileTopics} /></MemoryRouter>);
    const row = (await screen.findByText(canonical)).closest("button")!;
    expect(within(row).getByText("30%")).toBeVisible();
    expect(screen.getByText(unstarted).closest("button")).toBeDisabled();
    expect(screen.queryByText(alias)).toBeNull();
  });
});
