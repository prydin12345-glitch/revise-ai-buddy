import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassDeadlineCalendar } from "@/components/classes/ClassDeadlineCalendar";
import type { GroupAssignment, StudentGroup } from "@/pages/MyClasses";

const groups: StudentGroup[] = [
  { id: "biology", name: "Biology group", tutor_id: "tutor-1", subjects_covered: [{ name: "Biology", color: "#134522" }] },
  { id: "chemistry", name: "Chemistry group", tutor_id: "tutor-2", subjects_covered: [{ name: "Chemistry" }] },
];
const assignments: GroupAssignment[] = [
  { id: "a", exam_id: "exam-a", exam_title: "Cells", exam_type: "generated", deadline: "2026-10-26T17:00:00", group_id: "biology", group_name: "Biology group" },
  { id: "b", exam_id: "exam-b", exam_title: "Rates", exam_type: "uploaded", deadline: "2026-10-26T16:30:00", group_id: "chemistry", group_name: "Chemistry group" },
  { id: "c", exam_id: "exam-c", exam_title: "Genetics", exam_type: "generated", deadline: "2026-11-02T12:00:00", group_id: "biology", group_name: "Biology group" },
  { id: "d", exam_id: "exam-d", exam_title: "No deadline", exam_type: "generated", group_id: "biology", group_name: "Biology group" },
  { id: "e", exam_id: "exam-e", exam_title: "Invalid date", exam_type: "generated", deadline: "not-a-date", group_id: "biology", group_name: "Biology group" },
];
const colour = (subject: string) => subject === "Biology" ? "#247251" : "#7952aa";

function CalendarHarness({ onSelect = () => {}, items = assignments }: { onSelect?: (date: Date | undefined) => void; items?: GroupAssignment[] }) {
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [selected, setSelected] = useState<Date>();
  return <ClassDeadlineCalendar assignments={items} groups={groups} getSubjectColor={colour} month={month} onMonthChange={setMonth} selectedDate={selected} onSelectDate={date => { setSelected(date); onSelect(date); }} />;
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("assignment deadline calendar", () => {
  it("announces actual deadline counts and preserves separate subject colours", () => {
    render(<CalendarHarness />);
    const day = screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 2 assignments due" });
    expect(day.querySelectorAll(".class-deadline-dots > span")).toHaveLength(2);
    expect(Array.from(day.querySelectorAll<HTMLElement>(".class-deadline-dots > span"), dot => dot.style.backgroundColor)).toContain("rgb(19, 69, 34)");
    expect(screen.getByRole("gridcell", { name: "Monday, 2 November 2026, 1 assignment due" })).toBeVisible();
    expect(screen.getByText("Dates and times use your device’s local time.")).toBeVisible();
  });

  it("selects a day and offers an explicit whole-month reset", () => {
    const select = vi.fn();
    render(<CalendarHarness onSelect={select} />);
    fireEvent.click(screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 2 assignments due" }));
    expect(select).toHaveBeenLastCalledWith(new Date(2026, 9, 26));
    fireEvent.click(screen.getByRole("button", { name: "Show whole month" }));
    expect(select).toHaveBeenLastCalledWith(undefined);
    expect(screen.queryByRole("button", { name: "Show whole month" })).not.toBeInTheDocument();
  });

  it("uses month navigation and a truthful empty-month message", () => {
    render(<CalendarHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("November 2026")).toBeVisible();
    expect(screen.queryByText("No deadlines this month.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("December 2026")).toBeVisible();
    expect(screen.getByText("No deadlines this month.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("November 2026")).toBeVisible();
  });

  it("ignores absent and invalid dates rather than inventing calendar deadlines", () => {
    render(<CalendarHarness items={assignments.slice(3)} />);
    expect(screen.getByText("No deadlines this month.")).toBeVisible();
    expect(screen.queryByRole("gridcell", { name: /assignments? due/ })).not.toBeInTheDocument();
    expect(document.querySelector(".class-deadline-dots")).not.toBeInTheDocument();
  });

  it("retains the accessible calendar's standard arrow-key day navigation", async () => {
    render(<CalendarHarness />);
    const day = screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 2 assignments due" });
    act(() => day.focus());
    fireEvent.keyDown(day, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("gridcell", { name: "Tuesday, 27 October 2026" })).toHaveFocus());
  });
});
