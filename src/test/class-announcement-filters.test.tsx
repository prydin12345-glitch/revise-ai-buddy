import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClassAnnouncements } from "@/components/classes/ClassAnnouncements";
import type { GroupAnnouncement, StudentGroup } from "@/pages/MyClasses";

const groups: StudentGroup[] = [
  { id: "biology", name: "Biology revision", tutor_id: "biology-tutor" },
  { id: "maths", name: "Maths workshop", tutor_id: "maths-tutor" },
  { id: "empty-class", name: "Chemistry practicals", tutor_id: "chemistry-tutor" },
];
const announcements: GroupAnnouncement[] = [
  { id: "bio-old", group_id: "biology", group_name: "Biology revision", title: "Older biology update", message: "Read the microscopy notes.", created_at: new Date(2026, 9, 1, 10).toISOString() },
  { id: "maths-old", group_id: "maths", group_name: "Maths workshop", title: "Functions preparation", message: "Bring your graph paper.", created_at: new Date(2026, 9, 22, 14).toISOString() },
  { id: "bio-today", group_id: "biology", group_name: "Biology revision", title: "Today's biology update", message: "Revisit the practical-method notes.", created_at: new Date(2026, 9, 24, 9, 15).toISOString() },
  { id: "maths-yesterday", group_id: "maths", group_name: "Maths workshop", title: "Latest maths update", message: "The revision session notes are attached.", created_at: new Date(2026, 9, 23, 16, 30).toISOString() },
].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

function Example({ initial = "all", limit, onChange = () => {} }: { initial?: string; limit?: number; onChange?: (id: string) => void }) {
  const [selectedClass, setSelectedClass] = useState(initial);
  return <ClassAnnouncements announcements={announcements} groups={groups} selectedClass={selectedClass}
    onClassChange={id => { onChange(id); setSelectedClass(id); }} limit={limit} />;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 24, 12));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("announcements filtered by actual joined class", () => {
  it("offers All and every real class, including classes without announcements", () => {
    render(<Example />);
    const filters = within(screen.getByRole("group", { name: "Filter announcements by class" }));
    expect(filters.getByRole("button", { name: "All classes" })).toHaveAttribute("aria-pressed", "true");
    groups.forEach(group => expect(filters.getByRole("button", { name: group.name })).toBeVisible());
    expect(filters.getAllByRole("button")).toHaveLength(groups.length + 1);
    expect(screen.getAllByRole("heading").map(heading => heading.textContent)).toEqual([
      "Today's biology update", "Latest maths update", "Functions preparation", "Older biology update",
    ]);
    expect(screen.queryByText(/unread|new announcements|news|activities/i)).not.toBeInTheDocument();
  });

  it("filters by group identity and applies the overview limit after filtering", () => {
    const changed = vi.fn();
    render(<Example limit={2} onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Maths workshop" }));
    expect(changed).toHaveBeenLastCalledWith("maths");
    expect(screen.getByRole("button", { name: "Maths workshop" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "All classes" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("heading").map(heading => heading.textContent)).toEqual(["Latest maths update", "Functions preparation"]);
    expect(screen.queryByRole("heading", { name: "Today's biology update" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All classes" }));
    expect(changed).toHaveBeenLastCalledWith("all");
    expect(screen.getByRole("heading", { name: "Today's biology update" })).toBeVisible();
  });

  it("keeps identically named classes distinct without inventing renamed class labels", () => {
    const changed = vi.fn();
    const sameNameGroups = groups.slice(0, 2).map(group => ({ ...group, name: "Revision class" }));
    render(<ClassAnnouncements announcements={announcements} groups={sameNameGroups} selectedClass="all" onClassChange={changed} />);
    const options = screen.getAllByRole("button", { name: "Revision class" });
    fireEvent.click(options[1]);
    expect(changed).toHaveBeenCalledWith("maths");
    fireEvent.click(options[0]);
    expect(changed).toHaveBeenLastCalledWith("biology");
  });

  it("shows a truthful empty message for a class with no announcement and allows returning to All", () => {
    render(<Example />);
    fireEvent.click(screen.getByRole("button", { name: "Chemistry practicals" }));
    expect(screen.getByRole("heading", { name: "No recent announcements" })).toBeVisible();
    expect(screen.getByText("There are no recent updates from Chemistry practicals.")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Today's biology update" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All classes" }));
    expect(screen.getByRole("heading", { name: "Today's biology update" })).toBeVisible();
  });

  it("falls back to All when a retained filter no longer belongs to a joined class", () => {
    render(<Example initial="left-class" />);
    expect(screen.getByRole("button", { name: "All classes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Today's biology update" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Latest maths update" })).toBeVisible();
  });

  it("filters read-only chronological records without mutating cached announcements or membership", () => {
    const frozenGroups = Object.freeze(groups.map(group => Object.freeze({ ...group })));
    const frozenAnnouncements = Object.freeze(announcements.map(announcement => Object.freeze({ ...announcement })));
    const originalOrder = frozenAnnouncements.map(announcement => announcement.id);
    render(<ClassAnnouncements groups={frozenGroups as unknown as StudentGroup[]} announcements={frozenAnnouncements as unknown as GroupAnnouncement[]}
      selectedClass="biology" onClassChange={() => {}} />);
    expect(screen.getAllByRole("heading").map(heading => heading.textContent)).toEqual(["Today's biology update", "Older biology update"]);
    expect(frozenAnnouncements.map(announcement => announcement.id)).toEqual(originalOrder);
    expect(frozenGroups.map(group => group.id)).toEqual(["biology", "maths", "empty-class"]);
  });

  it("uses the actual posting dates and keeps timeline text, expansion and attachments accessible", () => {
    const longMessage = "Please review these practical-method notes before the assessment. ".repeat(7) + "Final instructions remain available.";
    const notice = { ...announcements[0], message: longMessage, attachment_url: "https://example.invalid/class-notes.pdf" };
    const view = render(<ClassAnnouncements announcements={[notice, announcements[1], announcements[3]]} groups={groups}
      selectedClass="all" onClassChange={() => {}} />);
    const posted = view.container.querySelector<HTMLTimeElement>(`time[datetime="${notice.created_at}"]`);
    expect(posted).toHaveTextContent(/Today/i);
    expect(posted).toHaveTextContent("09:15");
    expect(view.container.querySelector(`time[datetime="${announcements[1].created_at}"]`)).toHaveTextContent(/Yesterday/i);
    expect(view.container.querySelector(`time[datetime="${announcements[3].created_at}"]`)).toHaveTextContent(/2026/);
    const expand = screen.getByRole("button", { name: /Read announcement/ });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(longMessage)).toBeVisible();
    const attachment = screen.getByRole("link", { name: /Attachment/ });
    expect(attachment).toHaveAttribute("href", notice.attachment_url);
    expect(attachment).toHaveAttribute("target", "_blank");
    expect(attachment).toHaveAttribute("rel", "noopener noreferrer");
  });
});
