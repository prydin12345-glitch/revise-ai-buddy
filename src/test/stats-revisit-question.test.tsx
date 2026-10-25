import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QuestionsToRevisit } from "@/components/stats/QuestionsToRevisit";
import { legacyExpectedAnswer, readReleasedRevisit } from "@/lib/revisit-question";
import { responseFixture, responseQuestion } from "../../supabase/tests/response-foundation-fixtures";
import type { StatsWrongQuestion } from "@/lib/subject-profile-stats";

const state = vi.hoisted(() => ({ invoke: vi.fn(), insert: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: (...args: unknown[]) => state.invoke(...args) },
  from: (table: string) => { if (table !== "exams") throw new Error("No raw question queries allowed"); return { select: (columns: string) => { if (columns !== "insert_figures") throw new Error("No private columns"); return { eq: () => ({ single: () => state.insert() }) }; } }; },
} }));
vi.mock("@/components/MathRenderer", () => ({ MathRenderer: ({ content }: { content: string }) => <div>{content}</div> }));
vi.mock("@/components/biology/AssessmentBiologyFigure", () => ({ AssessmentBiologyFigure: () => null }));
vi.mock("@/components/maths", () => ({ MathsFigurePanel: () => null }));
vi.mock("@/components/mechanics", () => ({ MechanicsFigurePanel: () => null, detectDiagramConfig: () => null }));
vi.mock("@/components/circuit", () => ({ CircuitFigurePanel: () => null }));
vi.mock("@/components/circuit/getCircuitConfig", () => ({ getCircuitConfig: () => null }));
vi.mock("@/components/physics", () => ({ PhysicsFigurePanel: () => null }));
vi.mock("@/components/economics/EconomicsFigurePanel", () => ({ EconomicsFigurePanel: () => null }));
vi.mock("@/components/insert/InsertPanel", () => ({ InsertPanel: () => null }));

const row: StatsWrongQuestion = { examId: "exam-1", questionId: "question-1", profileId: "profile-1", subject: "Biology", topic: "Enzymes", questionNumber: "2(b)", score: 1, marks: 3, date: "2026-10-23T12:00:00Z", examTitle: "Cells exam", profileName: "Paper 1 full mock" };
const payload = () => ({ scoresHidden: false, submission: { status: "graded" }, questions: [{ id: row.questionId, exam_id: row.examId, question_number: row.questionNumber, question_text: "Explain the change in enzyme activity.", marks: 3, correct_answer: "The active site changes shape." }], existingAnswers: [{ question_id: row.questionId, answer_text: "The enzyme changes.", score: 1 }] });
beforeAll(async () => { await import("@/components/stats/QuestionRevisitContent"); });
beforeEach(() => { state.invoke.mockReset(); state.insert.mockReset(); state.invoke.mockResolvedValue({ data: payload(), error: null }); state.insert.mockResolvedValue({ data: { insert_figures: [] }, error: null }); });
afterEach(cleanup);

function view(questions = [row], scope = "owner:biology:profile-1") { return <MemoryRouter><QuestionsToRevisit questions={questions} scopeKey={scope}/></MemoryRouter>; }

