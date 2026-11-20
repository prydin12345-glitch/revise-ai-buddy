import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import {
  readPendingBuilderJob,
  rememberPendingBuilderJob,
  type BuilderApi,
  type BuilderResponse,
  type SourceJobView,
} from "@/lib/profile-builder-client";
import { identitySchema } from "../../supabase/functions/_shared/profile-template";

const fixture = vi.hoisted(() => ({ inspect: vi.fn(), invoke: vi.fn(), owner: "recovery-owner" }));
vi.mock("@/lib/inspect-profile-attachments", () => ({ inspectProfileAttachments: fixture.inspect }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: fixture.owner } } } }) },
    functions: { invoke: fixture.invoke },
  },
}));

const props = {
  open: true,
  onOpenChange: vi.fn(),
  onManual: vi.fn(),
  onDelete: vi.fn(),
  subjectName: "Business",
  examBoard: "Edexcel",
  educationalLevel: "level3",
  curriculumRegion: "GB",
};
const assessment = "Paper 1 — Marketing, people and global businesses";
const pageQuestion = "Which physical PDF pages describe this assessment?";
const sourceQuestion = "Choose a readable specification or assessment brief.";
const stopped = "This build stopped safely. Your saved profiles are unchanged.";
const sourceIssue = "The selected pages could not be safely linked to this assessment.";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  fixture.inspect.mockResolvedValue({
    version: 3,
    candidates: [{
      id: "business-paper-1", label: assessment, canonicalComponent: "Paper 1",
      kind: "paper", aliases: ["Paper 1"], references: [],
    }],
    warnings: [], needsManualEntry: false, ambiguous: false,
  });
});
afterEach(cleanup);

function sourceJob(input: Record<string, unknown>, patch: Partial<SourceJobView> = {}): SourceJobView {
  return {
    jobId: String(input.requestId), stage: "failed", revision: 4,
    identity: identitySchema.parse(input.identity), mode: input.mode as SourceJobView["mode"],
    progress: { completed: 1, total: 2 }, message: stopped, canAdvance: false,
    ...patch,
  };
}

async function attachAndRead() {
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode("A-level Business\nPaper 1\nMarketing, people and global businesses\n100 marks");
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: { files: [{ name: "business.txt", type: "text/plain", size: bytes.length, arrayBuffer: async () => bytes.buffer }] },
  });
  await screen.findByRole("option", { name: assessment });
  fireEvent.change(screen.getByRole("combobox", { name: /^(Assessment|Paper)$/ }), {
    target: { value: "paper_1" },
  });
  await waitFor(() => expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await waitFor(() => expect(screen.getByRole("dialog")).toHaveAttribute("aria-describedby"));
}

const recoveryVariants: Array<{ label: string; patch: Partial<SourceJobView> }> = [
  {
    label: "failed extraction with source diagnostics",
    patch: { validationIssues: [{ attempt: 1, stage: "extraction", code: "missing_reference", message: sourceIssue }] },
  },
  {
    label: "failed extraction with assessment choices",
    patch: { assessmentChoices: [{ id: "paper-1", kind: "paper", label: "Paper 1" }] },
  },
  { label: "needs_details without a resumable question", patch: { stage: "needs_details", needs: [sourceIssue] } },
  {
    label: "needs_details with a focused page question",
    patch: { stage: "needs_details", missingItems: [{ field: "source_pages", question: pageQuestion }] },
  },
  {
    label: "needs_details with a focused source picker",
    patch: { stage: "needs_details", missingItems: [{ field: "source", question: sourceQuestion }] },
  },
];

