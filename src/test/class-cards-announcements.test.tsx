import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassCard } from "@/components/classes/ClassCard";
import { AnnouncementItem } from "@/components/classes/AnnouncementItem";
import { classSubjectLabels } from "@/lib/class-subjects";

afterEach(cleanup);
describe("class cards and announcements", () => {
  it("accepts tutor-written names and legacy subject IDs without exposing unresolved IDs", () => {
    const biologyId = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const unknownId = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
    const known = [{ id: "saved-biology", subject_id: biologyId, subject_name: "Biology", subject_color: "#247251" }];
    expect(classSubjectLabels(["Biology", { name: "Chemistry", color: "#7952aa" }], known)).toEqual([
      { name: "Biology", color: "#247251" }, { name: "Chemistry", color: "#7952aa" },
    ]);
    expect(classSubjectLabels([biologyId, "Biology", unknownId, null, { name: 42 }], known)).toEqual([{ name: "Biology", color: "#247251" }]);
    expect(classSubjectLabels(null, known)).toEqual([]);
  });

  it("keeps cover labels readable on bright, dark and theme-primary backgrounds", () => {
    const card = (subjectColor: string) => <ClassCard group={{ id: "general", name: "General revision" }} assignmentCount={0} announcementCount={0} subjectColor={subjectColor} onClick={() => {}} />;
    const view = render(card("#ffdf00"));
    const foreground = () => screen.getByRole("button", { name: "Open General revision" }).style.getPropertyValue("--class-cover-foreground");
    expect(foreground()).toBe("#000000");
    view.rerender(card("#163b25"));
    expect(foreground()).toBe("#ffffff");
    view.rerender(card("hsl(var(--primary))"));
    expect(foreground()).toBe("hsl(var(--primary-foreground))");
  });

  it("opens the exact class and labels actual counts without inventing unread state or mastery", () => {
    const open = vi.fn();
    render(<ClassCard group={{ id: "biology", name: "A Level Biology", subjects_covered: [{ name: "Biology" }] }} tutorName="Dr Wilson" assignmentCount={4} completedCount={2} pendingCount={2} announcementCount={3} subjectColor="#247251" onClick={open} />);
    fireEvent.click(screen.getByRole("button", { name: /View class|Open A Level Biology/ }));
    expect(open).toHaveBeenCalledOnce();
    expect(screen.getByText("Dr Wilson")).toBeVisible();
    expect(screen.queryByText(/new|unread|mastery/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("makes the complete long announcement readable and preserves attachment access", () => {
    const message = "Please review the practical-method notes before starting. ".repeat(8) + "Final instructions remain accessible.";
    render(<AnnouncementItem announcement={{ id: "notice-1", title: "Assessment preparation", message, group_name: "A Level Biology", created_at: "2026-10-23T09:00:00Z", attachment_url: "https://example.invalid/notes.pdf" }} showGroupName />);
    const expand = screen.getByRole("button", { name: /Read announcement/ });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(screen.getByText(message)).toBeVisible();
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
    const attachment = screen.getByRole("link", { name: /Attachment/ });
    expect(attachment).toHaveAttribute("href", "https://example.invalid/notes.pdf");
    expect(attachment).toHaveAttribute("target", "_blank");
    expect(attachment).toHaveAttribute("rel", "noopener noreferrer");
  });
});
