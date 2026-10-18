import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FileText, Trophy, Clock, Flame, BookOpen } from "lucide-react";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import DashboardSummaryStrip from "@/components/dashboard/DashboardSummaryStrip";
import DashboardContextCards from "@/components/dashboard/DashboardContextCards";
import SidebarAccount from "@/components/dashboard/SidebarAccount";
import ActivityPanel from "@/components/dashboard/ActivityPanel";
import type { ClassItem, ProfileStat } from "@/components/dashboard/types";
import type { ReactNode } from "react";

const backend = vi.hoisted(() => ({ from: vi.fn(), fail: false, owners: [] as string[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: backend.from } }));
beforeEach(() => {
  backend.fail = false; backend.owners = [];
  backend.from.mockImplementation((table: string) => {
    let owner = "";
    const query = {
      select: () => query,
      eq: (_field: string, value: string) => { owner = value; backend.owners.push(owner); return query; },
      maybeSingle: async () => ({
        data: table === "user_profiles" ? { first_name: owner, last_name: "Student", display_name: "Other name" } : { curriculum_region: "GB" },
        error: backend.fail ? { message: "Read unavailable" } : null,
      }),
    };
    return query;
  });
});
afterEach(cleanup);

const classes: ClassItem[] = ["Biology", "Chemistry", "Physics"].map((title, i) => ({
  id: `class-${i}`, title, teacher: "Tutor", students: 5 + i, progress: i * 10,
  next: "No upcoming work", subjectTag: title, accentColor: "#244ea0", motif: "grid", glyph: BookOpen,
}));
const announcements = [0, 1, 2].map(i => ({ id: `notice-${i}`, title: `Class notice ${i + 1}`, from: classes[i].title, when: "today" }));
function Scope({ children, store }: { children: ReactNode; store: WorkspaceStore }) {
  return <WorkspaceContext.Provider value={{ ownerId: store.ownerId, ready: true, store }}>{children}</WorkspaceContext.Provider>;
}

