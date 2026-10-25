import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GradeGoalCard, GoalFields } from "@/components/stats/GradeGoalCard";
import { availableGoalGrades, goalForScale, readSubjectGradeGoal, sanitiseSubjectGradeGoal, saveSubjectGradeGoal, subjectGradeGoalError, subjectGradeGoalKey, type SubjectGradeGoal } from "@/lib/subject-grade-goals";

const legacy = vi.hoisted(() => ({ value: {} as SubjectGradeGoal }));
vi.mock("@/hooks/useGradeSettings", () => ({ useGradeSettings: () => ({ get: () => legacy.value }) }));
let fixtureId = 0;
const ids = () => ({ owner: `goal-owner-${++fixtureId}`, subjectId: `subject-${fixtureId}` });
const boundaries = { "A*": 90, A: 80, B: 70, C: 60, D: 50, E: 40 };
beforeEach(() => { localStorage.clear(); legacy.value = {}; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("separates owners and stable subject identities even when subjects have the same display name", () => {
  const { owner, subjectId } = ids();
  saveSubjectGradeGoal(owner, subjectId, { scaleId: "alevel_a_e", startingGrade: "D", targetGrade: "A" });
  expect(readSubjectGradeGoal(owner, subjectId)).toMatchObject({ startingGrade: "D", targetGrade: "A" });
  expect(readSubjectGradeGoal(`${owner}-other`, subjectId)).toEqual({});
  expect(readSubjectGradeGoal(owner, `${subjectId}-other`)).toEqual({});
  expect(readSubjectGradeGoal(null, subjectId)).toEqual({});
});

it("ignores malformed or misattributed browser records and invalid percentage values", () => {
  const { owner, subjectId } = ids();
  localStorage.setItem(subjectGradeGoalKey(owner, subjectId), JSON.stringify({ version: 1, ownerId: "someone-else", subjectId, goal: { targetPercentage: 95 } }));
  expect(readSubjectGradeGoal(owner, subjectId)).toEqual({});
  localStorage.setItem(subjectGradeGoalKey(owner, subjectId), "not-json");
  expect(readSubjectGradeGoal(owner, subjectId)).toEqual({});
  expect(sanitiseSubjectGradeGoal({ scaleId: "unknown", targetPercentage: 101, startingPercentage: Number.NaN })).toEqual({});
  expect(subjectGradeGoalError({ targetPercentage: -1 })).toMatch(/between 0 and 100/);
});

it("caps Foundation goals without giving untiered qualifications tier controls", () => {
  expect(availableGoalGrades("gcse_9_1", "foundation")).toEqual(["5", "4", "3", "2", "1", "U"]);
  expect(sanitiseSubjectGradeGoal({ scaleId: "gcse_9_1", tierId: "foundation", targetGrade: "9" }).targetGrade).toBeUndefined();
  expect(goalForScale({ targetGrade: "9" }, "gcse_9_1", "foundation").targetGrade).toBeUndefined();
  render(<GoalFields value={{ scaleId: "alevel_a_e" }} onChange={() => {}} />);
  expect(screen.queryByRole("combobox", { name: "Tier" })).not.toBeInTheDocument();
});

it("caps a selected Foundation profile even when the subject previously saved Higher settings", () => {
  const { owner, subjectId } = ids();
  saveSubjectGradeGoal(owner, subjectId, { scaleId: "gcse_9_1", tierId: "higher", startingGrade: "6", targetGrade: "9" });
  const view = render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={95} defaultScaleId="gcse_9_1" defaultTierId="foundation" />);
  expect(view.container.querySelector(".stats-grade-summary > div:nth-child(2) strong")).toHaveTextContent("595%");
  expect(screen.getByText(/caps estimates at 5/)).toHaveTextContent("Your subject target remains 9");
  expect(readSubjectGradeGoal(owner, subjectId)).toMatchObject({ tierId: "higher", targetGrade: "9", startingGrade: "6" });
  fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
  fireEvent.click(screen.getByText("Grade scale & boundaries"));
  expect(screen.getByRole("combobox", { name: "Tier" })).toBeDisabled();
  expect(within(screen.getByRole("combobox", { name: /Target grade/ })).queryByRole("option", { name: "9" })).toBeNull();
  expect(screen.getByRole("combobox", { name: /Starting grade/ })).toHaveValue("6");
});

it("derives the estimate and target marker from saved boundaries while preserving the self-reported baseline", () => {
  const { owner, subjectId } = ids();
  saveSubjectGradeGoal(owner, subjectId, { scaleId: "alevel_a_e", startingGrade: "D", targetGrade: "A", boundaries });
  const view = render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={68} defaultScaleId="alevel_a_e" />);
  expect(screen.getByRole("meter", { name: "Biology current exam percentage" })).toHaveAttribute("aria-valuenow", "68");
  expect(view.container.querySelector(".stats-grade-summary > div:nth-child(2) strong")).toHaveTextContent("C68%");
  expect(screen.getByLabelText("Target at 80%")).toHaveStyle({ left: "80%" });
  fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
  fireEvent.change(screen.getByRole("combobox", { name: /Starting grade/ }), { target: { value: "E" } });
  fireEvent.change(screen.getByRole("combobox", { name: /Target grade/ }), { target: { value: "B" } });
  fireEvent.click(screen.getByRole("button", { name: "Save goal" }));
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "68");
  expect(readSubjectGradeGoal(owner, subjectId)).toMatchObject({ startingGrade: "E", targetGrade: "B" });
  expect(screen.getByLabelText("Target at 70%")).toBeInTheDocument();
  view.rerender(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={82} defaultScaleId="alevel_a_e" />);
  expect(view.container.querySelector(".stats-grade-summary > div:first-child strong")).toHaveTextContent("E");
  expect(view.container.querySelector(".stats-grade-summary > div:nth-child(2) strong")).toHaveTextContent("A82%");
});

