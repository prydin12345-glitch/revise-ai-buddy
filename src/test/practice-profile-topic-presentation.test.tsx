import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CreatePracticeQuestions from "@/pages/CreatePracticeQuestions";
import type { ExamProfile } from "@/hooks/useSubjectProfiles";
import { prepareProfileSave, type BuilderProposal } from "../../supabase/functions/_shared/profile-builder-service";
import { templateFixture } from "../../supabase/tests/profile-builder-fixtures";

const state = vi.hoisted(() => ({
  profiles: [] as ExamProfile[],
  insert: vi.fn(),
  invoke: vi.fn(),
  clearDraft: vi.fn(),
  dbTopics: null as string[] | null,
}));

vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/dashboard/SubjectSelector", () => ({
  SubjectSelector: ({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="Subject" value={value} onChange={event => onValueChange(event.target.value)}>
      <option value="">Choose subject</option>
      <option>Biology</option>
      <option>Chemistry</option>
    </select>
  ),
}));
vi.mock("@/hooks/useUserSubjects", () => ({
  useUserSubjects: () => ({ getSubjectColor: () => "#3388cc", getSubjectExamBoard: () => null }),
}));
vi.mock("@/hooks/useSubjectProfiles", () => ({
  useSubjectProfiles: () => ({
    getProfilesForSubject: (subject: string) => state.profiles.filter(profile => profile.subject_name === subject),
    getTopicsForSubject: () => [],
  }),
}));
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({ preferences: {}, loading: false }),
}));
vi.mock("@/hooks/useExamNameValidator", () => ({
  useExamNameValidator: () => ({ isDuplicate: false, suggestions: [], checkName: vi.fn() }),
}));
vi.mock("@/hooks/use-setup-draft", () => ({
  useSetupDraft: () => ({ status: "idle", restored: false, clear: state.clearDraft }),
}));
vi.mock("@/components/exam/GenerationLoadingScreen", () => ({
  GenerationLoadingScreen: () => <p role="status">Generating fixture quiz</p>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: {
    getUser: async () => ({ data: { user: { id: "fixture-owner" } } }),
    getSession: async () => ({ data: { session: { user: { id: "fixture-owner" } } } }),
  },
  from: (table: string) => {
    if (table === "practice_question_sets") return {
      insert: (row: unknown) => {
        state.insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "fixture-set" }, error: null }) }) };
      },
    };
    const data = table === "subject_subtopics"
      ? (state.dbTopics ?? ["2.1.3 Enzyme Action (BIO101)", "DNA & RNA"]).map(subtopic => ({ subtopic }))
      : [];
    const query = {
      select: () => query,
      eq: () => query,
      or: () => query,
      ilike: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve),
    };
    return query;
  },
  functions: { invoke: (name: string, request: unknown) => state.invoke(name, request) },
} }));

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });

const canonicalTopics = ["2.1.3 Enzyme Action (BIO101)", "DNA & RNA"];
const alias = "My Enzyme Revision";
const privateNote = "Private revision reminder: discuss this with my tutor.";

function profile(options: { edits?: boolean; subject?: string; id?: string; label?: string | null } = {}) {
  const template = templateFixture();
  template.identity.subject = options.subject ?? "Biology";
  template.topics = [...canonicalTopics];
  template.sections[0].groups[0].parts.forEach((part, index) => { part.topic = canonicalTopics[index]; });
  if (options.edits !== false) template.topicEdits = [{ topic: canonicalTopics[0], label: options.label === null ? undefined : options.label ?? alias, notes: privateNote }];
  const proposal: BuilderProposal = {
    proposalVersion: 1, promptVersion: 1, origin: "model_knowledge_ai", presetId: null,
    evidence: null, evidenceVersion: null, profileSettings: null, template,
  };
  const saved = prepareProfileSave(proposal, template);
  return {
    ...saved.settings, id: options.id ?? "biology-profile", subject_name: template.identity.subject,
    profile_name: `${template.identity.subject} revision`, profile_template: saved.context,
  } as unknown as ExamProfile;
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function open(path = "/create-practice-questions") {
  render(<MemoryRouter initialEntries={[path]}><CreatePracticeQuestions /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText("Set Name"), { target: { value: "Fixture quiz" } });
}

async function chooseProfile(subject = "Biology") {
  fireEvent.change(screen.getByRole("combobox", { name: "Subject" }), { target: { value: subject } });
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`${subject} revision`) }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

async function generate() {
  fireEvent.click(screen.getByRole("button", { name: "Generate" }));
  await waitFor(() => expect(state.invoke).toHaveBeenCalledWith("generate-practice-questions", {
    body: { setId: "fixture-set", forceRefresh: true, questionCountMin: 1, questionCountMax: 4 },
  }));
  return state.insert.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  state.invoke.mockResolvedValue({ data: {}, error: null });
  state.profiles = [freeze(profile())];
  state.dbTopics = null;
});
afterEach(cleanup);

