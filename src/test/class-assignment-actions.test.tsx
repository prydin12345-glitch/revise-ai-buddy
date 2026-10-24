import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssignmentRow } from "@/components/classes/AssignmentRow";
import type { ComponentProps } from "react";

const messages = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: messages }));

const assignment = {
  id: "assignment-1", exam_id: "exam-1", title: "Biological molecules",
  type: "generated", deadline: "2026-10-26T17:00:00Z",
};
const Location = () => {
  const location = useLocation();
  return <output aria-label="Current location">{location.pathname}</output>;
};
type RowProps = ComponentProps<typeof AssignmentRow>;
function open(props: Partial<RowProps> = {}) {
  return render(<MemoryRouter initialEntries={["/my-classes"]}><TooltipProvider>
    <AssignmentRow assignment={assignment} className="A Level Biology" tutorName="Dr Wilson" {...props} />
    <Location />
  </TooltipProvider></MemoryRouter>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("class assignment actions and factual status", () => {
  it.each(["card", "row", "schedule"] as const)("opens the existing exam-taking route from the %s presentation", presentation => {
    open({ presentation });
    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/exam/exam-1/in-progress");
  });

  it("continues an in-progress assignment without changing its exam identity", () => {
    open({ submission: { status: "in_progress" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/ }));
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/exam/exam-1/in-progress");
  });

  it.each(["submitted", "graded"])("opens authorised review for %s work after its deadline", status => {
    open({ assignment: { ...assignment, deadline: "2026-10-20T17:00:00Z" }, submission: { status } });
    fireEvent.click(screen.getByRole("button", { name: /Review/ }));
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/exam/exam-1/review");
  });

  it("keeps a future release locked even if submission metadata exists", () => {
    open({ assignment: { ...assignment, release_date: "2026-10-25T09:00:00Z" }, submission: { status: "graded", total_score: 10, total_marks: 10 } });
    const action = screen.getByRole("button", { name: /Available|Not available|Not released/i });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/my-classes");
    expect(screen.queryByRole("button", { name: /Review/ })).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("blocks incomplete work whose deadline has passed", () => {
    open({ assignment: { ...assignment, deadline: "2026-10-20T17:00:00Z" }, submission: { status: "in_progress" } });
    const action = screen.getByRole("button", { name: /View|Deadline passed|Closed/i });
    expect(action).toBeDisabled();
    fireEvent.click(action);
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/my-classes");
  });

  it.each(["submitted", "graded"])("does not invent a zero score for %s work without released score metadata", status => {
    open({ submission: { status, total_score: null, total_marks: null } });
    expect(screen.queryByText(/0%|NaN|Infinity/)).not.toBeInTheDocument();
    expect(screen.getByText(/Submitted|Graded|Awaiting/i)).toBeVisible();
  });

  it.each(["submitted", "graded"])("preserves an actual released zero score for %s work rather than treating it as missing", status => {
    open({ submission: { status, total_score: 0, total_marks: 20 } });
    expect(screen.getByText("0%")).toBeVisible();
    expect(screen.getByRole("button", { name: /Review/ })).toBeEnabled();
  });

  it("does not render an invalid percentage when the marking total is unavailable", () => {
    open({ submission: { status: "graded", total_score: 12, total_marks: 0 } });
    expect(screen.getByText("Graded")).toBeVisible();
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });

  it("identifies a generated assigned exam as an exam rather than a saved practice quiz", () => {
    open();
    expect(screen.getByText(/Exam/)).toBeVisible();
    expect(screen.queryByText(/Practice Quiz|Practice set/i)).not.toBeInTheDocument();
  });

  it("rejects a removed exam reference without navigating", () => {
    open({ assignment: { ...assignment, exam_id: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(messages.error).toHaveBeenCalledWith("This assignment is no longer available.");
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/my-classes");
  });
});
