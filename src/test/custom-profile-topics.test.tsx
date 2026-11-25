import { useState, type ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomProfileTopics, type CustomProfileTopicsProps } from "@/components/stats/profile/CustomProfileTopics";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { profileTopicLabel, profileTopicNotes } from "@/lib/profile-topic-presentation";

const db = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), upsert: vi.fn(), invoke: vi.fn() }));
const page = vi.hoisted(() => ({ profile: null as Record<string, unknown> | null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: db.getUser }, from: db.from, functions: { invoke: db.invoke },
} }));
vi.mock("@/components/dashboard/DashboardLayout", () => ({ DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/dashboard/SubjectSelector", () => ({ SubjectSelector: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
  <select aria-label="Subject" value={value} onChange={event => onValueChange(event.target.value)}>
    <option value="">Choose subject</option><option>Geography</option>
  </select>
) }));
vi.mock("@/hooks/useSubjectProfiles", () => ({ useSubjectProfiles: () => ({
  getProfilesForSubject: () => page.profile ? [page.profile] : [], getTopicsForSubject: () => [],
}) }));
vi.mock("@/hooks/useUserSubjects", () => ({ useUserSubjects: () => ({
  getSubjectColor: () => "#3388cc", getSubjectExamBoard: () => null, saveOrUpdateSubject: vi.fn(),
}) }));
vi.mock("@/hooks/useUserPreferences", () => ({ useUserPreferences: () => ({ preferences: {}, loading: false }) }));
vi.mock("@/hooks/useExamNameValidator", () => ({ useExamNameValidator: () => ({ isDuplicate: false, suggestions: [], checkName: vi.fn() }) }));
vi.mock("@/hooks/use-setup-draft", () => ({ useSetupDraft: () => ({ status: "idle", restored: false, clear: vi.fn() }) }));
vi.mock("@/components/subjects/ProfileScoreTrend", () => ({ ProfileScoreTrend: () => null }));
vi.mock("@/components/subjects/ProfileExamList", () => ({ ProfileExamList: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  db.getUser.mockResolvedValue({ data: { user: { id: "topic-owner" } }, error: null });
  db.from.mockReturnValue({ upsert: db.upsert });
  db.upsert.mockResolvedValue({ error: null });
});
afterEach(cleanup);

function props(overrides: Partial<CustomProfileTopicsProps> = {}): CustomProfileTopicsProps {
  return {
    topics: ["Rivers", "Coasts", "My local river case study"],
    allTopics: ["Rivers", "Coasts", "Ecosystems"],
    getTopicLabel: topic => topic, onChange: vi.fn(), onRename: vi.fn(), onUndo: vi.fn(),
    canUndo: false, subjectName: "Geography", accent: "#3388cc", ...overrides,
  };
}

function Controlled({ p }: { p: CustomProfileTopicsProps }) {
  const [topics, setTopics] = useState(p.topics);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<string[][]>([]);
  return <CustomProfileTopics {...p} topics={topics} getTopicLabel={topic => labels[topic] ?? p.getTopicLabel(topic)}
    canUndo={history.length > 0}
    onChange={next => { p.onChange(next); setHistory(current => [...current, topics]); setTopics(next); }}
    onRename={(topic, label) => { p.onRename(topic, label); setLabels(current => ({ ...current, [topic]: label })); }}
    onUndo={() => {
      p.onUndo();
      if (history.length) { setTopics(history[history.length - 1]); setHistory(current => current.slice(0, -1)); }
    }} />;
}

const search = (value: string) => fireEvent.change(screen.getByRole("searchbox", { name: "Search topics" }), { target: { value } });
const row = (name: string) => screen.getByRole("article", { name });
const switchView = (value: "profile" | "library") => fireEvent.change(screen.getByRole("combobox", { name: "Topic view" }), { target: { value } });
function expectNoWrites(p: CustomProfileTopicsProps) {
  for (const callback of [p.onChange, p.onRename, p.onUndo, db.getUser, db.from, db.invoke])
    expect(callback).not.toHaveBeenCalled();
}

describe("CustomProfileTopics", () => {
  it("opens on every saved row in original order, including absent library values, exact duplicates and case variants", () => {
    const p = props({ topics: ["Rivers", "Rivers", "rivers", " Legacy (BIO101) ", "My local river case study"] });
    const original = structuredClone(p.topics);
    render(<CustomProfileTopics {...p} />);
    expect(screen.getAllByRole("article").map(article => article.getAttribute("aria-label"))).toEqual(original);
    expect(screen.getByRole("button", { name: /In this profile/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/PDF|source outcomes|Your notes/i)).not.toBeInTheDocument();
    expect(p.topics).toEqual(original);
    expectNoWrites(p);
  });

  it("searches labels and canonical values and keeps sorting, view changes and selection presentation-only", () => {
    const p = props({ getTopicLabel: topic => topic === "Rivers" ? "Waterways" : topic });
    const original = structuredClone([p.topics, p.allTopics]);
    render(<CustomProfileTopics {...p} />);
    for (const query of ["waterways", "RIVERS"]) {
      search(query);
      expect(row("Waterways")).toBeVisible();
      expect(screen.getAllByRole("article")).toHaveLength(1);
    }
    search("");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort topics" }), { target: { value: "alphabetical" } });
    expect(screen.getAllByRole("article").map(article => article.getAttribute("aria-label")))
      .toEqual(["Coasts", "My local river case study", "Waterways"]);
    fireEvent.click(screen.getByRole("button", { name: "Select topics" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Waterways" }));
    switchView("library");
    search("Rivers");
    expect(row("Waterways")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /In this profile/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Sort topics" }), { target: { value: "original" } });
    expect(screen.getAllByRole("article").map(article => article.getAttribute("aria-label")))
      .toEqual(["Waterways", "Coasts", "My local river case study"]);
    expect([p.topics, p.allTopics]).toEqual(original);
    expectNoWrites(p);
  });

  it("gives icon-only Add/Edit/Remove actions 44px targets, accessible names and conservative titles", () => {
    render(<CustomProfileTopics {...props()} />);
    for (const name of ["Add topic", "Edit Rivers", "Remove Rivers"]) {
      const button = screen.getByRole("button", { name });
      expect(button.textContent).toBe("");
      expect(button).toHaveAttribute("title", name);
      expect(button).toHaveClass("h-11", "w-11");
      expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("disables ambiguous duplicate renames while keeping case-sensitive canonical variants editable", () => {
    const p = props({ topics: ["Rivers", "Rivers", "rivers"] });
    render(<CustomProfileTopics {...p} />);
    for (const button of screen.getAllByRole("button", { name: "Edit Rivers" })) {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("title", expect.stringContaining("saved more than once"));
      fireEvent.click(button);
    }
    expect(screen.getByRole("button", { name: "Edit rivers" })).toBeEnabled();
    expectNoWrites(p);
  });

  it("renames only the display label using the original canonical ID and renders markup as text", async () => {
    const p = props();
    render(<Controlled p={p} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Rivers" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.queryByLabelText(/notes/i)).not.toBeInTheDocument();
    fireEvent.change(dialog.getByLabelText("Topic name"), { target: { value: "  <img src=x onerror=alert(1)>  " } });
    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    expect(p.onRename).toHaveBeenCalledExactlyOnceWith("Rivers", "<img src=x onerror=alert(1)>");
    expect(row("<img src=x onerror=alert(1)>")).toHaveTextContent("Original name: Rivers");
    expect(document.querySelector("img")).toBeNull();
    expect(p.onChange).not.toHaveBeenCalled();
    expect(p.topics).toEqual(["Rivers", "Coasts", "My local river case study"]);
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit <img src=x onerror=alert(1)>" })).toHaveFocus());
    expect(db.from).not.toHaveBeenCalled();
  });

  it("keeps invalid renames open and rejects a stale canonical topic after a parent update", () => {
    const p = props();
    const view = render(<CustomProfileTopics {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit Rivers" }));
    fireEvent.change(screen.getByLabelText("Topic name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("alert")).toHaveTextContent("1–180");
    fireEvent.change(screen.getByLabelText("Topic name"), { target: { value: "Waterways" } });
    view.rerender(<CustomProfileTopics {...p} topics={["Coasts"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("alert")).toHaveTextContent("no longer in your profile");
    expectNoWrites(p);
  });

  it("restores keyboard focus after a nested dialog closes with Escape or Cancel", async () => {
    const p = props();
    render(<Dialog open><DialogContent><DialogTitle>Custom profile</DialogTitle>
      <DialogDescription>Edit your topics.</DialogDescription><CustomProfileTopics {...p} />
    </DialogContent></Dialog>);
    const add = screen.getByRole("button", { name: "Add topic" });
    add.focus();
    fireEvent.click(add);
    await waitFor(() => expect(screen.getByLabelText("New topics")).toHaveFocus());
    fireEvent.keyDown(screen.getByLabelText("New topics"), { key: "Escape" });
    await waitFor(() => expect(add).toHaveFocus());
    const edit = screen.getByRole("button", { name: "Edit Rivers" });
    fireEvent.click(edit);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(edit).toHaveFocus());
    expectNoWrites(p);
  });

  it("removes one duplicate occurrence, delegates Undo and keeps the final-topic guard", () => {
    const p = props({ topics: ["Rivers", "Rivers", "rivers"] });
    render(<Controlled p={p} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Rivers" })[0]);
    expect(p.onChange).toHaveBeenLastCalledWith(["Rivers", "rivers"]);
    fireEvent.click(screen.getByRole("button", { name: "Undo last topic change" }));
    expect(p.onUndo).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Rivers" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Remove rivers" }));
    expect(p.onChange).toHaveBeenLastCalledWith(["Rivers"]);
    const lastRemove = screen.getByRole("button", { name: "Remove Rivers" });
    expect(lastRemove).toBeDisabled();
    expect(lastRemove).toHaveAttribute("title", "Keep at least one topic in your profile.");
    fireEvent.click(lastRemove);
    expect(p.onChange).toHaveBeenCalledTimes(3);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("bulk selects across searches, reselects shown rows and guards against removing every topic", () => {
    const p = props({ topics: ["Rivers", "Coasts", "Ecosystems"] });
    render(<Controlled p={p} />);
    fireEvent.click(screen.getByRole("button", { name: "Select topics" }));
    fireEvent.click(screen.getByRole("button", { name: "Select shown" }));
    expect(screen.getByRole("button", { name: "Remove selected topics" })).toBeDisabled();
    expect(screen.getByText("Keep at least one topic in your profile.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Deselect shown" }));
    search("Rivers");
    fireEvent.click(screen.getByRole("button", { name: "Select shown" }));
    fireEvent.click(screen.getByRole("button", { name: "Deselect shown" }));
    fireEvent.click(screen.getByRole("button", { name: "Select shown" }));
    search("Coasts");
    expect(screen.getByText("1 selected (1 outside this view)")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Select shown" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove selected topics" }));
    expect(p.onChange).toHaveBeenCalledExactlyOnceWith(["Ecosystems"]);
    switchView("library");
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Rivers" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Include Coasts" }));
    expect(p.onChange).toHaveBeenLastCalledWith(["Ecosystems", "Rivers", "Coasts"]);
    expect(db.from).not.toHaveBeenCalled();
    expect(db.getUser).not.toHaveBeenCalled();
  });

  it("library checkboxes preserve case variants and never rewrite a saved topic to a library spelling", () => {
    const p = props({ topics: ["Rivers", "rivers", "Legacy"], allTopics: ["Rivers", "rivers", "RIVERS"] });
    render(<Controlled p={p} />);
    switchView("library");
    const otherCase = screen.getByRole("checkbox", { name: "Include RIVERS" });
    expect(otherCase).toBeChecked();
    expect(otherCase).toBeDisabled();
    fireEvent.click(otherCase);
    expect(p.onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Include rivers" }));
    expect(p.onChange).toHaveBeenCalledExactlyOnceWith(["Rivers", "Legacy"]);
    expect(db.from).not.toHaveBeenCalled();
  });

  it("guards against clearing the last canonical value through the library", () => {
    const p = props({ topics: ["Rivers", "Rivers"] });
    render(<CustomProfileTopics {...p} />);
    switchView("library");
    const checkbox = screen.getByRole("checkbox", { name: "Include Rivers" });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expectNoWrites(p);
  });

  it("cleans/deduplicates only new comma/newline values and upserts only new library topics for the current owner", async () => {
    const p = props({ topics: ["Rivers", "Rivers", "rivers", " Legacy (BIO101) "] });
    const original = structuredClone(p.topics);
    render(<Controlled p={p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
    fireEvent.change(screen.getByLabelText("New topics"), { target: {
      value: "[Hazards](https://example.test), hazards\nRIVERS\r\nCoasts, https://example.test\n Local   study (field) ",
    } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(p.onChange).toHaveBeenCalledExactlyOnceWith([...original, "hazards", "Coasts", "Local study field"]);
    await waitFor(() => expect(db.upsert).toHaveBeenCalledExactlyOnceWith([
      { user_id: "topic-owner", subject_name: "Geography", topic: "hazards" },
      { user_id: "topic-owner", subject_name: "Geography", topic: "Local study field" },
    ], { onConflict: "user_id,subject_name,topic", ignoreDuplicates: true }));
    expect(db.from).toHaveBeenCalledExactlyOnceWith("user_custom_topics");
    expect(db.invoke).not.toHaveBeenCalled();
    expect(p.topics).toEqual(original);
    switchView("library");
    expect(screen.getByRole("checkbox", { name: "Include hazards" })).toBeChecked();
  });

  it("rejects empty or already included additions without library calls", () => {
    const p = props();
    render(<CustomProfileTopics {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
    fireEvent.change(screen.getByLabelText("New topics"), { target: { value: "RIVERS, rivers\nhttps://example.test, " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a new topic");
    expectNoWrites(p);
  });

  it.each(["database", "session", "network"])("keeps draft additions and reports a %s library failure", async failure => {
    if (failure === "database") db.upsert.mockResolvedValue({ error: { message: "failed" } });
    if (failure === "session") db.getUser.mockResolvedValue({ data: { user: null }, error: null });
    if (failure === "network") db.getUser.mockRejectedValue(new Error("offline"));
    const p = props();
    render(<Controlled p={p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
    fireEvent.change(screen.getByLabelText("New topics"), { target: { value: "My fieldwork" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await screen.findByText("Topics added to this profile. Saving them to your topic library failed.");
    expect(row("My fieldwork")).toBeVisible();
    expect(p.onChange).toHaveBeenCalledExactlyOnceWith([...p.topics, "My fieldwork"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("retries the owner-scoped library upsert on a later explicit add after a failure", async () => {
    db.upsert.mockResolvedValueOnce({ error: { message: "offline" } });
    const p = props();
    render(<Controlled p={p} />);
    const add = () => {
      fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
      fireEvent.change(screen.getByLabelText("New topics"), { target: { value: "My fieldwork" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
    };
    add();
    await screen.findByText("Topics added to this profile. Saving them to your topic library failed.");
    fireEvent.click(screen.getByRole("button", { name: "Remove My fieldwork" }));
    add();
    await waitFor(() => expect(db.upsert).toHaveBeenCalledTimes(2));
    expect(row("My fieldwork")).toBeVisible();
  });

  it.each(["disabled", "locked"] as const)("blocks all mutation controls when %s while allowing browsing", state => {
    const p = props({ [state]: true, canUndo: true });
    render(<CustomProfileTopics {...p} />);
    for (const name of ["Add topic", "Edit Rivers", "Remove Rivers", "Select topics", "Undo last topic change"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled();
      fireEvent.click(button);
    }
    if (state === "locked") expect(screen.getByRole("button", { name: "Edit Rivers" })).toHaveAttribute("title", expect.stringContaining("Choose Custom"));
    search("Rivers");
    expect(row("Rivers")).toBeVisible();
    switchView("library");
    for (const checkbox of screen.getAllByRole("checkbox")) expect(checkbox).toBeDisabled();
    expectNoWrites(p);
  });

  it("respects disabled state if saving starts while a child editor is open", () => {
    const p = props();
    const view = render(<CustomProfileTopics {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
    fireEvent.change(screen.getByLabelText("New topics"), { target: { value: "My fieldwork" } });
    view.rerender(<CustomProfileTopics {...p} disabled />);
    expect(screen.getByLabelText("New topics")).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Add" }).closest("form")!);
    expectNoWrites(p);
  });

  it("retains every manual topic above the AI limit when browsing and adding", () => {
    const p = props({ topics: Array.from({ length: 405 }, (_, index) => `Saved ${index}`), allTopics: ["Library topic"] });
    render(<CustomProfileTopics {...p} />);
    expect(screen.getAllByRole("article")).toHaveLength(405);
    fireEvent.click(screen.getByRole("button", { name: "Add topic" }));
    fireEvent.change(screen.getByLabelText("New topics"), { target: { value: "Library topic" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(p.onChange).toHaveBeenCalledExactlyOnceWith([...p.topics, "Library topic"]);
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("whole-profile topic presentation", () => {
  const topics = ["Rivers", "Coasts"];
  const topicEdits = [{ topic: "Rivers", label: "Waterways" }];

  it("reads manual labels from existing JSON without altering canonical identity or unrelated metadata", () => {
    const profile = { topics, profile_template: null, paper_blueprint: { topicEdits, sections: [{ topic: "Rivers" }], future: { value: 1 } } };
    const original = JSON.stringify(profile);
    expect(profileTopicLabel(profile, "Rivers")).toBe("Waterways");
    expect(profileTopicLabel(profile, "Coasts")).toBe("Coasts");
    expect(profileTopicLabel(profile, "rivers")).toBe("rivers");
    expect(profileTopicNotes(profile, "Rivers")).toBe("");
    expect(JSON.stringify(profile)).toBe(original);
    expect(profile.profile_template).toBeNull();
  });

  it("keeps raw AI templates, contexts, snapshots and whole profiles working with the same validation", () => {
    const template = { topics, topicEdits: [{ ...topicEdits[0], notes: "Existing AI notes" }] };
    for (const value of [template, { template }, { context: { template } }, { profile_template: { template }, topics, paper_blueprint: { topicEdits: [{ topic: "Rivers", label: "Wrong manual label" }] } }]) {
      expect(profileTopicLabel(value, "Rivers")).toBe("Waterways");
      expect(profileTopicNotes(value, "Rivers")).toBe("Existing AI notes");
    }
    const tooMany = { ...template, topics: Array.from({ length: 401 }, (_, index) => index ? `Topic ${index}` : "Rivers") };
    expect(profileTopicLabel(tooMany, "Rivers")).toBe("Rivers");
    expect(profileTopicLabel({ profile_template: tooMany }, "Rivers")).toBe("Rivers");
    expect(profileTopicLabel({ ...template, topicEdits: [{ topic: "Rivers", label: "x".repeat(181) }] }, "Rivers")).toBe("Rivers");
  });

  it("allows more than 400 manual rows and labels, including unchanged long legacy canonical strings", () => {
    const topics = Array.from({ length: 450 }, (_, index) => index ? `Topic ${index}` : "Legacy ".repeat(40));
    const profile = { topics, paper_blueprint: { topicEdits: topics.map((topic, index) => ({ topic, label: `Display ${index}` })) } };
    expect(profileTopicLabel(profile, topics[0])).toBe("Display 0");
    expect(profileTopicLabel(profile, topics[449])).toBe("Display 449");
    expect(profile.topics).toHaveLength(450);
  });

  it.each([
    null, "invalid", {}, { topicEdits: "invalid" },
    { topicEdits: [null] },
    { topicEdits: [{ topic: "Unknown", label: "Waterways" }] },
    { topicEdits: [{ topic: "Rivers", label: "" }] },
    { topicEdits: [{ topic: "Rivers", label: 42 }] },
    { topicEdits: [{ topic: "Rivers", label: "x".repeat(181) }] },
    { topicEdits: [topicEdits[0], topicEdits[0]] },
  ])("falls back to exact canonical values for malformed manual metadata %j", paper_blueprint => {
    expect(profileTopicLabel({ topics, paper_blueprint }, "Rivers")).toBe("Rivers");
  });

  it("rejects ambiguous duplicate canonical edits, mixed topic types and invalid AI metadata without using manual labels", () => {
    expect(profileTopicLabel({ topics: ["Rivers", "Rivers"], paper_blueprint: { topicEdits } }, "Rivers")).toBe("Rivers");
    expect(profileTopicLabel({ topics: ["Rivers", null], paper_blueprint: { topicEdits } }, "Rivers")).toBe("Rivers");
    expect(profileTopicLabel({ topics, profile_template: { topics, topicEdits: [null] }, paper_blueprint: { topicEdits } }, "Rivers")).toBe("Rivers");
    expect(profileTopicLabel({ topics, profile_template: "invalid", paper_blueprint: { topicEdits } }, "Rivers")).toBe("Rivers");
  });

  it.each([undefined, null, {}, { topics }, { topics, profile_template: null, paper_blueprint: {} }])("keeps legacy labels canonical without aliases: %j", profile => {
    expect(profileTopicLabel(profile, " Legacy (BIO101) ")).toBe(" Legacy (BIO101) ");
  });
});

describe("manual labels at page call-sites", () => {
  const canonical = "Local river (GEO101)";
  const alias = "My river revision";
  const queries: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

  beforeEach(() => {
    queries.length = 0;
    page.profile = {
      id: "manual-profile", subject_name: "Geography", profile_name: "Manual geography",
      topics: [canonical, "Coasts"], question_count: 6, educational_tier: "gcse_igcse",
      exam_board: "AQA", time_limit_minutes: null, profile_template: null,
      paper_blueprint: { topicEdits: [{ topic: canonical, label: alias }], future: { retained: true } },
    };
    db.from.mockImplementation((table: string) => {
      const read = { table, filters: [] as Array<[string, unknown]> };
      queries.push(read);
      const data = table === "subject_exam_profiles" ? page.profile
        : table === "student_answers" ? [{ score: 2, exam_questions: { topic_tag: canonical, marks: 4 } }]
        : table === "subject_subtopics" ? [{ subtopic: "Coasts" }] : [];
      const query = {
        select: () => query, eq: (key: string, value: unknown) => { read.filters.push([key, value]); return query; },
        single: () => query, in: () => query, not: () => query, order: () => query,
        or: () => query, ilike: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
      };
      return query;
    });
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  it("CreateExam displays manual labels from the whole saved profile while session topic changes retain canonical values", async () => {
    const { default: CreateExam } = await import("@/pages/CreateExam");
    const original = JSON.stringify(page.profile);
    render(<MemoryRouter><CreateExam /></MemoryRouter>);
    const subject = screen.getByRole("combobox", { name: "Subject" });
    await waitFor(() => expect(subject).toBeVisible());
    fireEvent.change(subject, { target: { value: "Geography" } });
    const chooser = within(await screen.findByRole("dialog", { name: "Use Your Custom Curriculum?" }));
    fireEvent.click(chooser.getByRole("button", { name: /Manual geography/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: alias })).toBeVisible());
    fireEvent.click(screen.getByRole("button", { name: alias }));
    expect(screen.getByRole("button", { name: alias })).toHaveAttribute("title", "Tap to include");
    expect(screen.getByRole("button", { name: "Coasts" })).toHaveAttribute("title", "Tap to exclude");
    expect(JSON.stringify(page.profile)).toBe(original);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.invoke).not.toHaveBeenCalled();
  });

  it("CreatePracticeQuestions displays manual labels while selecting/searching exact canonical topic IDs", async () => {
    const { default: CreatePracticeQuestions } = await import("@/pages/CreatePracticeQuestions");
    const original = JSON.stringify(page.profile);
    render(<MemoryRouter><CreatePracticeQuestions /></MemoryRouter>);
    fireEvent.change(screen.getByRole("combobox", { name: "Subject" }), { target: { value: "Geography" } });
    fireEvent.click(await screen.findByRole("button", { name: /Manual geography/ }));
    expect(await screen.findByRole("button", { name: alias })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: alias }));
    fireEvent.click(screen.getByText("1 subtopic selected"));
    const input = screen.getByPlaceholderText("Search or type new subtopic...");
    fireEvent.change(input, { target: { value: alias } });
    const option = await screen.findByRole("option", { name: alias });
    expect(option).toHaveAttribute("data-value", canonical);
    fireEvent.change(input, { target: { value: canonical } });
    expect(screen.getByRole("option", { name: alias })).toBeVisible();
    expect(JSON.stringify(page.profile)).toBe(original);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.invoke).not.toHaveBeenCalled();
  });

  it("ProfileDetail displays manual labels while scoring and quiz navigation retain canonical identity", async () => {
    const { default: ProfileDetail } = await import("@/pages/ProfileDetail");
    const original = JSON.stringify(page.profile);
    function Destination() {
      const location = useLocation();
      return <output aria-label="Quiz destination">{location.pathname + location.search}</output>;
    }
    render(<MemoryRouter initialEntries={["/my-subjects/Geography/manual-profile"]}><Routes>
      <Route path="/my-subjects/:subjectName/:profileId" element={<ProfileDetail />} />
      <Route path="/create-practice-questions" element={<Destination />} />
    </Routes></MemoryRouter>);
    const button = (await screen.findByText(alias)).closest("button")!;
    expect(within(button).getByText("50%")).toBeVisible();
    expect(queries.find(query => query.table === "student_answers")?.filters)
      .toContainEqual(["exam_questions.profile_id", "manual-profile"]);
    fireEvent.click(button);
    const destination = await screen.findByLabelText("Quiz destination");
    const url = new URL(destination.textContent!, "https://fixture.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ subject: "Geography", subtopic: canonical, profileId: "manual-profile" });
    expect(JSON.stringify(page.profile)).toBe(original);
    expect(db.upsert).not.toHaveBeenCalled();
    expect(db.invoke).not.toHaveBeenCalled();
  });
});