describe("laptop dashboard cards", () => {
  it("uses the existing four summary values and routes each drill-down independently", () => {
    const handlers = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const stats: ProfileStat[] = [
      { key: "exams", label: "Exams Completed", value: "2", icon: FileText, iconClass: "", onClick: handlers[0] },
      { key: "score", label: "Average Score", value: "78%", icon: Trophy, iconClass: "", onClick: handlers[1] },
      { key: "hours", label: "Total Study Hours", value: "0h", icon: Clock, iconClass: "", onClick: handlers[2] },
      { key: "streak", label: "Day Streak", value: "—", icon: Flame, iconClass: "", onClick: handlers[3] },
    ];
    render(<DashboardSummaryStrip stats={stats} />);
    const strip = within(screen.getByRole("region", { name: "Your study summary" }));
    expect(strip.getAllByRole("button")).toHaveLength(4);
    for (const stat of stats) fireEvent.click(strip.getByRole("button", { name: `${stat.label}: ${stat.value}` }));
    handlers.forEach(handler => expect(handler).toHaveBeenCalledOnce());
  });
  it("switches class cards in both directions, wraps, and continues the visible class", () => {
    const onContinue = vi.fn();
    render(<Scope store={new WorkspaceStore("alice")}><DashboardContextCards classes={classes} announcements={announcements} onContinue={onContinue} /></Scope>);
    const card = within(screen.getByRole("region", { name: "My Classes" }));
    fireEvent.click(card.getByRole("button", { name: "Next class" }));
    expect(card.getByRole("heading", { name: "Chemistry" })).toBeVisible();
    fireEvent.click(card.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith("class-1");
    fireEvent.click(card.getByRole("button", { name: "Previous class" }));
    fireEvent.click(card.getByRole("button", { name: "Previous class" }));
    expect(card.getByRole("heading", { name: "Physics" })).toBeVisible();
    expect(card.getByText("Tutor", { selector: "dd" })).toBeVisible();
    expect(card.getByText("7 students", { selector: "dd" })).toBeVisible();
    expect(card.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("switches notices independently and opens the visible notice, retaining selections on return", () => {
    const store = new WorkspaceStore("alice"), open = vi.fn();
    const view = () => <Scope store={store}><DashboardContextCards classes={classes} announcements={announcements} onOpenAnnouncement={open} /></Scope>;
    const first = render(view());
    fireEvent.click(screen.getByRole("button", { name: "Next announcement" }));
    fireEvent.click(screen.getByRole("button", { name: "Open class" }));
    expect(open).toHaveBeenCalledWith("notice-1");
    expect(within(screen.getByRole("region", { name: "My Classes" })).getByRole("heading", { name: "Biology" })).toBeVisible();
    first.unmount(); render(view());
    expect(screen.getByRole("heading", { name: "Class notice 2" })).toBeVisible();
  });
  it("uses the first remaining item if the selected item is removed and isolates accounts", () => {
    const alice = new WorkspaceStore("alice"), bob = new WorkspaceStore("bob");
    const view = (store: WorkspaceStore, items = classes) => <Scope store={store}><DashboardContextCards classes={items} announcements={[]} /></Scope>;
    const { rerender } = render(view(alice));
    fireEvent.click(screen.getByRole("button", { name: "Next class" }));
    rerender(view(alice, [classes[0]]));
    expect(screen.getByRole("heading", { name: "Biology" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Next class" })).toBeDisabled();
    rerender(view(bob));
    expect(screen.getByRole("heading", { name: "Biology" })).toBeVisible();
  });
  it("offers join/view actions for empty lists without fabricated progress", () => {
    const join = vi.fn(), view = vi.fn();
    render(<Scope store={new WorkspaceStore("alice")}><DashboardContextCards classes={[]} announcements={[]} onJoinClass={join} onViewClasses={view} /></Scope>);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText("Class announcements will appear here.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Previous announcement" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next class" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Join a class" }));
    fireEvent.click(screen.getAllByRole("button", { name: "View all classes" })[0]);
    expect(join).toHaveBeenCalledOnce(); expect(view).toHaveBeenCalledOnce();
  });
});

describe("recent activity selector", () => {
  it("announces the selected type and preserves the existing row and View all actions", () => {
    const store = new WorkspaceStore("alice"), openExam = vi.fn(), startQuiz = vi.fn(), viewAll = vi.fn();
    const view = () => <Scope store={store}><ActivityPanel
      mockExams={[{ id: "exam", title: "Biology paper", subject: "Biology", color: "#244ea0", score: 78, status: "done", when: "today" }]}
      quizzes={[{ id: "quiz", title: "Genetics practice", subject: "Biology", color: "#244ea0", questions: 5, best: null, when: "today" }]}
      onOpenExam={openExam} onStartQuiz={startQuiz} onViewAll={viewAll}
    /></Scope>;
    const first = render(view());
    const selector = within(screen.getByRole("group", { name: "Recent activity type" }));
    expect(selector.getByRole("button", { name: "Mock Exams 1" })).toHaveAttribute("aria-pressed", "true");
    expect(selector.getByRole("button", { name: "Practice Quizzes 1" })).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /Biology paper/ }));
    expect(openExam).toHaveBeenCalledWith("exam");
    fireEvent.click(selector.getByRole("button", { name: "Practice Quizzes 1" }));
    expect(selector.getByRole("button", { name: "Practice Quizzes 1" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Genetics practice/ }));
    expect(startQuiz).toHaveBeenCalledWith("quiz");
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(viewAll).toHaveBeenCalledWith("quizzes");
    first.unmount(); render(view());
    expect(screen.getByRole("button", { name: "Practice Quizzes 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Genetics practice/ })).toBeVisible();
  });
  it("keeps both zero-count choices visible with their existing empty states", () => {
    render(<Scope store={new WorkspaceStore("alice")}><ActivityPanel mockExams={[]} quizzes={[]} /></Scope>);
    expect(screen.getByRole("button", { name: "Mock Exams 0" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Practice Quizzes 0" }));
    expect(screen.getByRole("button", { name: "Practice Quizzes 0" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Your recent quizzes will appear here. Use Create Quiz to get started.")).toBeInTheDocument();
  });
});

describe("desktop sidebar identity", () => {
  it("reads the current owner's existing name and region fields without writes", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Scope store={new WorkspaceStore("Alice")}><SidebarAccount /></Scope></QueryClientProvider>);
    expect(screen.getByLabelText("Loading account details")).toBeVisible();
    expect(await screen.findByText("Alice Student")).toBeVisible();
    expect(screen.getByText("GB")).toBeVisible();
    expect(backend.owners).toEqual(["Alice", "Alice"]);
  });
  it("does not show the previous owner's details after an account switch", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (owner: string) => <QueryClientProvider client={client}><Scope store={new WorkspaceStore(owner)}><SidebarAccount /></Scope></QueryClientProvider>;
    const { rerender } = render(view("Alice"));
    await screen.findByText("Alice Student");
    rerender(view("Bob"));
    expect(screen.queryByText("Alice Student")).not.toBeInTheDocument();
    expect(await screen.findByText("Bob Student")).toBeVisible();
  });
  it("keeps a usable account fallback when the read fails", async () => {
    backend.fail = true;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><Scope store={new WorkspaceStore("Alice")}><SidebarAccount /></Scope></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText("Your account")).toBeVisible());
    expect(screen.queryByText("Alice Student")).not.toBeInTheDocument();
  });
});
