import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookOpen, FileText, Trophy, Clock, Flame } from "lucide-react";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import StudentHomeLayout from "@/components/dashboard/StudentHomeLayout";
import ActivityPanel from "@/components/dashboard/ActivityPanel";
import type { ClassItem, ProfileStat } from "@/components/dashboard/types";

afterEach(cleanup);
const classes: ClassItem[] = ["Biology", "Chemistry"].map((title, index) => ({ id: `class-${index}`, title, teacher: "Alex Tutor", students: 12, progress: 0, next: "No upcoming work", subjectTag: title, accentColor: "#244ea0", motif: "grid", glyph: BookOpen }));
const notices = [0, 1].map(i => ({ id: `notice-${i}`, title: `Class notice ${i + 1}`, from: "Biology", when: "today" }));
const stats: ProfileStat[] = [
  { key: "exams", label: "Exams Completed", value: "2", icon: FileText, iconClass: "" },
  { key: "score", label: "Average Score", value: "78%", icon: Trophy, iconClass: "" },
  { key: "hours", label: "Total Study Hours", value: "0h", icon: Clock, iconClass: "" },
  { key: "streak", label: "Day Streak", value: "—", icon: Flame, iconClass: "" },
];
const profile = { name: "Alex Student", program: "GB", initials: "AS" };

describe("tablet Home composition", () => {
  it("retains account details, four independent summary actions and both create destinations without duplicate cards", () => {
    const open = [vi.fn(), vi.fn(), vi.fn(), vi.fn()], exam = vi.fn(), quiz = vi.fn();
    render(<div className="examly-home-route"><StudentHomeLayout isLaptop={false} profile={profile}
      profileStats={stats.map((stat, i) => ({ ...stat, onClick: open[i] }))} classes={classes} announcements={notices}
      statistics={<section aria-label="Subject breakdown" />} activity={<section aria-label="Recent work" />}
      onCreateExam={exam} onCreateQuiz={quiz} /></div>);
    const summary = within(screen.getByRole("region", { name: "Your study summary" }));
    expect(summary.getByText("Alex Student")).toBeVisible(); expect(summary.getByText("GB")).toBeVisible();
    stats.forEach(stat => fireEvent.click(summary.getByRole("button", { name: `${stat.label}: ${stat.value}` })));
    open.forEach(handler => expect(handler).toHaveBeenCalledOnce());
    fireEvent.click(summary.getByRole("button", { name: "Create Exam", exact: true }));
    fireEvent.click(summary.getByRole("button", { name: "Create Practice Quiz", exact: true }));
    expect(exam).toHaveBeenCalledOnce(); expect(quiz).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("region", { name: "My Classes", exact: true })).toHaveLength(1);
    expect(screen.getAllByRole("region", { name: "Announcements", exact: true })).toHaveLength(1);
    expect(screen.queryByText("Course progress")).not.toBeInTheDocument();
    expect(screen.queryByText("Your next practice session")).not.toBeInTheDocument();
  });

  it("retains carousel and activity selections when tablet and laptop presentations switch", () => {
    const store = new WorkspaceStore("alice"), go = vi.fn();
    const view = (isLaptop: boolean) => <WorkspaceContext.Provider value={{ ownerId: "alice", ready: true, store }}>
      <StudentHomeLayout isLaptop={isLaptop} profile={profile} profileStats={stats} classes={classes} announcements={notices}
        statistics={<section aria-label="Subject breakdown" />} onContinue={go}
        activity={<ActivityPanel mockExams={[]} quizzes={[{ id: "quiz", title: "Genetics practice", subject: "Biology", color: "#244ea0", questions: 5, best: null, when: "today" }]} />} />
    </WorkspaceContext.Provider>;
    const { rerender } = render(view(false));
    fireEvent.click(screen.getByRole("button", { name: "Next class", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Next announcement", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Practice Quizzes 1", exact: true }));
    rerender(view(true));
    expect(screen.getByRole("heading", { name: "Chemistry", exact: true })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Class notice 2", exact: true })).toBeVisible();
    expect(screen.getByRole("button", { name: "Practice Quizzes 1" })).toHaveAttribute("aria-pressed", "true");
    rerender(view(false));
    fireEvent.click(screen.getByRole("button", { name: "Continue", exact: true }));
    expect(go).toHaveBeenCalledWith("class-1");
    expect(screen.getByRole("button", { name: /Genetics practice/ })).toBeVisible();
  });

  it("keeps empty-state join/view actions and the selected announcement callback wired to their original owner", () => {
    const join = vi.fn(), view = vi.fn(), open = vi.fn();
    render(<StudentHomeLayout isLaptop={false} profile={profile} profileStats={stats} classes={[]} announcements={notices}
      statistics={null} activity={null} onJoinClass={join} onViewClasses={view} onOpenAnnouncement={open} />);
    expect(screen.getByRole("button", { name: "Next class", exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Join a class", exact: true }));
    fireEvent.click(screen.getAllByRole("button", { name: "View all classes", exact: true })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Next announcement", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Open class", exact: true }));
    expect(join).toHaveBeenCalledOnce(); expect(view).toHaveBeenCalledOnce(); expect(open).toHaveBeenCalledWith("notice-1");
  });
});