describe("Questions to revisit", () => {
  it("shows metadata without requesting any expected answers until a question is opened", async () => {
    render(view());
    expect(screen.getByRole("button", { name: "Review question 2(b): Enzymes" })).toHaveTextContent("1/3");
    expect(state.invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    expect(await screen.findByText("The active site changes shape.")).toBeVisible();
    expect(state.invoke).toHaveBeenCalledWith("get-exam-questions", { body: { examId: row.examId } });
    expect(screen.getByRole("link", { name: "Open full exam review" })).toHaveAttribute("href", "/exam/exam-1/review?q=2(b)");
  });
  it("reauthorises on every open and never exposes a stale key when release changes", async () => {
    render(view());
    const open = screen.getByRole("button", { name: "Review question 2(b): Enzymes" });
    fireEvent.click(open); await screen.findByText("The active site changes shape.");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    state.invoke.mockResolvedValue({ data: { ...payload(), scoresHidden: true }, error: null });
    fireEvent.click(open);
    expect(await screen.findByRole("alert")).toHaveTextContent("not released yet");
    expect(screen.queryByText("The active site changes shape.")).toBeNull();
    expect(state.invoke).toHaveBeenCalledTimes(2);
  });
  it("clears an open review immediately when the account/subject/profile scope changes", async () => {
    const v = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    await screen.findByText("The active site changes shape.");
    v.rerender(view([], "different-owner:chemistry:profile-2"));
    expect(screen.queryByText("The active site changes shape.")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("drops an open solution when refreshed metadata removes its eligible row", async () => {
    const v = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    await screen.findByText("The active site changes shape.");
    v.rerender(view([]));
    expect(screen.queryByText("The active site changes shape.")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("ignores a late released response after switching scope", async () => {
    let resolve!: (value: unknown) => void;
    state.invoke.mockImplementation(() => new Promise(r => { resolve = r; }));
    const v = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    await waitFor(() => expect(state.invoke).toHaveBeenCalled());
    v.rerender(view([], "other-scope"));
    resolve({ data: payload(), error: null });
    await waitFor(() => expect(screen.queryByText("The active site changes shape.")).toBeNull());
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("supports retry without a raw private-question query", async () => {
    state.invoke.mockResolvedValueOnce({ data: null, error: new Error("Unavailable") });
    render(view()); fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Retry review" }));
    expect(await screen.findByText("The active site changes shape.")).toBeVisible();
    expect(state.invoke).toHaveBeenCalledTimes(2);
  });
  it("uses the normalized response review for released structured keys with no legacy correct_answer", async () => {
    const f = responseFixture("cloze");
    const structuredRow = { ...row, questionId: responseQuestion, score: 0, marks: 2 };
    state.invoke.mockResolvedValue({ data: { scoresHidden: false, submission: { status: "graded" }, questions: [{ ...payload().questions[0], id: responseQuestion, marks: 2, correct_answer: null, response_definition: f.definition, response_key: f.key }], existingAnswers: [{ question_id: responseQuestion, score: 0, answer_text: JSON.stringify({ ...f.envelope, value: { fields: { tube_x: "starch" } } }) }] }, error: null });
    render(view([structuredRow]));
    fireEvent.click(screen.getByRole("button", { name: "Review question 2(b): Enzymes" }));
    expect(await screen.findByText("Mark scheme")).toBeVisible();
    expect(screen.getByText("Tube X: glucose [2 marks]")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Tube X" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Tube X" })).toHaveValue("starch");
  });
  it("keeps older questions accessible and excludes invalid/full-mark metadata", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ ...row, questionId: `q-${i}`, questionNumber: String(i + 1) }));
    render(view([...rows, { ...row, questionId: "full", score: 3 }, { ...row, questionId: "nan", score: Number.NaN }]));
    expect(screen.getAllByRole("button", { name: /Review question/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: /Show more questions/ }));
    expect(screen.getAllByRole("button", { name: /Review question/ })).toHaveLength(5);
  });
});

describe("released review response validation", () => {
  it.each([null, { scoresHidden: true }, { ...payload(), scoresHidden: undefined }, { ...payload(), submission: { status: "marking_failed" } }, { ...payload(), submission: { status: "submitted" } }])("fails closed for hidden, pending or failed marks", data => {
    expect(() => readReleasedRevisit(data, row.examId, row.questionId)).toThrow();
  });
  it.each([null, Number.NaN, -1, 3, 4])("does not treat missing/invalid/full-credit scores as wrong: %s", score => {
    expect(() => readReleasedRevisit({ ...payload(), existingAnswers: [{ question_id: row.questionId, score }] }, row.examId, row.questionId)).toThrow();
  });
  it("rejects another question/exam and preserves genuine zero", () => {
    expect(() => readReleasedRevisit(payload(), row.examId, "other-question")).toThrow();
    expect(() => readReleasedRevisit({ ...payload(), questions: [{ ...payload().questions[0], exam_id: "other-exam" }] }, row.examId, row.questionId)).toThrow();
    expect(readReleasedRevisit({ ...payload(), existingAnswers: [{ question_id: row.questionId, score: 0 }] }, row.examId, row.questionId).answer.score).toBe(0);
  });
  it("keeps structured private response keys only in the authorised response", () => {
    const question = { ...payload().questions[0], correct_answer: null, response_definition: { version: 1 }, response_key: { units: [{ secret: "answer" }] } };
    const review = readReleasedRevisit({ ...payload(), questions: [question] }, row.examId, row.questionId);
    expect(review.question.response_key).toEqual(question.response_key);
    expect(() => readReleasedRevisit({ ...payload(), questions: [question], scoresHidden: true }, row.examId, row.questionId)).toThrow();
  });
  it("resolves MCQ letters to their saved option text without losing ordinary keys", () => {
    const q = { ...payload().questions[0], correct_answer: "B", options: ["A. Decreases", { text: "B. Increases" }] };
    expect(legacyExpectedAnswer(q)).toBe("Increases");
    expect(legacyExpectedAnswer({ ...q, correct_answer: '{"method":"Use a ratio","units":"cm"}' })).toEqual({ method: "Use a ratio", units: "cm" });
  });
});
