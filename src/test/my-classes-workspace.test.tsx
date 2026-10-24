import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { WorkspaceContext, WorkspaceStore } from "@/hooks/use-workspace-session";
import { workspaceQueryClient } from "@/lib/workspace-query-client";
import { TooltipProvider } from "@/components/ui/tooltip";
import MyClasses, { type GroupAssignment, type StudentGroup, type SubmissionData } from "@/pages/MyClasses";

const fake = vi.hoisted(() => ({
  read: vi.fn(), getUser: vi.fn(), success: vi.fn(), error: vi.fn(),
  writeError: false,
  subjects: [{ id: "saved-biology", subject_id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", subject_name: "Biology", subject_color: "#247251" }],
  writes: [] as Array<{ table: string; payload: unknown; filters: Array<[string, unknown]> }>,
  onWrite: (_groupId: string) => {},
}));
vi.mock("@/lib/classes-query", () => ({ classesQuery: () => ({ queryKey: ["workspace-classes"], queryFn: fake.read, retry: false }) }));
vi.mock("@/integrations/supabase/exam-metadata-client", () => ({ supabase: {
  auth: { getUser: fake.getUser },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: vi.fn(),
  from: (table: string) => {
    const write = { table, payload: undefined as unknown, filters: [] as Array<[string, unknown]> };
    const chain = {
      update: (payload: unknown) => { write.payload = payload; return chain; },
      eq: (key: string, value: unknown) => { write.filters.push([key, value]); return chain; },
      then: (resolve: (result: unknown) => void, reject: (error: unknown) => void) => {
        fake.writes.push(write);
        if (!fake.writeError) fake.onWrite(String(write.filters.find(([key]) => key === "group_id")?.[1]));
        return Promise.resolve({ error: fake.writeError ? new Error("Membership update failed") : null }).then(resolve, reject);
      },
    };
    return chain;
  },
} }));
vi.mock("sonner", () => ({ toast: { success: fake.success, error: fake.error } }));
vi.mock("@/hooks/useUserSubjects", () => ({ useUserSubjects: () => ({
  subjects: fake.subjects,
  getSubjectColor: (name: string) => name.toLowerCase() === "biology" ? "#247251" : "#3565b5",
}) }));
vi.mock("@/components/dashboard/DashboardLayout", () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/tutor/JoinClassModal", () => ({ JoinClassModal: ({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (open: boolean) => void; onSuccess: () => void }) => open ? <section role="dialog" aria-label="Join a class"><button onClick={() => { onSuccess(); onOpenChange(false); }}>Confirm joined class</button><button onClick={() => onOpenChange(false)}>Close join preview</button></section> : null }));
vi.mock("@/components/classes/ClassDetailView", () => ({ ClassDetailView: ({ group, onBack, onLeave }: { group: StudentGroup; onBack: () => void; onLeave: () => void }) => <section aria-label="Selected class"><h1>Class detail: {group.name}</h1><button onClick={onBack}>Back to classes</button><button onClick={onLeave}>Leave selected class</button></section> }));

const groups: StudentGroup[] = [
  { id: "biology-group", name: "A Level Biology", tutor_id: "tutor-biology", subjects_covered: [{ name: "Biology" }] },
  { id: "maths-group", name: "Mathematics Workshop", tutor_id: "tutor-maths", subjects_covered: [{ name: "Mathematics" }] },
];
const assigned: GroupAssignment[] = [
  { id: "a", exam_id: "exam-a", exam_title: "Biological molecules", exam_type: "generated", group_id: "biology-group", group_name: "A Level Biology", deadline: "2026-10-26T17:00:00" },
  { id: "b", exam_id: "exam-b", exam_title: "Functions and graphs", exam_type: "uploaded", group_id: "maths-group", group_name: "Mathematics Workshop", deadline: "2026-10-27T17:00:00" },
  { id: "c", exam_id: "exam-c", exam_title: "Independent class revision", exam_type: "generated", group_id: "biology-group", group_name: "A Level Biology" },
  { id: "d", exam_id: "exam-d", exam_title: "Submitted cells assessment", exam_type: "generated", group_id: "biology-group", group_name: "A Level Biology", deadline: "2026-10-20T17:00:00" },
];
function snapshot() {
  return {
    firstName: "Alex", groups: [...groups], assignments: [...assigned],
    tutors: new Map([["tutor-biology", { name: "Dr Wilson" }], ["tutor-maths", { name: "Ms Reed" }]]),
    submissions: new Map<string, SubmissionData>([["exam-a", { status: "in_progress" }], ["exam-d", { status: "submitted" }]]),
    announcements: [{ id: "notice-1", title: "Assessment preparation", message: "Revisit your notes before the next assessment.", created_at: "2026-10-23T09:00:00", group_id: "biology-group", group_name: "A Level Biology" }],
    feedbackThreads: [],
  };
}
let data: ReturnType<typeof snapshot>, store: WorkspaceStore;
function open(path = "/my-classes", ownerStore = store) {
  return render(<WorkspaceContext.Provider value={{ ownerId: ownerStore.ownerId, ready: true, store: ownerStore }}><TooltipProvider><MemoryRouter initialEntries={[path]}><MyClasses /></MemoryRouter></TooltipProvider></WorkspaceContext.Provider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  data = snapshot(); store = new WorkspaceStore("alice", 1);
  fake.read.mockImplementation(async () => data);
  fake.getUser.mockResolvedValue({ data: { user: { id: "alice" } }, error: null });
  fake.writes = []; fake.writeError = false;
  fake.onWrite = id => { data = { ...data, groups: data.groups.filter(group => group.id !== id) }; };
});
afterEach(() => { cleanup(); workspaceQueryClient(store).clear(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("My Classes redesigned workspace", () => {
  it("shows the truthful no-assignment state without a redundant View all action", async () => {
    data = { ...data, assignments: [], submissions: new Map() };
    open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    const assignmentsSection = within(screen.getByRole("region", { name: /Your assignments/i }));
    expect(assignmentsSection.getByRole("heading", { name: "No assignments yet" })).toBeVisible();
    expect(assignmentsSection.getByText("Work set by your teacher or tutor will appear here.")).toBeVisible();
    expect(assignmentsSection.queryByRole("button", { name: /View all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All assignments/i })).toBeVisible();
    expect(screen.queryByRole("status", { name: "Loading your classes" })).not.toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("distinguishes caught-up submitted work from a class that has never received assignments", async () => {
    data = { ...data, submissions: new Map(assigned.map(assignment => [assignment.exam_id, { status: "submitted" }])) };
    open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    const assignmentsSection = within(screen.getByRole("region", { name: /Your assignments/i }));
    expect(assignmentsSection.getByRole("heading", { name: /all caught up/i })).toBeVisible();
    expect(assignmentsSection.queryByRole("heading", { name: "No assignments yet" })).not.toBeInTheDocument();
    expect(assignmentsSection.queryByRole("button", { name: /View all/i })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: /All assignments/i }), { key: "Enter" });
    expect(within(screen.getByRole("tabpanel")).getAllByRole("article")).toHaveLength(assigned.length);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("shares the selected announcement class across overview/full tabs and restores it without extra reads on filtering", async () => {
    data = { ...data, announcements: [...data.announcements, { ...data.announcements[0], id: "notice-maths", group_id: "maths-group", group_name: "Mathematics Workshop", title: "Maths preparation" }] };
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    const initialReads = fake.read.mock.calls.length;
    const filter = within(screen.getByRole("group", { name: "Filter announcements by class" }));
    fireEvent.click(filter.getByRole("button", { name: "Mathematics Workshop" }));
    expect(screen.getByRole("heading", { name: "Maths preparation" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Assessment preparation" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: /Announcements/i }), { key: "Enter" });
    expect(screen.getByRole("button", { name: "Mathematics Workshop" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "Assessment preparation" })).not.toBeInTheDocument();
    expect(fake.read).toHaveBeenCalledTimes(initialReads);
    first.unmount(); open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Mathematics Workshop" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.queryByRole("heading", { name: "Assessment preparation" })).not.toBeInTheDocument();
    expect(fake.writes).toEqual([]);
  });

  it("does not carry an announcement class filter into a different account", async () => {
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    fireEvent.click(within(screen.getByRole("group", { name: "Filter announcements by class" })).getByRole("button", { name: "Mathematics Workshop" }));
    expect(screen.queryByRole("heading", { name: "Assessment preparation" })).not.toBeInTheDocument();
    first.unmount();
    const otherStore = new WorkspaceStore("bob", 1);
    const second = open("/my-classes", otherStore);
    await screen.findByRole("button", { name: "Open A Level Biology" });
    expect(screen.getByRole("button", { name: "All classes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: "Assessment preparation" })).toBeVisible();
    second.unmount(); workspaceQueryClient(otherStore).clear();
  });

  it.each(["Biology", "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa"])("renders a real tutor-written subject entry %s across cards and deadlines", async subject => {
    // Supabase's existing JSON column also contains string[] written by the tutor UI.
    data = { ...data, groups: [{ ...groups[0], subjects_covered: [subject] as unknown as StudentGroup["subjects_covered"] }] };
    const original = data.groups[0].subjects_covered;
    open();
    const card = await screen.findByRole("button", { name: "Open A Level Biology" });
    expect(within(card).getByText("Biology")).toBeVisible();
    expect(card.style.getPropertyValue("--class-subject-colour")).toBe("#247251");
    expect(screen.getByRole("region", { name: "Assignment deadline calendar" })).toBeVisible();
    expect(data.groups[0].subjects_covered).toBe(original);
    expect(data.groups[0].subjects_covered).toEqual([subject]);
  });

  it("searches actual class and tutor names, retaining the search when returning to the page", async () => {
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    const search = screen.getByRole("textbox", { name: /Search classes or tutors/i });
    fireEvent.change(search, { target: { value: "Reed" } });
    expect(screen.getByRole("button", { name: "Open Mathematics Workshop" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open A Level Biology" })).not.toBeInTheDocument();
    first.unmount(); open();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Search classes or tutors/i })).toHaveValue("Reed"));
    expect(screen.queryByRole("button", { name: "Open A Level Biology" })).not.toBeInTheDocument();
  });

  it("opens only a joined class referenced by its direct link", async () => {
    open("/my-classes?classId=biology-group");
    expect(await screen.findByRole("heading", { name: "Class detail: A Level Biology" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Class detail: Mathematics Workshop" })).not.toBeInTheDocument();
  });

  it("does not carry the previous account's class search into another account", async () => {
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    fireEvent.change(screen.getByRole("textbox", { name: /Search classes or tutors/i }), { target: { value: "Reed" } });
    first.unmount();
    const otherStore = new WorkspaceStore("bob", 1);
    const second = open("/my-classes", otherStore);
    await screen.findByRole("button", { name: "Open A Level Biology" });
    expect(screen.getByRole("textbox", { name: /Search classes or tutors/i })).toHaveValue("");
    second.unmount(); workspaceQueryClient(otherStore).clear();
  });

  it("returns from a directly opened class without reopening it on refresh", async () => {
    open("/my-classes?classId=biology-group");
    await screen.findByRole("heading", { name: "Class detail: A Level Biology" });
    fireEvent.click(screen.getByRole("button", { name: "Back to classes" }));
    expect(await screen.findByRole("button", { name: "Open A Level Biology" })).toBeVisible();
    await act(async () => { await workspaceQueryClient(store).refetchQueries({ queryKey: ["workspace-classes"] }); });
    expect(screen.queryByRole("heading", { name: "Class detail: A Level Biology" })).not.toBeInTheDocument();
  });

  it("keeps an unknown or inaccessible class link on the authorised overview", async () => {
    open("/my-classes?classId=not-a-member");
    expect(await screen.findByRole("button", { name: "Open A Level Biology" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Selected class" })).not.toBeInTheDocument();
  });

  it("keeps completed and undated assigned work available in the full assignments tab and retains the selected tab", async () => {
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    fireEvent.keyDown(screen.getByRole("tab", { name: /All assignments/i }), { key: "Enter" });
    const panel = screen.getByRole("tabpanel");
    expect(within(panel).getByRole("article", { name: "Submitted cells assessment" })).toBeVisible();
    expect(within(panel).getByRole("article", { name: "Independent class revision" })).toBeVisible();
    expect(within(panel).queryByText("0%")).not.toBeInTheDocument();
    first.unmount(); open();
    await waitFor(() => expect(screen.getByRole("tab", { name: /All assignments/i })).toHaveAttribute("aria-selected", "true"));
  });

  it("keeps actionable work visible when several older assignments have closed", async () => {
    const closed = [1, 2, 3].map(day => ({ ...assigned[0], id: `closed-${day}`, exam_id: `closed-exam-${day}`, exam_title: `Closed assessment ${day}`, deadline: `2026-10-0${day}T17:00:00` }));
    data = { ...data, assignments: [...closed, assigned[0]] };
    open(); await screen.findByRole("button", { name: "Open A Level Biology" });
    const preview = within(screen.getByRole("region", { name: "Your assignments" }));
    expect(preview.getByRole("article", { name: "Biological molecules" })).toBeVisible();
    expect(preview.getAllByRole("article")[0]).toHaveAttribute("aria-label", "Biological molecules");
    fireEvent.keyDown(screen.getByRole("tab", { name: /All assignments/i }), { key: "Enter" });
    const fullList = within(screen.getByRole("tabpanel"));
    closed.forEach(assignment => expect(fullList.getByRole("article", { name: assignment.exam_title })).toBeVisible());
    expect(fullList.getByRole("article", { name: "Biological molecules" })).toBeVisible();
  });

  it("filters actual deadline work by date while retaining undated work and the selected date on return", async () => {
    const first = open();
    await screen.findByRole("button", { name: "Open A Level Biology" });
    const schedule = within(screen.getByRole("region", { name: "Upcoming deadlines" }));
    expect(schedule.getByRole("article", { name: "Biological molecules" })).toBeVisible();
    expect(schedule.getByRole("article", { name: "Functions and graphs" })).toBeVisible();
    expect(schedule.getByRole("article", { name: "Independent class revision" })).toBeVisible();
    expect(schedule.queryByRole("article", { name: "Submitted cells assessment" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("gridcell", { name: "Monday, 26 October 2026, 1 assignment due" }));
    expect(schedule.queryByRole("article", { name: "Functions and graphs" })).not.toBeInTheDocument();
    expect(schedule.getByRole("article", { name: "Independent class revision" })).toBeVisible();
    first.unmount(); open();
    await waitFor(() => expect(screen.getByRole("button", { name: "Show whole month" })).toBeVisible());
    const returnedSchedule = within(screen.getByRole("region", { name: "Upcoming deadlines" }));
    expect(returnedSchedule.queryByRole("article", { name: "Functions and graphs" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show whole month" }));
    expect(returnedSchedule.getByRole("article", { name: "Functions and graphs" })).toBeVisible();
  });

  it("opens the existing join flow and refreshes only after its success callback", async () => {
    open(); await screen.findByRole("button", { name: "Open A Level Biology" });
    const initialReads = fake.read.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /Join a class/i }));
    expect(screen.getByRole("dialog", { name: "Join a class" })).toBeVisible();
    expect(fake.writes).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Confirm joined class" }));
    await waitFor(() => expect(fake.read.mock.calls.length).toBeGreaterThan(initialReads));
  });

  it("requires leave confirmation and scopes the confirmed update to the verified student and class", async () => {
    open("/my-classes?classId=biology-group");
    await screen.findByRole("heading", { name: "Class detail: A Level Biology" });
    fireEvent.click(screen.getByRole("button", { name: "Leave selected class" }));
    const confirmation = screen.getByRole("alertdialog");
    fireEvent.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    expect(fake.writes).toEqual([]);
    expect(screen.getByRole("heading", { name: "Class detail: A Level Biology" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Leave selected class" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Leave Class$/i }));
    await waitFor(() => expect(fake.writes).toEqual([{ table: "group_members", payload: { is_active: false }, filters: [["group_id", "biology-group"], ["student_id", "alice"]] }]));
    expect(fake.getUser).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Class detail: A Level Biology" })).not.toBeInTheDocument());
  });

  it("keeps the class when a confirmed leave request fails", async () => {
    fake.writeError = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    open("/my-classes?classId=biology-group");
    await screen.findByRole("heading", { name: "Class detail: A Level Biology" });
    fireEvent.click(screen.getByRole("button", { name: "Leave selected class" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /^Leave Class$/i }));
    await waitFor(() => expect(fake.error).toHaveBeenCalledWith("Failed to leave class"));
    expect(screen.getByRole("heading", { name: "Class detail: A Level Biology" })).toBeVisible();
    expect(data.groups).toHaveLength(2);
  });

  it("shows a retryable first-load error and recovers without a fabricated empty state", async () => {
    fake.read.mockRejectedValueOnce(new Error("Read unavailable"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn’t load your classes/i);
    expect(screen.queryByRole("button", { name: "Open A Level Biology" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Open A Level Biology" })).toBeVisible();
  });

  it("shows a structured loading state while the initial class read is pending", () => {
    fake.read.mockImplementation(() => new Promise(() => {}));
    open();
    expect(screen.getByRole("status", { name: "Loading your classes" })).toBeVisible();
    expect(screen.queryByText("No classes yet")).not.toBeInTheDocument();
  });

  it("distinguishes a genuinely empty membership list from loading and failure", async () => {
    data = { ...data, groups: [], assignments: [], announcements: [], tutors: new Map() };
    open();
    expect(await screen.findByRole("heading", { name: "No classes yet" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Join a class/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("status", { name: "Loading your classes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("retains loaded classes when a background refresh fails", async () => {
    open(); await screen.findByRole("button", { name: "Open A Level Biology" });
    fake.read.mockRejectedValue(new Error("Refresh unavailable"));
    await act(async () => { await workspaceQueryClient(store).refetchQueries({ queryKey: ["workspace-classes"] }); });
    expect(await screen.findByRole("alert")).toHaveTextContent(/last loaded information is still shown/i);
    expect(screen.getByRole("button", { name: "Open A Level Biology" })).toBeVisible();
  });
});
