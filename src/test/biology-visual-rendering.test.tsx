import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BiologyVisual } from "@/components/biology/BiologyVisual";
import { ResponseInput } from "@/components/responses/ResponseInput";
import { ResponseReview } from "@/components/responses/ResponseReview";
import { ImageCreditsContent } from "@/pages/ImageCredits";
import { drawResponsePDF } from "@/lib/response-pdf";
import { markResponse } from "../../supabase/functions/_shared/response-marking";
import {
  visualFixture,
  simulatedApprovedFiles,
} from "../../supabase/tests/biology-visual-fixtures";
import { useUnifiedTopicPerformance } from "@/hooks/useUnifiedTopicPerformance";
const state = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const q: any = {};
      for (const k of ["select", "eq", "in"]) q[k] = () => q;
      q.then = (resolve: any) =>
        Promise.resolve({ data: state.tables[table] ?? [], error: null }).then(
          resolve,
        );
      return q;
    },
  },
}));
vi.mock("@/lib/normalise-topic", () => ({
  normaliseTopicTags: async (tags: string[]) =>
    Object.fromEntries(tags.map((t) => [t, t])),
}));
afterEach(cleanup);
it.each(["label", "compare", "observe"] as const)(
  "renders accessible %s images and independent fields with no public answer",
  (role) => {
    const f = visualFixture(role),
      onChange = vi.fn();
    const r = render(
      <>
        <BiologyVisual resource={f.resource} />
        <ResponseInput
          questionId="q"
          definition={f.definition}
          value={null}
          onChange={onChange}
        />
      </>,
    );
    expect(screen.getAllByRole("img")).toHaveLength(role === "compare" ? 3 : 1);
    expect(screen.getAllByRole("textbox")).toHaveLength(
      role === "compare" ? 4 : 2,
    );
    expect(r.container.textContent).not.toMatch(
      /xylem|phloem|epithelial|muscle|connective/i,
    );
    for (const img of screen.getAllByRole("img"))
      expect(img.getAttribute("alt")).toMatch(/^Biological specimen/);
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "My answer" },
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].kind).toBe("fields");
  },
);
it("keyboard-accessible zoom has a title and close control and returns to the same overlay", () => {
  const f = visualFixture();
  render(<BiologyVisual resource={f.resource} />);
  fireEvent.click(screen.getByRole("button", { name: "Enlarge panel A" }));
  expect(
    screen.getByRole("dialog", { name: "Biological specimen: panel A" }),
  ).toBeVisible();
  expect(screen.getAllByRole("img")).toHaveLength(1);
  expect(document.querySelectorAll("img")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("private marking overlays render only with release AND the server-supplied key", () => {
  const f = visualFixture(),
    q = {
      id: "q",
      response_definition: f.definition,
      response_resources: [f.resource],
      response_key: f.key,
    };
  const r = render(<ResponseReview question={q} solutionsReleased={false} />);
  expect(r.container.textContent).not.toMatch(/xylem|phloem/i);
  r.rerender(<ResponseReview question={q} solutionsReleased />);
  expect(r.container.textContent).toMatch(/xylem/);
  expect(r.container.textContent).toMatch(/phloem/);
});
it("public credits provide stable ID/version, creator, licence/source and modifications", () => {
  render(
    <MemoryRouter>
      <ImageCreditsContent files={simulatedApprovedFiles()} />
    </MemoryRouter>,
  );
  expect(document.getElementById("bio_va_001-v1")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "CC0 1.0" })).toHaveLength(4);
  expect(screen.getAllByText(/Creator: Examly/)).toHaveLength(4);
  expect(
    screen.getByRole("heading", { name: "Image sourcing FAQ" }),
  ).toBeVisible();
});
it("PDF contains legible vector stimuli, answer spaces and attribution, with no private names", () => {
  const f = visualFixture("compare"),
    texts: string[] = [];
  const doc: any = {
    setFont() {},
    setFontSize() {},
    setTextColor() {},
    setDrawColor() {},
    setFillColor() {},
    setLineWidth() {},
    splitTextToSize: (s: string, w: number) =>
      s.match(new RegExp(".{1," + Math.max(8, Math.floor(w / 2)) + "}", "g")) ??
      [],
    text: (s: string) => texts.push(s),
    ellipse: vi.fn(),
    rect: vi.fn(),
    line: vi.fn(),
  };
  const y = drawResponsePDF(
    doc,
    {
      id: "q",
      response_definition: f.definition,
      response_resources: [f.resource],
      response_key: f.key,
    },
    {
      x: 20,
      y: 40,
      width: 170,
      bottom: 280,
      nextPage: () => 35,
      text: (s) => s,
    },
  );
  expect(y).toBeLessThanOrEqual(280);
  expect(texts.join(" ")).toMatch(/Panel A.*Panel B.*Panel C/);
  expect(texts.join(" ")).toContain("Examly");
  expect(texts.join(" ")).not.toMatch(/epithelial|muscle|connective|accepted/);
  expect(doc.rect).toHaveBeenCalled();
});
it("mastery receives one capped result per labelled/comparison question, never one event per field", async () => {
  const rows = [];
  for (const role of ["label", "compare"] as const) {
    const f = visualFixture(role),
      fields = Object.fromEntries(
        f.key.units.flatMap((u) =>
          u.targetIds.map((id) => [
            id,
            u.rule.kind === "text" ? u.rule.accepted[0] : "Visible evidence.",
          ]),
        ),
      ),
      result = await markResponse(
        {
          questionId: role,
          marks: f.part.marks,
          definition: f.definition,
          key: f.key,
          response: {
            version: 1,
            questionId: role,
            definitionRevision: f.definition.revision,
            kind: "fields",
            value: { fields },
          },
        },
        async (units) => ({
          units: units.map((u) => ({
            unitId: u.unitId,
            score: u.maxMarks,
            feedback: "Supported visible evidence.",
          })),
        }),
      );
    rows.push({
      question_id: role,
      score: result.score,
      is_correct: result.isCorrect,
      submitted_at: "2026-10-06T12:00:00Z",
    });
  }
  state.tables = {
    exam_submissions: [],
    student_answers: [],
    exam_questions: [],
    exams: [],
    practice_question_answers: [
      ...rows,
      { question_id: "pending", score: null, submitted_at: null },
    ],
    practice_questions: [
      { id: "label", subtopic: "Tissues", marks: 2, set_id: "p" },
      { id: "compare", subtopic: "Tissues", marks: 4, set_id: "p" },
      { id: "pending", subtopic: "Tissues", marks: 2, set_id: "p" },
    ],
    practice_question_sets: [{ id: "p", subject_id: "Biology" }],
  };
  const { result } = renderHook(() => useUnifiedTopicPerformance("student"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.topics).toEqual([
    expect.objectContaining({
      topic: "Tissues",
      practiceScore: 100,
      practiceQuestionCount: 2,
      pendingQuestionCount: 1,
    }),
  ]);
});
