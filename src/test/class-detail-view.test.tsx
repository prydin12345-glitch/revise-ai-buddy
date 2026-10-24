import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ComponentProps } from "react";
import { ClassDetailView } from "@/components/classes/ClassDetailView";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import type { FeedbackThread, GroupAnnouncement, GroupAssignment, StudentGroup, SubmissionData } from "@/pages/MyClasses";

const notices = vi.hoisted(() => ({ error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast: notices }));

type Props = ComponentProps<typeof ClassDetailView>;
const biology: StudentGroup = { id: "biology", name: "A Level Biology", tutor_id: "biology-tutor", description: "Cells, biological molecules and practical methods.", subjects_covered: [{ name: "Biology", color: "#246746" }] };
const maths: StudentGroup = { id: "maths", name: "Mathematics Workshop", tutor_id: "maths-tutor", subjects_covered: [{ name: "Mathematics" }] };
const assignment = (id: string, title: string, deadline?: string, group = biology): GroupAssignment => ({ id: `assignment-${id}`, exam_id: id, exam_title: title, exam_type: "generated", deadline, group_id: group.id, group_name: group.name });
const assignments = [
  assignment("cells", "Cells and microscopy", "2026-10-26T17:00:00"),
  assignment("membranes", "Biological membranes", "2026-10-20T17:00:00"),
  assignment("enzymes", "Enzymes and rates", "2026-10-21T17:00:00"),
  assignment("independent", "Independent class revision"),
  assignment("rates", "Practical-method evaluation", "2026-10-27T17:00:00"),
  assignment("genetics", "Genetics assessment", "2026-11-02T17:00:00"),
  assignment("calculus", "Unrelated calculus", "2026-10-26T17:00:00", maths),
];
const announcement = (index: number, group = biology): GroupAnnouncement => ({ id: `notice-${index}-${group.id}`, title: `${group.name} update ${index}`, message: `Saved announcement ${index} from this tutor.`, created_at: `2026-10-${20 + index}T09:00:00`, group_id: group.id, group_name: group.name });
const feedback: FeedbackThread[] = [
  { id: "feedback-pending", exam_id: "membranes", question_id: "question-1", student_comment: "How does a phospholipid bilayer control exchange?", status: "pending", created_at: "2026-10-21T12:00:00" },
  { id: "feedback-replied", exam_id: "enzymes", question_id: "question-2", student_comment: "Why does the rate fall above the optimum temperature?", tutor_response: "Explain the change in the active site and fewer enzyme-substrate complexes.", status: "responded", created_at: "2026-10-21T12:00:00", responded_at: "2026-10-22T12:00:00" },
  { id: "feedback-other", exam_id: "calculus", question_id: "question-3", student_comment: "Unrelated maths question", status: "pending", created_at: "2026-10-22T12:00:00" },
];
let store: WorkspaceStore;
let defaults: Props;
function Location() { return <output aria-label="Current location">{useLocation().pathname}</output>; }
function open(overrides: Partial<Props> = {}, ownerStore = store) {
  return render(<WorkspaceContext.Provider value={{ ownerId: ownerStore.ownerId, ready: true, store: ownerStore }}><MemoryRouter initialEntries={["/my-classes"]}><TooltipProvider><ClassDetailView {...defaults} {...overrides} /><Location /></TooltipProvider></MemoryRouter></WorkspaceContext.Provider>);
}
function tab(name: string) { fireEvent.keyDown(screen.getByRole("tab", { name: new RegExp(`^${name}`) }), { key: "Enter" }); }
function assignmentPanel() { return within(screen.getByRole("region", { name: "Your assignments" })); }
function statusFilter(name: string) { return within(screen.getByRole("group", { name: "Assignment status" })).getByRole("button", { name: new RegExp(`^${name}`) }); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  store = new WorkspaceStore("alice", 1);
  defaults = {
    group: biology, tutor: { name: "Dr Maya Wilson", bio: "Biology tutor with a focus on practical reasoning.", subjects_taught: ["Biology", "Environmental science"] },
    assignments: [...assignments], announcements: [1, 2, 3].map(index => announcement(index)), feedbackThreads: [...feedback],
    submissions: new Map<string, SubmissionData>([["cells", { status: "in_progress" }], ["membranes", { status: "submitted", submitted_at: "2026-10-20T12:00:00" }], ["enzymes", { status: "graded", total_score: 0, total_marks: 20, submitted_at: "2026-10-21T12:00:00" }], ["calculus", { status: "graded", total_score: 100, total_marks: 100 }]]),
    onBack: vi.fn(), onLeave: vi.fn(),
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Class Details student workspace", () => {
  it("scopes counts, work, updates and feedback to the selected class, including a shared cross-class submission map", () => {
    open({ announcements: [...defaults.announcements, announcement(1, maths)] });
    const summary = within(screen.getByRole("list", { name: "Your class assignment summary" })).getAllByRole("listitem");
    expect(summary[0]).toHaveTextContent("To do4");
    expect(summary[1]).toHaveTextContent("Completed2 / 6");
    expect(summary[2]).toHaveTextContent("Awaiting tutor1");
    expect(screen.getByRole("progressbar", { name: "Class assignments completed" })).toHaveAttribute("aria-valuetext", "2 of 6 assignments completed");
    expect(assignmentPanel().queryByRole("article", { name: "Unrelated calculus" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Assignments/ })).toHaveTextContent("6");
    expect(screen.getByRole("tab", { name: /^Announcements/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /^Feedback/ })).toHaveTextContent("2");
    tab("Announcements");
    expect(screen.queryByRole("heading", { name: /Mathematics Workshop update/ })).not.toBeInTheDocument();
    tab("Feedback");
    expect(screen.queryByText("Unrelated maths question")).not.toBeInTheDocument();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("keeps submitted and graded work available with a real zero and a missing grade represented truthfully", () => {
    open();
    fireEvent.click(statusFilter("Completed"));
    const panel = assignmentPanel();
    expect(panel.getAllByRole("article")).toHaveLength(2);
    const zero = within(panel.getByRole("article", { name: "Enzymes and rates" }));
    expect(zero.getByText("0%")).toBeVisible();
    const ungraded = within(panel.getByRole("article", { name: "Biological membranes" }));
    expect(ungraded.getByText("Submitted")).toBeVisible();
    expect(ungraded.queryByText("0%")).not.toBeInTheDocument();
    expect(ungraded.getByText("Feedback thread")).toBeVisible();
    expect(panel.queryByRole("article", { name: "Cells and microscopy" })).not.toBeInTheDocument();
    fireEvent.click(ungraded.getByRole("button", { name: "Review: Biological membranes" }));
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/exam/membranes/review");
  });

  it("uses text-only contextual Start and Continue actions while preserving the exam-taking route", () => {
    open();
    const continueButton = assignmentPanel().getByRole("button", { name: "Continue: Cells and microscopy" });
    const startButton = assignmentPanel().getByRole("button", { name: "Start: Practical-method evaluation" });
    expect(continueButton.querySelector("svg")).toBeNull();
    expect(startButton.querySelector("svg")).toBeNull();
    fireEvent.click(continueButton);
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/exam/cells/in-progress");
  });

  it("retains every announcement beyond the former three-item preview, with full expandable text and attachments", () => {
    const longMessage = "Tutor preparation guidance. ".repeat(20) + "Final saved instructions remain available.";
    const updates = [1, 2, 3, 4, 5].map(index => announcement(index));
    updates[4] = { ...updates[4], message: longMessage, attachment_url: "https://example.test/approved-notes.pdf" };
    open({ announcements: updates });
    expect(screen.getByRole("heading", { name: "A Level Biology update 5" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View updates" }));
    const feed = within(screen.getByRole("region", { name: "Class announcements" }));
    expect(feed.getAllByRole("article")).toHaveLength(5);
    const expanded = feed.getByRole("button", { name: "Read announcement" });
    expect(expanded).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expanded);
    expect(feed.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(feed.getByText(longMessage)).toBeVisible();
    const attachment = feed.getByRole("link", { name: /Attachment/ });
    expect(attachment).toHaveAttribute("href", "https://example.test/approved-notes.pdf");
    expect(attachment).toHaveAttribute("target", "_blank");
    expect(attachment).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("retains every feedback thread beyond the former five-item preview and opens the complete tutor response", () => {
    const threads = Array.from({ length: 7 }, (_, index) => ({ ...feedback[1], id: `thread-${index}`, student_comment: `Full student question ${index}`, tutor_response: `Complete tutor explanation ${index}` }));
    open({ feedbackThreads: threads });
    tab("Feedback");
    const panel = within(screen.getByRole("region", { name: "Your feedback" }));
    const buttons = panel.getAllByRole("button", { name: "View feedback for Enzymes and rates" });
    expect(buttons).toHaveLength(7);
    fireEvent.click(buttons[6]);
    const dialog = within(screen.getByRole("dialog", { name: "Feedback thread" }));
    expect(dialog.getByText("Full student question 6")).toBeVisible();
    expect(dialog.getByText("Complete tutor explanation 6")).toBeVisible();
    expect(dialog.getByRole("heading", { name: "Tutor response" })).toBeVisible();
  });

  it("keeps the class-only calendar visible through every tab and excludes completed or unrelated deadlines", () => {
    open();
    for (const name of ["Assignments", "Announcements", "Feedback"]) {
      tab(name);
      const schedule = within(screen.getByRole("complementary", { name: "Class calendar and upcoming deadlines" }));
      expect(schedule.getByRole("region", { name: "Assignment deadline calendar" })).toBeVisible();
      expect(schedule.getByRole("region", { name: "Upcoming deadlines" })).toBeVisible();
      expect(schedule.queryByRole("article", { name: "Unrelated calculus" })).not.toBeInTheDocument();
      expect(schedule.queryByRole("article", { name: "Biological membranes" })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 1 assignment due" })).toBeVisible();
  });

  it("filters deadlines by calendar date and month while retaining undated work and allowing a whole-month reset", () => {
    open();
    const schedule = within(screen.getByRole("region", { name: "Upcoming deadlines" }));
    expect(schedule.getByRole("article", { name: "Practical-method evaluation" })).toBeVisible();
    expect(schedule.queryByRole("article", { name: "Genetics assessment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 1 assignment due" }));
    expect(schedule.getByRole("article", { name: "Cells and microscopy" })).toBeVisible();
    expect(schedule.getByRole("article", { name: "Independent class revision" })).toBeVisible();
    expect(schedule.queryByRole("article", { name: "Practical-method evaluation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show whole month" }));
    expect(schedule.getByRole("article", { name: "Practical-method evaluation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(schedule.getByRole("article", { name: "Genetics assessment" })).toBeVisible();
    expect(schedule.getByRole("article", { name: "Independent class revision" })).toBeVisible();
    expect(schedule.queryByRole("article", { name: "Cells and microscopy" })).not.toBeInTheDocument();
  });

  it("makes tutor details available through a labelled button, preserving biography and taught subjects", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "View tutor profile: Dr Maya Wilson" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dr Maya Wilson" }));
    expect(dialog.getByText("Biology tutor with a focus on practical reasoning.")).toBeVisible();
    expect(dialog.getByText("Biology · Environmental science")).toBeVisible();
  });

  it("keeps leave as an explicit callback from Class info so the parent still owns confirmation", () => {
    open();
    expect(screen.queryByRole("button", { name: "Leave class" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Class information" }));
    const dialog = within(screen.getByRole("dialog", { name: "About this class" }));
    expect(dialog.getByText(biology.description!)).toBeVisible();
    expect(defaults.onLeave).not.toHaveBeenCalled();
    fireEvent.click(dialog.getByRole("button", { name: "Leave class" }));
    expect(defaults.onLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "About this class" })).not.toBeInTheDocument();
    expect(defaults.onBack).not.toHaveBeenCalled();
  });

  it("returns to My Classes using the existing parent callback", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "My Classes" }));
    expect(defaults.onBack).toHaveBeenCalledTimes(1);
    expect(defaults.onLeave).not.toHaveBeenCalled();
  });

  it("has truthful empty states with finite zero-assignment progress", () => {
    open({ assignments: [], submissions: new Map(), announcements: [], feedbackThreads: [], tutor: undefined });
    expect(screen.getByRole("heading", { name: "No assignments yet" })).toBeVisible();
    expect(screen.getByText("Work set by your teacher or tutor will appear here.")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "No assignments set" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("progressbar", { name: "No assignments set" })).toHaveAttribute("aria-valuemax", "1");
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View tutor profile/ })).not.toBeInTheDocument();
    tab("Announcements");
    expect(screen.getByRole("heading", { name: "No announcements yet" })).toBeVisible();
    tab("Feedback");
    expect(screen.getByRole("heading", { name: "No feedback threads yet" })).toBeVisible();
  });

  it("distinguishes all-caught-up from no assignments and preserves access to completed work", () => {
    const done = assignments.filter(item => ["membranes", "enzymes"].includes(item.exam_id));
    open({ assignments: done });
    expect(screen.getByRole("heading", { name: "You’re all caught up" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "No assignments yet" })).not.toBeInTheDocument();
    fireEvent.click(statusFilter("Completed"));
    expect(assignmentPanel().getAllByRole("article")).toHaveLength(2);
  });

  it("retains tab, status filter and calendar preferences when returning to this class", () => {
    const first = open();
    fireEvent.click(statusFilter("Completed"));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    tab("Feedback");
    first.unmount();
    open();
    expect(screen.getByRole("tab", { name: /^Feedback/ })).toHaveAttribute("aria-selected", "true");
    expect(within(screen.getByRole("region", { name: "Assignment deadline calendar" })).getByText("November 2026")).toBeVisible();
    tab("Assignments");
    expect(statusFilter("Completed")).toHaveAttribute("aria-pressed", "true");
    expect(assignmentPanel().getByRole("article", { name: "Enzymes and rates" })).toBeVisible();
  });

  it("does not reuse another class's or another account's saved tab/filter", () => {
    const first = open();
    fireEvent.click(statusFilter("Completed"));
    tab("Feedback");
    first.unmount();
    const second = open({ group: maths });
    expect(screen.getByRole("tab", { name: /^Assignments/ })).toHaveAttribute("aria-selected", "true");
    expect(statusFilter("To do")).toHaveAttribute("aria-pressed", "true");
    second.unmount();
    open({}, new WorkspaceStore("bob", 1));
    expect(screen.getByRole("tab", { name: /^Assignments/ })).toHaveAttribute("aria-selected", "true");
    expect(statusFilter("To do")).toHaveAttribute("aria-pressed", "true");
  });
});