it.each(recoveryVariants)("offers usable recovery for $label without discarding the receipt or replaying it", async ({ patch }) => {
  const api = vi.fn<BuilderApi>(async input => ({ job: sourceJob(input, patch) }));
  render(<ExamProfileBuilder {...props} api={api} />);
  await attachAndRead();
  const change = await screen.findByRole("button", { name: "Change details or documents" });
  await waitFor(() => expect(change).toBeEnabled());
  expect(screen.getByRole("button", { name: "Start new build" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Start new build" })).toBeEnabled();
  expect(screen.getByText("business.txt")).toBeVisible();
  expect(api).toHaveBeenCalledTimes(1);
  const receipt = String(api.mock.calls[0][0].requestId);
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: receipt });

  fireEvent.click(change);
  expect(screen.getByLabelText("Educational level")).toBeVisible();
  expect(screen.getByRole("combobox", { name: /^(Assessment|Paper)$/ })).toHaveValue("paper_1");
  expect(screen.getByRole("button", { name: "Replace files" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Read syllabus" })).toBeDisabled();
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: receipt });
  expect(api).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Start new build" }));
  const dialog = screen.getByRole("alertdialog", { name: "Start a new build?" });
  expect(dialog).toHaveTextContent("A fresh build may use AI.");
  expect(dialog).toHaveTextContent("Starting again makes no AI call");
  fireEvent.click(within(dialog).getByRole("button", { name: "Keep current build" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(screen.getByText("business.txt")).toBeVisible();
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: receipt });
  expect(api).toHaveBeenCalledTimes(1);
});

it("restarts only after confirmation, retains the upload and selections, then prepares a fresh receipt only on Read syllabus", async () => {
  const api = vi.fn<BuilderApi>(async input => ({ job: sourceJob(input) }));
  render(<ExamProfileBuilder {...props} initialMode="full_mock" api={api} />);
  fireEvent.change(screen.getByLabelText("Specification version / teaching dates (optional)"), {
    target: { value: "Issue 1 2026" },
  });
  await attachAndRead();
  const start = await screen.findByRole("button", { name: "Start new build" });
  await waitFor(() => expect(start).toBeEnabled());
  const first = api.mock.calls[0][0];
  // Restart must clear only this subject's selected request.
  const otherReceipt = crypto.randomUUID();
  await rememberPendingBuilderJob("Biology", otherReceipt);
  fireEvent.click(start);
  expect(api).toHaveBeenCalledTimes(1);
  const confirmation = screen.getByRole("alertdialog");
  fireEvent.click(within(confirmation).getByRole("button", { name: "Start again" }));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(await readPendingBuilderJob("Business")).toBeNull();
  expect(await readPendingBuilderJob("Biology")).toEqual({ jobId: otherReceipt });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("business.txt")).toBeVisible();
  expect(screen.getByRole("combobox", { name: /^(Assessment|Paper)$/ })).toHaveValue("paper_1");
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  expect(screen.getByText("Full paper profile.")).toBeVisible();
  expect(first.mode).toBe("full_mock");
  expect(screen.getByLabelText("Specification version / teaching dates (optional)")).toHaveValue("Issue 1 2026");
  expect(api).toHaveBeenCalledTimes(1);
  expect(props.onDelete).not.toHaveBeenCalled();
  expect(fixture.invoke).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  const second = api.mock.calls[1][0];
  expect(second).toEqual({ ...first, requestId: second.requestId });
  expect(second.requestId).not.toBe(first.requestId);
  expect(second.uploads).toEqual(first.uploads);
  expect(api.mock.calls.map(([input]) => input.action)).toEqual(["prepare_source", "prepare_source"]);
});

it("reopens a persisted failed receipt through a status check and restores its identity without another extraction", async () => {
  let failed: SourceJobView;
  const api = vi.fn<BuilderApi>(async input => {
    if (input.action === "source_status") return { job: failed };
    failed = sourceJob(input, {
      validationIssues: [{ attempt: 1, stage: "extraction", code: "missing_reference", message: sourceIssue }],
    });
    return { job: failed };
  });
  const view = render(<ExamProfileBuilder {...props} api={api} />);
  await attachAndRead();
  expect(await screen.findByLabelText("Profile validation details")).toHaveTextContent(sourceIssue);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  view.rerender(<ExamProfileBuilder {...props} open={false} api={api} />);
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: failed!.jobId });
  view.rerender(<ExamProfileBuilder {...props} api={api} />);
  const resume = await screen.findByRole("button", { name: "Resume request" });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(resume);
  expect(await screen.findByLabelText("Profile validation details")).toHaveTextContent(sourceIssue);
  const change = screen.getByRole("button", { name: "Change details or documents" });
  await waitFor(() => expect(change).toBeEnabled());
  fireEvent.click(change);
  await waitFor(() => expect(screen.getByRole("combobox", { name: /^(Assessment|Paper)$/ })).toHaveValue("paper_1"));
  expect(screen.getByText("business.txt")).toBeVisible();
  expect(screen.getByRole("button", { name: "Start new build" })).toBeEnabled();
  expect(api.mock.calls.map(([input]) => input.action)).toEqual(["prepare_source", "source_status"]);
  expect(api.mock.calls[1][0]).toEqual({ action: "source_status", jobId: failed!.jobId });
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: failed!.jobId });
});