describe("practice profile topic presentation", () => {
  it("uses aliases for generated topics absent from the dictionary while sending canonical topics and the original profile identity", async () => {
    state.dbTopics = [canonicalTopics[1]];
    const original = JSON.stringify(state.profiles[0]);
    open();
    await chooseProfile();
    expect(screen.getAllByText(alias)).toHaveLength(2);
    expect(screen.queryByText(privateNote)).toBeNull();
    expect(screen.getAllByText("DNA & RNA")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: alias }));
    fireEvent.click(screen.getByText("1 subtopic selected"));
    const search = screen.getByPlaceholderText("Search or type new subtopic...");
    fireEvent.change(search, { target: { value: alias } });
    const option = await screen.findByRole("option", { name: alias });
    expect(option).toHaveAttribute("data-value", canonicalTopics[0]);
    fireEvent.change(search, { target: { value: canonicalTopics[0] } });
    expect(screen.getByRole("option", { name: alias })).toBeVisible();
    fireEvent.click(option);
    fireEvent.click(screen.getByText("2 subtopics selected"));

    const row = await generate();
    expect(row).toMatchObject({
      user_id: "fixture-owner", subject_id: "Biology", profile_id: "biology-profile",
      subtopics: [canonicalTopics[1], canonicalTopics[0]], notes: null,
      exam_board: "Example University", educational_tier: "Undergraduate module",
    });
    expect(JSON.stringify([row, state.invoke.mock.calls])).not.toContain(alias);
    expect(JSON.stringify([row, state.invoke.mock.calls])).not.toContain(privateNote);
    expect(row).not.toHaveProperty("profile_template");
    expect(JSON.stringify(state.profiles[0])).toBe(original);
  });

  it("typing an exact alias and pressing Enter adds the canonical topic once", async () => {
    open();
    await chooseProfile();
    fireEvent.click(screen.getByRole("button", { name: alias }));
    fireEvent.click(screen.getByText("1 subtopic selected"));
    const search = screen.getByPlaceholderText("Search or type new subtopic...");
    await screen.findByRole("option", { name: alias });
    fireEvent.change(search, { target: { value: alias } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect((await generate()).subtopics).toEqual([canonicalTopics[1], canonicalTopics[0]]);
  });

  it("excluding a displayed alias sends only the remaining canonical topic without changing the saved topic pool or part tags", async () => {
    const original = JSON.stringify(state.profiles[0]);
    open();
    await chooseProfile();
    fireEvent.click(screen.getByRole("button", { name: alias }));
    expect((await generate()).subtopics).toEqual([canonicalTopics[1]]);
    expect(JSON.stringify(state.profiles[0])).toBe(original);
    expect((state.profiles[0].profile_template as { template: { topics: string[] } }).template.topics).toEqual(canonicalTopics);
  });

  it("keeps options distinct when an alias matches another topic and Enter preserves the exact canonical match", async () => {
    state.profiles = [freeze(profile({ label: canonicalTopics[1] }))];
    open();
    await chooseProfile();
    fireEvent.click(screen.getAllByRole("button", { name: canonicalTopics[1] })[1]);
    fireEvent.click(screen.getByText("1 subtopic selected"));
    const search = screen.getByPlaceholderText("Search or type new subtopic...");
    await waitFor(() => expect(screen.getAllByRole("option", { name: canonicalTopics[1] })).toHaveLength(2));
    expect(screen.getAllByRole("option", { name: canonicalTopics[1] }).map(option => option.getAttribute("data-value"))).toEqual(canonicalTopics);
    fireEvent.change(search, { target: { value: canonicalTopics[1] } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect((await generate()).subtopics).toEqual(canonicalTopics);
  });

  it("keeps notes-only edits private while preserving explicit quiz instructions", async () => {
    state.profiles = [freeze(profile({ label: null }))];
    open();
    await chooseProfile();
    expect(screen.getAllByText(canonicalTopics[0])).toHaveLength(2);
    expect(screen.queryByText(privateNote)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Add custom instructions/), { target: { value: "Focus on short answers." } });
    const row = await generate();
    expect(row.subtopics).toEqual(canonicalTopics);
    expect(row.notes).toBe("Focus on short answers.");
    expect(JSON.stringify([row, state.invoke.mock.calls])).not.toContain(privateNote);
  });

  it.each([true, false])("keeps source capitalization and request values for profiles without edits (template: %s)", async withTemplate => {
    const saved = profile({ edits: false });
    if (!withTemplate) delete saved.profile_template;
    state.profiles = [freeze(saved)];
    open();
    await chooseProfile();
    expect(screen.getAllByText(canonicalTopics[0])).toHaveLength(2);
    expect(screen.getAllByText(canonicalTopics[1])).toHaveLength(2);
    expect(screen.queryByText(alias)).toBeNull();
    const row = await generate();
    expect(row.subtopics).toEqual(canonicalTopics);
    expect(row.profile_id).toBe(saved.id);
  });

  it("resolves aliases from the deep-linked profile without changing its subject or profile ID", async () => {
    open("/create-practice-questions?subject=Biology&profileId=biology-profile");
    await screen.findByRole("button", { name: alias });
    expect(await generate()).toMatchObject({ subject_id: "Biology", profile_id: "biology-profile", subtopics: canonicalTopics });
  });

  it("scopes aliases to the selected subject and profile even when canonical topics match", async () => {
    state.profiles.push(freeze(profile({ subject: "Chemistry", id: "chemistry-profile", label: "Chemistry Alias" })));
    open();
    await chooseProfile();
    expect(screen.getByRole("button", { name: alias })).toBeVisible();
    await chooseProfile("Chemistry");
    expect(screen.queryByText(alias)).toBeNull();
    expect(screen.getByRole("button", { name: "Chemistry Alias" })).toBeVisible();
    expect(await generate()).toMatchObject({ subject_id: "Chemistry", profile_id: "chemistry-profile", subtopics: canonicalTopics });
  });
});