it("distinguishes no marked result from a real zero and preserves an existing account percentage goal", () => {
  const { owner, subjectId } = ids();
  const view = render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Physics" averageScore={null} targetPercentage={82} />);
  expect(screen.queryByRole("meter")).toBeNull();
  expect(screen.getByRole("img", { name: "No marked exam estimate yet" })).toBeVisible();
  expect(screen.getByLabelText("Target at 82%")).toBeVisible();
  view.rerender(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Physics" averageScore={0} targetPercentage={82} />);
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "0");
  expect(view.container.querySelector(".stats-grade-summary > div:nth-child(2) strong")).toHaveTextContent("0%");
});

it("keeps an old subject-name browser target untouched until the user explicitly imports it", () => {
  const { owner, subjectId } = ids();
  legacy.value = { scaleId: "alevel_a_e", targetGrade: "A", boundaries };
  const view = render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={68} defaultScaleId="alevel_a_e" />);
  expect(view.container.querySelector(".stats-grade-summary > div:last-child strong")).toHaveTextContent("Not set");
  expect(screen.queryByLabelText("Target at 80%")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use previous browser settings" }));
  expect(screen.getByLabelText("Target at 80%")).toBeVisible();
  expect(legacy.value).toMatchObject({ targetGrade: "A", boundaries });
  expect(readSubjectGradeGoal(owner, subjectId)).toMatchObject({ targetGrade: "A" });
});

it("rejects inverted boundaries without modifying the saved goal", () => {
  const { owner, subjectId } = ids();
  saveSubjectGradeGoal(owner, subjectId, { scaleId: "alevel_a_e", targetGrade: "A" });
  render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={68} defaultScaleId="alevel_a_e" />);
  fireEvent.click(screen.getByRole("button", { name: "Edit goal" }));
  fireEvent.click(screen.getByText("Grade scale & boundaries"));
  fireEvent.change(screen.getByRole("spinbutton", { name: "A minimum %" }), { target: { value: "90" } });
  fireEvent.click(screen.getByRole("button", { name: "Save goal" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Each higher grade needs a higher minimum percentage");
  expect(readSubjectGradeGoal(owner, subjectId).boundaries).toBeUndefined();
});

it("retains goals for the session if browser persistence fails, without sharing them with another account", () => {
  const { owner, subjectId } = ids();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  expect(saveSubjectGradeGoal(owner, subjectId, { scaleId: "percentage", targetPercentage: 75 })).toBe(false);
  expect(readSubjectGradeGoal(owner, subjectId).targetPercentage).toBe(75);
  expect(readSubjectGradeGoal(`${owner}-other`, subjectId)).toEqual({});
});

it("refreshes this account's snapshot from a storage event and never overwrites an earned estimate", () => {
  const { owner, subjectId } = ids();
  const view = render(<GradeGoalCard ownerId={owner} subjectId={subjectId} subject="Biology" averageScore={68} defaultScaleId="alevel_a_e" />);
  act(() => {
    localStorage.setItem(subjectGradeGoalKey(owner, subjectId), JSON.stringify({ version: 1, ownerId: owner, subjectId, goal: { scaleId: "alevel_a_e", startingGrade: "E", targetGrade: "A", boundaries } }));
    window.dispatchEvent(new StorageEvent("storage", { key: subjectGradeGoalKey(owner, subjectId) }));
  });
  expect(view.container.querySelector(".stats-grade-summary > div:first-child strong")).toHaveTextContent("E");
  expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "68");
  expect(screen.getByLabelText("Target at 80%")).toBeVisible();
});
