import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import { ExamlyApprovalBadge } from "@/components/profiles/ExamlyApprovalBadge";
import { APPROVAL_REGISTRY } from "../../supabase/functions/_shared/preset-approval";
import {
  templateFromPreset,
  prepareProfileSave,
  type BuilderProposal,
} from "../../supabase/functions/_shared/profile-builder-service";
import { SOURCE_REGISTRY } from "../../supabase/functions/_shared/profile-source-registry";
import { fingerprint } from "../../supabase/functions/_shared/profile-fingerprint";
import { canonical } from "../../supabase/functions/_shared/profile-template";
import {
  templateFixture,
  pearsonTemplate,
} from "../../supabase/tests/profile-builder-fixtures";
import type { BuilderApi } from "@/lib/profile-builder-client";
import { supabase } from "@/integrations/supabase/client";
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: { preferred_educational_level: "level3" },
  }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: vi.fn(),
  },
}));
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
Object.defineProperty(HTMLElement.prototype, "scrollTo", {
  configurable: true,
  value: vi.fn(),
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const entry = APPROVAL_REGISTRY.find(
  (e) => e.component === "H420/03" && e.mode === "full_mock",
)!;
const props = {
  open: true,
  onOpenChange: vi.fn(),
  onManual: vi.fn(),
  subjectName: "Biology",
  examBoard: "OCR",
  educationalLevel: "level3",
};
function memoryApi() {
  const proposals = new Map<string, BuilderProposal>(),
    profiles = new Map<string, any>(),
    calls: any[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "propose") {
      let p: BuilderProposal;
      if (input.presetId) p = templateFromPreset(String(input.presetId));
      else {
        const t = input.sourceId ? pearsonTemplate(input.mode === "full_mock" ? "full_mock" : "short_practice") : templateFixture();
        t.mode = input.mode as typeof t.mode;
        p = {
          proposalVersion: 1,
          promptVersion: 1,
          template: t,
          origin: input.sourceId ? "source_backed_ai" : "model_knowledge_ai",
          evidence: input.sourceId ? SOURCE_REGISTRY[0].evidence : null,
          evidenceVersion: input.sourceId
            ? fingerprint(canonical(SOURCE_REGISTRY[0].evidence))
            : null,
          presetId: null,
          profileSettings: null,
        };
      }
      proposals.set(String(input.requestId), p);
      return { proposal: p, proposalId: String(input.requestId) };
    }
    if (input.action === "save") {
      const p = proposals.get(String(input.proposalId))!;
      const saved = prepareProfileSave(p, input.template),
        profile = {
          ...saved.settings,
          id: input.profileId ?? crypto.randomUUID(),
          profile_name: input.profileName,
          profile_template: { ...saved.context, proposalId: input.proposalId },
        };
      profiles.set(String(profile.id), profile);
      return { profile, approval: saved.approval };
    }
    throw Error("Unexpected action");
  };
  return { api, calls, proposals, profiles };
}
const enterManualAssessment = (value: string) => {
  fireEvent.change(screen.getByLabelText("Assessment"), {
    target: { value: "__manual" },
  });
  fireEvent.change(screen.getByLabelText("Assessment name (manual)"), {
    target: { value },
  });
};
async function approvedReview(api: BuilderApi, initialMode?: "short_practice") {
  render(<ExamProfileBuilder {...props} initialMode={initialMode} api={api} />);
  fireEvent.change(screen.getByLabelText("Course variant"), {
    target: { value: "ocr_alevel_biology_a_h420" },
  });
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await screen.findByRole("button", { name: "Edit profile" });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled(),
  );
}
it("uses the existing editor container and keeps the manual route available", () => {
  render(
    <ExamProfileModal
      open
      onOpenChange={vi.fn()}
      subjectName="Biology"
      subjectColor="#378b63"
      examBoard="OCR"
      availableTopics={["Cells"]}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  expect(screen.getByRole("dialog").className).toContain("sm:max-w-2xl");
  fireEvent.click(screen.getByRole("button", { name: "Manual editor" }));
  expect(
    screen.getByRole("button", { name: "Advanced settings" }),
  ).toBeInTheDocument();
});
it.each([false, true])("new modal builder uses full paper when initialBuilder is %s", async initialBuilder => {
  const proposal = templateFromPreset(entry.id);
  vi.mocked(supabase.functions.invoke).mockResolvedValue({
    data: { proposal, proposalId: crypto.randomUUID() }, error: null,
  });
  render(<ExamProfileModal open onOpenChange={vi.fn()} subjectName="Biology"
    subjectColor="#378b63" examBoard="OCR" availableTopics={[]} onSave={vi.fn()}
    initialBuilder={initialBuilder} />);
  if (!initialBuilder) fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  expect(screen.getByText("Full paper profile.")).toBeVisible();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Course variant"), { target: { value: "ocr_alevel_biology_a_h420" } });
  fireEvent.change(screen.getByLabelText("Paper"), { target: { value: "paper_3" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled());
  expect(supabase.functions.invoke).toHaveBeenCalledExactlyOnceWith("profile-builder", {
    body: expect.objectContaining({ action: "propose", mode: "full_mock", presetId: entry.id }),
  });
});
it.each(["full_mock", "short_practice", "custom"] as const)("only offers approved presets compatible with %s", mode => {
  render(<ExamProfileBuilder {...props} initialMode={mode} api={vi.fn()} />);
  const options = within(screen.getByLabelText("Approved preset")).getAllByRole("option", { hidden: true });
  const ids = options.slice(1).map(option => (option as HTMLOptionElement).value);
  if (mode === "custom") expect(ids).toEqual([]);
  else expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(templateFromPreset(id).template.mode).toBe(mode);
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
});
it.each(["short_practice", "custom"] as const)("modal editing and saving retain the saved %s mode", async mode => {
  const r = memoryApi(), template = templateFixture();
  template.mode = mode;
  const proposal: BuilderProposal = {
    proposalVersion: 1, promptVersion: 1, template, origin: "model_knowledge_ai",
    evidence: null, evidenceVersion: null, presetId: null, profileSettings: null,
  };
  const receipt = crypto.randomUUID(), id = crypto.randomUUID();
  const saved = prepareProfileSave(proposal, template);
  r.proposals.set(receipt, proposal);
  vi.mocked(supabase.functions.invoke).mockImplementation(async (_name, options) => ({
    data: await r.api(options!.body as Record<string, unknown>), error: null,
  }));
  render(<ExamProfileModal open onOpenChange={vi.fn()} subjectName="Biology"
    subjectColor="#378b63" availableTopics={[]} onSave={vi.fn()}
    initialData={{ id, profile_name: "Legacy profile", topics: template.topics, question_count: 2,
      profile_template: { ...saved.context, proposalId: receipt } }} />);
  expect(screen.getByText(mode === "short_practice" ? "Short practice" : "Custom assessment", { selector: "span" })).toBeVisible();
  expect(r.calls).toHaveLength(0);
  fireEvent.click(screen.getByRole("tab", { name: "Exam settings" }));
  fireEvent.change(screen.getByLabelText("Profile name"), { target: { value: "Renamed legacy profile" } });
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(r.profiles.size).toBe(1));
  expect(r.calls).toEqual([expect.objectContaining({ action: "save", profileId: id,
    proposalId: receipt, profileName: "Renamed legacy profile", template: expect.objectContaining({ mode }) })]);
  expect(r.profiles.get(id).profile_template.template.mode).toBe(mode);
  cleanup();
  render(<ExamProfileBuilder {...props} initialProfile={r.profiles.get(id)} initialMode="full_mock" api={r.api} />);
  expect(screen.getByText(mode === "short_practice" ? "Short practice" : "Custom assessment", { selector: "span" })).toBeVisible();
  expect(r.calls).toHaveLength(1);
});
it("defaults to a full OCR Paper 3 with its actual marks, parts and an accessible star", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
  expect(screen.getByText("70", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText("90", { selector: "strong" })).toBeInTheDocument();
  expect(r.calls[0].mode).toBe("full_mock");
  expect(r.calls[0].presetId).toBe(entry.id);
  expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
});
it("retains an explicitly requested legacy short preset without showing a mode selector", async () => {
  const r = memoryApi();
  await approvedReview(r.api, "short_practice");
  expect(r.calls[0]).toMatchObject({ mode: "short_practice" });
  expect(templateFromPreset(r.calls[0].presetId).template.mode).toBe("short_practice");
  expect(screen.getByText("20", { selector: "strong" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
});
it("editing generation settings removes active approval, and explicit restore recovers it", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText("Time limit (minutes)"), {
    target: { value: "27" },
  });
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Customised from an Examly-approved preset"),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Restore approved settings" }),
  );
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
});
it("rename, confirmation and reopening preserve approval and saved provenance", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "My renamed paper" },
  });
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() => expect(r.profiles.size).toBe(1));
  const profile = [...r.profiles.values()][0];
  cleanup();
  render(
    <ExamProfileBuilder {...props} initialProfile={profile} api={r.api} />,
  );
  expect(
    screen.getByRole("heading", { name: "My renamed paper" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  expect(screen.getByLabelText("Profile name")).toHaveValue("My renamed paper");
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
});
it("invalid edited mark totals block confirmation rather than becoming generation-ready", async () => {
  const r = memoryApi();
  await approvedReview(r.api);
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText("Total marks"), {
    target: { value: "71" },
  });
  expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent(/Achievable marks/);
});
it("a source-backed unsupported course opens the subtopic editor with no approval star", async () => {
  const r = memoryApi();
  render(<ExamProfileBuilder {...props} api={r.api} />);
  fireEvent.change(screen.getByLabelText("Registered source"), { target: { value: "pearson-9bi0-01-issue4" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await screen.findByRole("region", { name: "AI exam profile editor" });
  expect(screen.queryByRole("img", { name: "Examly-approved preset" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Topics — one per line")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add subtopic" })).toBeEnabled();
  const row = screen.getAllByRole("article")[0];
  fireEvent.click(within(row).getByRole("button", { name: /^Edit / }));
  expect(screen.getByRole("textbox", { name: "Subtopic name" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("tab", { name: "Syllabus & source" }));
  expect(screen.getByText("Source-backed AI draft")).toBeInTheDocument();
  expect(r.calls).toHaveLength(1);
});

it("missing source requires explicit choice and never starts a model-backed proposal", () => {
  const r = memoryApi();
  render(
    <ExamProfileBuilder
      {...props}
      curriculumRegion="US"
      educationalLevel="undergrad"
      examBoard="Example University"
      api={r.api}
    />,
  );
  enterManualAssessment("Final");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    screen.queryByRole("button", { name: "Yes, build it" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/Add your syllabus/);
  expect(screen.getByText("Full paper profile.")).toBeVisible();
  expect(screen.getByText(/Choose quiz topics and length later/)).toBeVisible();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "General practice without a syllabus" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: /Full mock|Short practice|Custom assessment/ })).not.toBeInTheDocument();
  expect(r.calls).toHaveLength(0);
});
it.each(["short_practice", "custom"] as const)("keeps explicit legacy %s general-practice opt-in and API mode", async mode => {
  const r = memoryApi();
  render(
    <ExamProfileBuilder
      {...props}
      subjectName="Physics"
      curriculumRegion="US"
      educationalLevel="undergrad"
      examBoard="Example University"
      initialMode={mode}
      api={r.api}
    />,
  );
  enterManualAssessment("Paper 1");
  fireEvent.click(
    screen.getByRole("button", { name: "General practice without a syllabus" }),
  );
  expect(
    screen.getByText(/may not match your real assessment/),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  expect(screen.queryByText("Full paper profile.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(r.calls).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await screen.findByRole("region", { name: "AI exam profile editor" });
  expect(r.calls).toHaveLength(1);
  expect(r.calls[0]).toMatchObject({ action: "propose", mode, unverified: true });
});
it("a cancelled in-flight response cannot reopen preview or save a profile", async () => {
  let resolve: any;
  const api: BuilderApi = () =>
    new Promise((r) => {
      resolve = r;
    });
  const closed = vi.fn();
  const view = render(
    <ExamProfileBuilder {...props} onOpenChange={closed} api={api} />,
  );
  fireEvent.change(screen.getByLabelText("Course variant"), {
    target: { value: "ocr_alevel_biology_a_h420" },
  });
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await waitFor(() => expect(typeof resolve).toBe("function"));
  fireEvent.click(
    screen.getByRole("button", { name: "Close profile builder" }),
  );
  view.rerender(
    <ExamProfileBuilder
      {...props}
      open={false}
      onOpenChange={closed}
      api={api}
    />,
  );
  resolve({
    proposalId: crypto.randomUUID(),
    proposal: templateFromPreset(entry.id),
  });
  await waitFor(() => expect(closed).toHaveBeenCalledWith(false));
  expect(screen.queryByLabelText("Profile name")).not.toBeInTheDocument();
});
it("a transport interruption checks the original receipt without another proposal", async () => {
  const calls: any[] = [],
    api: BuilderApi = async (input) => {
      calls.push(input);
      throw Error("Transport interrupted");
    };
  render(<ExamProfileBuilder {...props} api={api} />);
  fireEvent.change(screen.getByLabelText("Course variant"), {
    target: { value: "ocr_alevel_biology_a_h420" },
  });
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_3" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));
  await screen.findByText("Transport interrupted");
  fireEvent.click(screen.getByRole("button", { name: "Check progress" }));
  await waitFor(() => expect(calls).toHaveLength(2));
  expect(calls[1]).toEqual({
    action: "source_status",
    jobId: calls[0].requestId,
  });
});
it("revoked and source-backed badges never render the gold star", () => {
  render(<ExamlyApprovalBadge approval={{ status: "revoked", entry: null }} />);
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText("Preset approval revoked")).toBeInTheDocument();
});