it("continues a focused page followup once on the same receipt and disables recovery while the answer is in flight", async () => {
  let original: SourceJobView;
  let finish: (response: BuilderResponse) => void;
  const api = vi.fn<BuilderApi>(async input => {
    if (input.action === "answer_source") return new Promise(resolve => { finish = resolve; });
    original = sourceJob(input, {
      stage: "needs_details", revision: 8,
      missingItems: [{ field: "source_pages", question: pageQuestion }],
    });
    return { job: original };
  });
  render(<ExamProfileBuilder {...props} api={api} />);
  await attachAndRead();
  const pages = await screen.findByLabelText(pageQuestion);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  fireEvent.change(pages, { target: { value: "14-15" } });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(api.mock.calls[1][0]).toEqual({
    action: "answer_source", jobId: original!.jobId, revision: 8, answers: { source_pages: "14-15" },
  });
  expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Start new build" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Change details or documents" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Checking…" }));
  expect(api).toHaveBeenCalledTimes(2);
  await act(async () => finish!({ job: { ...original!, stage: "ready", missingItems: [], revision: 9 } }));
  expect(screen.getByRole("button", { name: "Yes, build it" })).toBeEnabled();
  expect(screen.getByText("business.txt")).toBeVisible();
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: original!.jobId });
  expect(api).toHaveBeenCalledTimes(2);
});

it("keeps an uncertain preparation on its original receipt and checks status without replaying preparation", async () => {
  const api = vi.fn<BuilderApi>(async () => { throw Error("Connection interrupted"); });
  render(<ExamProfileBuilder {...props} api={api} />);
  await attachAndRead();
  await screen.findByText("Connection interrupted");
  const receipt = String(api.mock.calls[0][0].requestId);
  expect(screen.getByRole("button", { name: "Change details or documents" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Start new build" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Read syllabus" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Resume request" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(api.mock.calls[1][0]).toEqual({ action: "source_status", jobId: receipt });
  await waitFor(() => expect(screen.getByRole("button", { name: "Start new build" })).toBeEnabled());
  expect(await readPendingBuilderJob("Business")).toEqual({ jobId: receipt });
  expect(api).toHaveBeenCalledTimes(2);
});

it("checks a charged confirmation after a lost response instead of offering another build call", async () => {
  let ready: SourceJobView;
  const api = vi.fn<BuilderApi>(async input => {
    if (input.action === "prepare_source") {
      ready = sourceJob(input, { stage: "ready", message: "Ready to confirm." });
      return { job: ready };
    }
    if (input.action === "confirm_source") throw Error("Build response interrupted");
    return { job: ready };
  });
  render(<ExamProfileBuilder {...props} api={api} />);
  await attachAndRead();
  const build = await screen.findByRole("button", { name: "Yes, build it" });
  await waitFor(() => expect(build).toBeEnabled());
  fireEvent.click(build);
  await screen.findByText("Build response interrupted");
  expect(screen.queryByRole("button", { name: "Yes, build it" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start new build" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Check progress" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(3));
  expect(api.mock.calls.map(([input]) => input.action)).toEqual(["prepare_source", "confirm_source", "source_status"]);
  expect(api.mock.calls[2][0]).toEqual({ action: "source_status", jobId: ready!.jobId });
});

it("supports a legacy pending tier question only after its explicit clarification answer", async () => {
  const receipt = crypto.randomUUID();
  const question = "These sources do not establish the assessment tier.";
  const original = sourceJob({ requestId: receipt, mode: "full_mock", identity: {
    country: "GB", educationSystem: "GB", stage: "Secondary", qualification: "A-level",
    subject: "Unreviewed Studies", organisation: "Edexcel", course: "UNREVIEWED101",
    component: "Paper 1", specificationVersion: "2026", tier: null,
  } }, { stage: "needs_details",
    missingItems: [{ field: "tier", question, choices: [{ value: "unknown_practice", label: "Continue as short practice with tier unverified" }] }] });
  await rememberPendingBuilderJob("Unreviewed Studies", receipt);
  const api = vi.fn<BuilderApi>(async input => {
    if (input.action === "answer_source") return { job: { ...original, stage: "ready", revision: 5,
      mode: "short_practice", identity: { ...original.identity!, tier: null }, missingItems: [], message: "Ready to confirm." } };
    expect(input).toEqual({ action: "source_status", jobId: receipt });
    return { job: original };
  });
  render(<ExamProfileBuilder {...props} subjectName="Unreviewed Studies" api={api} />);
  fireEvent.click(await screen.findByRole("button", { name: "Resume request" }));
  const choice = await screen.findByLabelText(question);
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.change(choice, { target: { value: "unknown_practice" } });
  expect(api).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Yes, build it" })).toBeEnabled());
  expect(api.mock.calls[1][0]).toEqual({ action: "answer_source", jobId: receipt, revision: 4, answers: { tier: "unknown_practice" } });
  expect(screen.getByText(/Short practice using/)).toBeVisible();
  expect(await readPendingBuilderJob("Unreviewed Studies")).toEqual({ jobId: receipt });
  expect(api).toHaveBeenCalledTimes(2);
});
it("keeps a new full-paper request while asking for an actionable source instead of a short-practice tier choice", async () => {
  const question = "We could not verify the assessment tier for this full-paper profile. Check the course code and qualification, or add an assessment source that identifies the tier or confirms the course is untiered.";
  const api = vi.fn<BuilderApi>(async input => ({ job: sourceJob(input, {
    stage: "needs_details", missingItems: [{ field: "source", question }],
  }) }));
  render(<ExamProfileBuilder {...props} api={api} />);
  fireEvent.change(screen.getByLabelText("Course / specification code"), { target: { value: "UNREVIEWED101" } });
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode("UNREVIEWED101 Business\nPaper 1\n100 marks");
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: { files: [{ name: "unreviewed.txt", type: "text/plain", size: bytes.length, arrayBuffer: async () => bytes.buffer }] },
  });
  await screen.findByRole("option", { name: assessment });
  fireEvent.change(screen.getByRole("combobox", { name: "Assessment" }), { target: { value: "business-paper-1" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  expect(await screen.findByRole("heading", { name: question })).toBeVisible();
  expect(screen.getByText("Full mock", { selector: "dd" })).toBeVisible();
  expect(screen.queryByRole("option", { name: /short practice/i })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  expect(screen.getByText("unreviewed.txt")).toBeVisible();
  expect(api).toHaveBeenCalledTimes(1);
  expect(api.mock.calls[0][0]).toMatchObject({ action: "prepare_source", mode: "full_mock", identity: { course: "UNREVIEWED101", tier: null } });
});
