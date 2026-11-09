import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  within,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ExamProfileModal } from "@/components/stats/ExamProfileModal";
import {
  ownerEvidence,
  pearsonTemplate,
  templateFixture,
  syllabus,
} from "../../supabase/tests/profile-builder-fixtures";
import { ExamProfileBuilder } from "@/components/profiles/ExamProfileBuilder";
import {
  builderInitialIdentity,
  builderCourses,
  resolveBuilderChoice,
} from "@/lib/profile-builder-resolution";
import { templateFromPreset } from "../../supabase/functions/_shared/profile-builder-service";
import { proposeProfile } from "../../supabase/functions/_shared/profile-builder-service";
import type { BuilderApi } from "@/lib/profile-builder-client";
import { evidenceFingerprint } from "../../supabase/functions/_shared/profile-evidence";
import { identitySchema } from "../../supabase/functions/_shared/profile-template";
import { resolveRegisteredSource } from "../../supabase/functions/_shared/profile-source-registry";

const localInspection = vi.hoisted(() => ({ inspect: vi.fn() }));
vi.mock("@/lib/inspect-profile-attachments", () => ({
  inspectProfileAttachments: localInspection.inspect,
}));
beforeEach(() => {
  localInspection.inspect.mockReset().mockResolvedValue({
    version: 1,
    candidates: [
      {
        id: "doc-final",
        label: "Final assessment",
        kind: "assessment",
        aliases: ["Final assessment"],
        references: [
          {
            documentId: "source",
            checksum: "a".repeat(64),
            page: 1,
            quote: "Final assessment",
          },
        ],
      },
    ],
    warnings: [],
    needsManualEntry: false,
    ambiguous: false,
  });
});
const pending = vi.hoisted(() => ({
  read: vi.fn(
    async (_subject: string): Promise<{ jobId: string } | null> => null,
  ),
  remember: vi.fn(async (_subject: string, _jobId: string) => {}),
  clear: vi.fn(async (_subject: string, _jobId?: string) => {}),
}));
vi.mock("@/lib/profile-builder-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/profile-builder-client")>()),
  readPendingBuilderJob: pending.read,
  rememberPendingBuilderJob: pending.remember,
  clearPendingBuilderJob: pending.clear,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));
vi.mock("@/hooks/useUserPreferences", () => ({
  useUserPreferences: () => ({
    preferences: {
      preferred_educational_level: "level2",
      preferred_exam_board: "AQA",
      curriculum_region: "GB",
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const base = {
  open: true,
  onOpenChange: vi.fn(),
  onManual: vi.fn(),
  subjectName: "Biology",
  educationalLevel: "level3",
  examBoard: "OCR",
  curriculumRegion: "GB",
};
const ocr = {
  ...base,
  courseId: "ocr_alevel_biology_a_h420",
  paperId: "paper_3",
};
const confirm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
const build = () =>
  fireEvent.click(screen.getByRole("button", { name: "Yes, build it" }));

const enterManualAssessment = (value: string) => {
  fireEvent.change(screen.getByLabelText("Assessment"), {
    target: { value: "__manual" },
  });
  fireEvent.change(screen.getByLabelText("Assessment name (manual)"), {
    target: { value },
  });
};
const chooseSourceAssessment = async () => {
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: "Final assessment" }),
    ).toBeInTheDocument(),
  );
  fireEvent.change(screen.getByLabelText("Assessment"), {
    target: { value: "doc-final" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled(),
  );
};
it("GCSE Physics reuses saved level and asks for board, paper and tier without technical inputs", () => {
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      educationalLevel="level2"
      examBoard={null}
      api={vi.fn()}
    />,
  );
  expect(screen.getByLabelText("Exam board")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Exam board"), {
    target: { value: "AQA" },
  });
  expect(screen.getByLabelText("Paper")).toBeInTheDocument();
  expect(screen.getByLabelText("Tier")).toBeInTheDocument();
  expect(screen.queryByLabelText("Educational level")).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("Course / specification code").closest("details"),
  ).not.toHaveAttribute("open");
  expect(
    screen
      .getByLabelText("Specification version / teaching dates (optional)")
      .closest("details"),
  ).not.toHaveAttribute("open");
});
it("a complete saved OCR Paper 3 choice opens one confirmation and makes no request beforehand", () => {
  const api = vi.fn();
  render(<ExamProfileBuilder {...ocr} api={api} />);
  expect(screen.getByRole("button", { name: "Yes, build it" })).toBeEnabled();
  expect(
    screen.getByRole("heading", {
      name: /OCR A-level Biology A.*Paper 3.*Unified biology/,
    }),
  ).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Tier")).not.toBeInTheDocument();
});
it("approved preview is immediate but cannot save until the authoritative receipt arrives", async () => {
  let resolve: (v: any) => void;
  const api = vi.fn(
    (_input: Record<string, unknown>) =>
      new Promise<any>((r) => {
        resolve = r;
      }),
  );
  render(<ExamProfileBuilder {...ocr} initialMode="full_mock" api={api} />);
  build();
  expect(
    screen.getByRole("img", { name: "Examly-approved preset" }),
  ).toBeInTheDocument();
  expect(screen.getByText("70", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByText("90", { selector: "strong" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Total marks")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
  await waitFor(() => expect(api).toHaveBeenCalledTimes(1));
  const input = api.mock.calls[0][0];
  resolve!({
    proposal: templateFromPreset(String(input.presetId)),
    proposalId: crypto.randomUUID(),
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled(),
  );
});
it("the exact OCR preset uses the existing server resolver without a model call or reservation", async () => {
  const choice = resolveBuilderChoice(
    builderInitialIdentity({
      subject: "Biology",
      board: "OCR",
      level: "level3",
      region: "GB",
      courseId: ocr.courseId,
      paperId: "paper_3",
    }),
    "short_practice",
  );
  const model = vi.fn(),
    reserve = vi.fn();
  const result = await proposeProfile(
    "synthetic-owner",
    {
      action: "propose",
      requestId: crypto.randomUUID(),
      identity: choice.identity,
      mode: "short_practice",
      presetId: choice.presetId,
      unverified: false,
    },
    {
      claim: async () => ({ state: "claimed" }),
      finish: async () => {},
      model,
      reserve,
      beginCall: vi.fn(),
      usage: vi.fn(),
      parsePdf: vi.fn(),
    },
  );
  expect(result.origin).toBe("catalogue");
  expect(result.template.marks).toBe(20);
  expect(model).not.toHaveBeenCalled();
  expect(reserve).not.toHaveBeenCalled();
});
it("ambiguous Edexcel Biology asks A versus B and never guesses", () => {
  const api = vi.fn();
  render(
    <ExamProfileBuilder {...base} examBoard="Pearson Edexcel" api={api} />,
  );
  expect(screen.getByLabelText("Course variant")).toHaveValue("");
  expect(
    screen.getByRole("option", { name: /Biology A \(Salters-Nuffield\)/ }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByLabelText("Course variant")).getByRole("option", {
      name: /Biology B/,
    }),
  ).toBeInTheDocument();
  confirm();
  expect(screen.getByRole("alert")).toHaveTextContent(/won’t guess/);
  expect(api).not.toHaveBeenCalled();
});
it("explicit Biology A stays separate from Biology B and has no tier control", () => {
  render(
    <ExamProfileBuilder {...base} examBoard="Pearson Edexcel" api={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("Course variant"), {
    target: { value: "pearson_edexcel_alevel_biology_a_9bn0" },
  });
  enterManualAssessment("Paper 1");
  expect(screen.queryByLabelText("Tier")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Course / specification code")).toHaveValue(
    "9BN0",
  );
  expect(screen.getByText(/We need a source/)).toBeInTheDocument();
  confirm();
  expect(
    screen.queryByRole("button", { name: "Yes, build it" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/Add your syllabus/);
});
it("Biology B resolves its reviewed source, code and version without technical typing", () => {
  render(
    <ExamProfileBuilder {...base} examBoard="Pearson Edexcel" api={vi.fn()} />,
  );
  fireEvent.change(screen.getByLabelText("Course variant"), {
    target: { value: "pearson_edexcel_alevel_biology_b_9bi0" },
  });
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "9bi0_01" },
  });
  confirm();
  expect(
    screen.getByText(/reviewed official source for this course/),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yes, build it" })).toBeEnabled();
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
});
it("international age bands do not become UK qualifications or approved presets", () => {
  for (const region of ["US", "IN", "IB"]) {
    const i = builderInitialIdentity({
      subject: "Biology",
      board: "OCR",
      level: "level3",
      region,
    });
    expect(i.qualification).not.toBe("A-level");
    expect(builderCourses(i)).toHaveLength(0);
  }
});
it("unsupported university identity needs human names, not invented technical codes", () => {
  const i = builderInitialIdentity({
    subject: "Biology",
    board: "Example University",
    level: "undergrad",
    region: "US",
  });
  const r = resolveBuilderChoice(
    { ...i, component: "Final assessment" },
    "short_practice",
  );
  expect(identitySchema.safeParse(r.identity).success).toBe(true);
  expect(r.identity.course).toBe("College (4-year) Biology");
  expect(r.identity.specificationVersion).toBe("Not verified");
  expect(r.presetId).toBe("");
  expect(r.sourceId).toBe("");
});
it("Change details returns to human choices before any API request and supports short/full switching", () => {
  const api = vi.fn();
  render(<ExamProfileBuilder {...ocr} api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "Change details" }));
  fireEvent.change(screen.getByLabelText("Assessment mode"), {
    target: { value: "full_mock" },
  });
  confirm();
  expect(screen.getByText(/Full mock using your saved/)).toBeInTheDocument();
  expect(api).not.toHaveBeenCalled();
});
it("advanced specification override cannot silently retain the approved preset", () => {
  const i = builderInitialIdentity({
    subject: "Biology",
    board: "OCR",
    level: "level3",
    region: "GB",
    courseId: ocr.courseId,
    paperId: "paper_3",
  });
  const r = resolveBuilderChoice(
    { ...i, specificationVersion: "different-cohort" },
    "short_practice",
  );
  expect(r.presetId).toBe("");
  expect(r.sourceId).toBe("");
  expect(r.identity.specificationVersion).toBe("different-cohort");
});
it("clear teaching and first-exam dates do not block an otherwise exact approved course", () => {
  const i = builderInitialIdentity({
    subject: "Biology",
    board: "OCR",
    level: "level3",
    region: "GB",
    courseId: ocr.courseId,
    paperId: "paper_3",
  });
  const normal = resolveBuilderChoice(i, "short_practice");
  const hinted = resolveBuilderChoice(
    { ...i, specificationVersion: "First teaching 2015, first exams 2017" },
    "short_practice",
  );
  expect(hinted.presetId).toBe(normal.presetId);
  expect(hinted.identity).toEqual(normal.identity);
  expect(hinted.presetId).not.toBe("");
});
it("saved board and tier stay visible in the summary and can be changed deliberately", () => {
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      educationalLevel="level2"
      examBoard="AQA"
      assessmentTier="higher"
      api={vi.fn()}
    />,
  );
  expect(screen.queryByLabelText("Exam board")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change details" }));
  expect(screen.getByLabelText("Exam board")).toHaveValue("AQA");
  expect(screen.getByLabelText("Tier")).toHaveValue("higher");
});

it("the existing editor passes saved Settings level, region and board into the builder", () => {
  render(
    <ExamProfileModal
      open
      onOpenChange={vi.fn()}
      subjectName="Physics"
      subjectColor="#2c4d9f"
      availableTopics={[]}
      onSave={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Build profile for me" }));
  expect(
    screen.getByText(/Using your saved GCSE settings/),
  ).toBeInTheDocument();
  expect(screen.getByText("AQA · Physics")).toBeInTheDocument();
  expect(screen.queryByLabelText("Educational level")).not.toBeInTheDocument();
});
it("an uploaded university syllabus discovers identity before confirmation and shows a simple editable preview", async () => {
  const calls: any[] = [];
  const discovered = {
    ...templateFixture().identity,
    country: "US",
    educationSystem: "US",
    stage: "University",
    qualification: "College (4-year)",
    organisation: "Example University",
    course: "BIO101",
    component: "Final assessment",
    specificationVersion: "2026",
    tier: "not_tiered" as const,
  };
  const template = templateFixture();
  template.identity = discovered;
  const evidence = await ownerEvidence();
  evidence.identity = discovered;
  const proposal = {
    proposalVersion: 1 as const,
    promptVersion: 1 as const,
    origin: "source_backed_ai" as const,
    template,
    evidence,
    evidenceVersion: await evidenceFingerprint(evidence),
    presetId: null,
    profileSettings: null,
  };
  let stage: "identifying" | "ready" | "drafting" | "complete" = "identifying";
  let jobId = "";
  const job = () => ({
    jobId,
    stage,
    identity: discovered,
    mode: "short_practice" as const,
    progress: { completed: stage === "identifying" ? 0 : 1, total: 2 },
    message: "Source processing",
    ...(stage === "complete" ? { proposalId: jobId, proposal } : {}),
  });
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "prepare_source") {
      jobId = String(input.requestId);
      return { job: job() };
    }
    if (input.action === "advance_source") {
      stage = stage === "identifying" ? "ready" : "complete";
      return { job: job() };
    }
    if (input.action === "confirm_source") {
      expect(input.identity).toEqual(discovered);
      stage = "drafting";
      return { job: job() };
    }
    if (input.action === "save")
      return { profile: { id: crypto.randomUUID() } };
    throw Error("Unexpected request");
  };
  render(
    <ExamProfileBuilder
      {...base}
      curriculumRegion="US"
      educationalLevel="undergrad"
      examBoard="Example University"
      api={api}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  expect(
    screen.queryByLabelText("Does everyone sit the same assessment?"),
  ).not.toBeInTheDocument();
  const bytes = new TextEncoder().encode(syllabus);
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "brief.txt",
          type: "text/plain",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer,
        },
      ],
    },
  });
  await chooseSourceAssessment();
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await screen.findByRole("button", { name: "Yes, build it" });
  expect(calls.map((call) => call.action)).toEqual([
    "prepare_source",
    "advance_source",
  ]);
  expect(calls[0].identity.specificationVersion).toBe("Not verified");
  expect(calls[0].uploads).toHaveLength(1);
  expect(Object.keys(calls[0].uploads[0]).sort()).toEqual([
    "base64",
    "contentType",
  ]);
  expect(
    screen.queryByRole("navigation", { name: "Builder steps" }),
  ).not.toBeInTheDocument();
  build();
  await screen.findByText("Source-backed AI draft");
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  // Removing the local copy after a checked draft must not destroy its server receipt.
  fireEvent.click(screen.getByRole("button", { name: "Remove brief.txt" }));
  expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  expect(screen.queryByLabelText("Profile name")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Time limit (minutes)"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "My university revision" },
  });
  fireEvent.change(screen.getByLabelText("Time limit (minutes)"), {
    target: { value: "31" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(calls.at(-1).profileName).toBe("My university revision"),
  );
  expect(calls.at(-1).template.durationMinutes).toBe(31);
});

it("changing an assessment removes the previous preview before a new build", async () => {
  const api: BuilderApi = async (input) => ({
    proposalId: crypto.randomUUID(),
    proposal: templateFromPreset(String(input.presetId)),
  });
  render(<ExamProfileBuilder {...ocr} api={api} />);
  build();
  await screen.findByRole("button", { name: "Edit profile" });
  fireEvent.click(screen.getByRole("button", { name: "Change assessment" }));
  expect(
    screen.queryByRole("button", { name: "Save profile" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit profile" }),
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_2" },
  });
  confirm();
  expect(screen.getByRole("heading", { name: /Paper 2/ })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Save profile" }),
  ).not.toBeInTheDocument();
});

it("changing a saved board reveals cleared course and paper choices", () => {
  render(<ExamProfileBuilder {...ocr} api={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Change details" }));
  fireEvent.change(screen.getByLabelText("Exam board"), {
    target: { value: "Pearson Edexcel" },
  });
  expect(screen.getByLabelText("Course variant")).toHaveValue("");
  expect(screen.getByLabelText("Assessment")).toHaveValue("");
  confirm();
  expect(screen.getByRole("alert")).toHaveTextContent(/course variants/);
});

it("switching the level to university updates the institution flow without Advanced", () => {
  render(<ExamProfileBuilder {...ocr} api={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Change details" }));
  fireEvent.change(screen.getByLabelText("Educational level"), {
    target: { value: "Undergraduate / Bachelor's" },
  });
  expect(screen.getByLabelText("Institution or exam board")).toHaveValue("");
  expect(screen.getByLabelText("Assessment")).toBeInTheDocument();
  expect(screen.queryByLabelText("Tier")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Education stage")).toHaveValue("University");
});

it("switching accounts clears a prepared preview and closes the builder", async () => {
  const closed = vi.fn();
  const api: BuilderApi = async (input) => ({
    proposalId: crypto.randomUUID(),
    proposal: templateFromPreset(String(input.presetId)),
  });
  const view = render(
    <ExamProfileBuilder
      {...ocr}
      accountId="owner-one"
      onOpenChange={closed}
      api={api}
    />,
  );
  build();
  await screen.findByRole("button", { name: "Edit profile" });
  view.rerender(
    <ExamProfileBuilder
      {...ocr}
      accountId="owner-two"
      onOpenChange={closed}
      api={api}
    />,
  );
  expect(closed).toHaveBeenCalledWith(false);
  expect(
    screen.queryByRole("button", { name: "Save profile" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
});

it("rejects oversized bundles before creating a source job", async () => {
  const api = vi.fn();
  render(
    <ExamProfileBuilder
      {...base}
      educationalLevel="undergrad"
      curriculumRegion="US"
      examBoard="Example University"
      api={api}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const arrayBuffer = vi.fn();
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "large.pdf",
          type: "application/pdf",
          size: 3_000_001,
          arrayBuffer,
        },
      ],
    },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    /3 MB each and 6 MB together/,
  );
  expect(arrayBuffer).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});

it("resuming a saved source request checks status without starting paid processing", async () => {
  const jobId = crypto.randomUUID();
  pending.read.mockResolvedValueOnce({ jobId });
  const identity = templateFixture().identity;
  const api = vi.fn(async (input: Record<string, unknown>) => {
    expect(input).toEqual({ action: "source_status", jobId });
    return {
      job: {
        jobId,
        stage: "identifying" as const,
        identity,
        mode: "short_practice" as const,
        progress: { completed: 0, total: 2 },
        message: "Finding assessment rules",
      },
    };
  });
  render(
    <ExamProfileBuilder
      {...base}
      educationalLevel="undergrad"
      curriculumRegion="US"
      examBoard="Example University"
      api={api}
    />,
  );
  await screen.findByRole("button", { name: "Resume request" });
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Resume request" }));
  await screen.findByRole("button", { name: "Continue processing" });
  expect(api).toHaveBeenCalledTimes(1);
});

it("cancelling Start again keeps the builder and its unfinished request open", async () => {
  pending.read.mockResolvedValueOnce({ jobId: crypto.randomUUID() });
  const onOpenChange = vi.fn();
  const api = vi.fn();
  render(
    <ExamProfileBuilder
      {...base}
      onOpenChange={onOpenChange}
      educationalLevel="undergrad"
      curriculumRegion="US"
      examBoard="Example University"
      api={api}
    />,
  );
  await screen.findByRole("button", { name: "Resume request" });
  fireEvent.click(screen.getByRole("button", { name: "Start again" }));
  const confirmation = screen.getByRole("alertdialog");
  fireEvent.pointerDown(
    within(confirmation).getByRole("button", { name: "Keep current build" }),
  );
  fireEvent.click(
    within(confirmation).getByRole("button", { name: "Keep current build" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
  expect(screen.getByRole("button", { name: "Resume request" })).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(pending.clear).not.toHaveBeenCalled();
  expect(api).not.toHaveBeenCalled();
});

it("a lost source-preparation response keeps the same receipt for a free status check", async () => {
  const calls: any[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "prepare_source")
      throw Error("Connection interrupted");
    return {
      job: {
        jobId: String(input.jobId),
        stage: "identifying",
        identity: templateFixture().identity,
        mode: "short_practice",
        progress: { completed: 0, total: 2 },
        message: "Finding assessment rules",
      },
    };
  };
  render(
    <ExamProfileBuilder
      {...base}
      educationalLevel="undergrad"
      curriculumRegion="US"
      examBoard="Example University"
      api={api}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode(syllabus);
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "brief.txt",
          type: "text/plain",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer,
        },
      ],
    },
  });
  await chooseSourceAssessment();
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await screen.findByText("Connection interrupted");
  expect(pending.remember).toHaveBeenCalledWith("Biology", calls[0].requestId);
  fireEvent.click(screen.getByRole("button", { name: "Resume request" }));
  await screen.findByRole("button", { name: "Continue processing" });
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual({
    action: "source_status",
    jobId: calls[0].requestId,
  });
  expect(pending.clear).not.toHaveBeenCalled();
});

it("a registered AI draft can close and resume its completed receipt without another proposal", async () => {
  const evidence = resolveRegisteredSource("pearson-9bi0-01-issue4");
  const proposal = {
    proposalVersion: 1 as const,
    promptVersion: 1 as const,
    origin: "source_backed_ai" as const,
    template: pearsonTemplate("full_mock"),
    evidence,
    evidenceVersion: await evidenceFingerprint(evidence),
    presetId: null,
    profileSettings: null,
  };
  const calls: any[] = [];
  let resolveProposal: ((value: any) => void) | undefined;
  let receipt = "";
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "propose") {
      receipt = String(input.requestId);
      return new Promise((resolve) => {
        resolveProposal = resolve;
      });
    }
    if (input.action === "source_status")
      return {
        job: {
          jobId: receipt,
          stage: "complete",
          mode: "full_mock",
          identity: proposal.template.identity,
          progress: { completed: 1, total: 1 },
          message: "Your profile is ready",
          proposalId: receipt,
          proposal,
          canAdvance: false,
        },
      };
    if (input.action === "save")
      return { profile: { id: crypto.randomUUID() } };
    throw Error("No paid stage may be repeated");
  };
  const props = {
    ...base,
    examBoard: "Pearson Edexcel",
    courseId: "pearson_edexcel_alevel_biology_b_9bi0",
    paperId: "9bi0_01",
    initialMode: "full_mock" as const,
    api,
  };
  const view = render(<ExamProfileBuilder {...props} />);
  build();
  await waitFor(() => expect(resolveProposal).toBeTypeOf("function"));
  expect(pending.remember).toHaveBeenCalledWith("Biology", receipt);
  fireEvent.click(
    screen.getByRole("button", { name: "Close profile builder" }),
  );
  view.rerender(<ExamProfileBuilder {...props} open={false} />);
  resolveProposal!({ proposalId: receipt, proposal });
  await Promise.resolve();
  expect(pending.clear).not.toHaveBeenCalled();
  pending.read.mockResolvedValueOnce({ jobId: receipt });
  view.rerender(<ExamProfileBuilder {...props} initialMode="short_practice" />);
  await screen.findByRole("button", { name: "Resume request" });
  fireEvent.click(screen.getByRole("button", { name: "Resume request" }));
  await screen.findByRole("button", { name: "Edit profile" });
  expect(calls.map((call) => call.action)).toEqual([
    "propose",
    "source_status",
  ]);
  expect(screen.getByText("Source-backed AI draft")).toBeInTheDocument();
  expect(
    screen.getByText("Full mock", { selector: "span" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  expect(pending.clear).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(pending.clear).toHaveBeenCalledWith("Biology", receipt),
  );
  expect(calls.at(-1).template.mode).toBe("full_mock");
});

it("a running legacy receipt offers free progress checks and cannot advance a new source stage", async () => {
  const jobId = crypto.randomUUID();
  pending.read.mockResolvedValueOnce({ jobId });
  const api = vi.fn(async (input: Record<string, unknown>) => {
    expect(input).toEqual({ action: "source_status", jobId });
    return {
      job: {
        jobId,
        stage: "drafting" as const,
        mode: "short_practice" as const,
        progress: { completed: 0, total: 1 },
        message: "Your profile is still being prepared",
        canAdvance: false,
      },
    };
  });
  render(<ExamProfileBuilder {...ocr} api={api} />);
  await screen.findByRole("button", { name: "Resume request" });
  fireEvent.click(screen.getByRole("button", { name: "Resume request" }));
  await screen.findByRole("button", { name: "Check progress" });
  expect(
    screen.queryByRole("button", { name: "Continue processing" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Yes, build it" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Check progress" }));
  await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  expect(pending.clear).not.toHaveBeenCalled();
});

it("keeps the selected A-level Physics paper visible when its separate Advanced code is invalid", async () => {
  pending.read.mockResolvedValue(null);
  const api = vi.fn();
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      examBoard="aqa"
      api={api}
    />,
  );
  expect(screen.getByText("AQA · Physics")).toBeVisible();
  expect(screen.getByText(/Using your saved A-level settings/)).toBeVisible();
  const paper = screen.getByLabelText("Paper");
  fireEvent.change(paper, { target: { value: "paper_1" } });
  expect(paper).toBeVisible();
  expect(
    within(paper).getByRole("option", { name: "Paper 1" }),
  ).toBeInTheDocument();
  const code = screen.getByLabelText("Paper / component code");
  expect(code).toHaveValue("7408/1");
  fireEvent.change(code, { target: { value: "7408/2" } });
  expect(paper).toHaveValue("paper_1");
  confirm();
  expect(
    screen
      .getAllByRole("alert")
      .some((node) => /does not match Paper 1/.test(node.textContent || "")),
  ).toBe(true);
  expect(api).not.toHaveBeenCalled();
  fireEvent.change(code, { target: { value: "7408/1" } });
  expect(paper).toHaveValue("paper_1");
  expect(paper).toBeVisible();
});

it("retains visible source files after cancelled or invalid replacement and after choosing a source URL", async () => {
  pending.read.mockResolvedValue(null);
  const api = vi.fn();
  render(
    <ExamProfileBuilder
      {...base}
      curriculumRegion="US"
      educationalLevel="undergrad"
      examBoard="Example University"
      api={api}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const input = screen.getByLabelText("Syllabus or assessment brief");
  const bytes = new TextEncoder().encode(syllabus);
  const file = {
    name: "retained-brief.txt",
    type: "text/plain",
    size: bytes.length,
    arrayBuffer: async () => bytes.buffer,
  };
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText("retained-brief.txt");
  await chooseSourceAssessment();
  const inspected = localInspection.inspect.mock.calls.length;
  fireEvent.change(input, { target: { files: [] } });
  expect(screen.getByText("retained-brief.txt")).toBeVisible();
  fireEvent.change(input, {
    target: {
      files: [
        {
          name: "oversize.pdf",
          type: "application/pdf",
          size: 3_000_001,
          arrayBuffer: vi.fn(),
        },
      ],
    },
  });
  expect(screen.getByText("retained-brief.txt")).toBeVisible();
  expect(screen.getByText(/Your attached files are unchanged/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Assessment mode"), {
    target: { value: "full_mock" },
  });
  fireEvent.change(screen.getByLabelText("Official specification URL"), {
    target: { value: "https://example.edu/brief.pdf" },
  });
  expect(screen.getByText("retained-brief.txt")).toBeVisible();
  expect(screen.getByText("Not used for this build")).toBeVisible();
  await Promise.resolve();
  expect(localInspection.inspect).toHaveBeenCalledTimes(inspected);
  expect(api).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove retained-brief.txt" }),
  );
  expect(screen.queryByText("retained-brief.txt")).not.toBeInTheDocument();
});

it("requires the Physics Paper 3 option before a source request can start", () => {
  pending.read.mockResolvedValue(null);
  const api = vi.fn();
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      examBoard="AQA"
      api={api}
    />,
  );
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_3" },
  });
  expect(screen.getByLabelText("Paper option")).toBeVisible();
  expect(screen.getByLabelText("Paper")).toHaveValue("paper_3");
  confirm();
  expect(screen.getByRole("alert")).toHaveTextContent(
    /Choose the optional topic/,
  );
  expect(api).not.toHaveBeenCalled();
});

it.each([
  { override: null, intent: "source", expected: "v1.4-july-2026" },
  { override: "Version 1.4 July 2026", intent: "explicit", expected: "Version 1.4 July 2026" },
  { override: "", intent: "source", expected: "v1.4-july-2026" },
  { override: "First teaching 2015, first exams 2017", intent: "source", expected: "First teaching 2015, first exams 2017" },
])("distinguishes the catalogue edition from a deliberate upload override ($intent / $override)", async ({ override, intent, expected }) => {
  pending.read.mockResolvedValue(null);
  const calls: Record<string, any>[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    return {
      job: {
        jobId: String(input.requestId),
        stage: "ready",
        mode: "full_mock",
        identity: {
          ...identitySchema.parse(input.identity),
          specificationVersion: "Version 1.3 1 June 2017",
        },
        progress: { completed: 1, total: 1 },
        message: "Ready to confirm.",
      },
    };
  };
  render(<ExamProfileBuilder {...base} subjectName="Physics" examBoard="AQA" api={api} />);
  fireEvent.change(screen.getByLabelText("Paper"), { target: { value: "paper_1" } });
  const version = screen.getByLabelText("Specification version / teaching dates (optional)");
  expect(version).toHaveValue("");
  if (override !== null) {
    // Clearing a former explicit override restores detection from the source.
    fireEvent.change(version, { target: { value: "Version 1.4 July 2026" } });
    fireEvent.change(version, { target: { value: override } });
  }
  fireEvent.change(screen.getByLabelText("Assessment mode"), { target: { value: "full_mock" } });
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode("A-level Physics 7408 specification\nVersion 1.3 1 June 2017\nPaper 1 7408/1");
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: { files: [{ name: "physics-2017.txt", type: "text/plain", size: bytes.length, arrayBuffer: async () => bytes.buffer }] },
  });
  await screen.findByText("physics-2017.txt");
  await waitFor(() => expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await screen.findByRole("button", { name: "Yes, build it" });
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ action: "prepare_source", specificationVersionIntent: intent, identity: { specificationVersion: expected } });
  expect(screen.getByText("Syllabus edition: Version 1.3 1 June 2017")).toBeVisible();
});

it("keeps the upload, date context and mode while a targeted source choice corrects the paper before an explicit retry", async () => {
  pending.read.mockResolvedValue(null);
  const dates = "First teaching 2015, first exams 2017";
  const calls: Record<string, any>[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    expect(input.action).toBe("prepare_source");
    return {
      job: {
        jobId: String(input.requestId),
        stage: calls.length === 1 ? "needs_details" : "ready",
        mode: "full_mock",
        identity: {
          ...identitySchema.parse(input.identity),
          specificationVersion: "v1.4-july-2026",
        },
        progress: { completed: 0, total: 1 },
        message: "We need a little more assessment information.",
        ...(calls.length === 1
          ? {
              needs: ["Which assessment in this source are you preparing for?"],
              assessmentChoices: [
                {
                  id: "wrong-course",
                  label: "Paper 2",
                  kind: "paper",
                  componentCode: "7407/2",
                },
                {
                  id: "source-paper-two",
                  label: "Paper 2",
                  kind: "paper",
                  componentCode: "7408/2",
                },
              ],
            }
          : {}),
      },
    };
  };
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      examBoard="aqa"
      api={api}
    />,
  );
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_1" },
  });
  fireEvent.change(screen.getByLabelText("Assessment mode"), {
    target: { value: "full_mock" },
  });
  fireEvent.change(
    screen.getByLabelText("Specification version / teaching dates (optional)"),
    { target: { value: dates } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode(
    "A-level\nPaper 2\n7408/2\n85 marks\nTime allowed 2 hours",
  );
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "physics-spec.txt",
          type: "text/plain",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer,
        },
      ],
    },
  });
  await screen.findByText("physics-spec.txt");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  const recovery = await screen.findByLabelText(
    "Assessment found in your source",
  );
  expect(
    screen.queryByText("We need a little more assessment information."),
  ).not.toBeInTheDocument();
  expect(
    screen.getAllByText(
      "Which assessment in this source are you preparing for?",
    ),
  ).toHaveLength(1);
  expect(calls).toHaveLength(1);
  expect(calls[0].identity).toMatchObject({
    qualification: "A-level",
    organisation: "AQA",
    course: "7408",
    component: "7408/1",
    specificationVersion: dates,
  });
  fireEvent.change(recovery, { target: { value: "wrong-course" } });
  expect(screen.getByRole("alert")).toHaveTextContent(
    /does not match your selected course/,
  );
  expect(screen.getByLabelText("Paper")).toHaveValue("paper_1");
  expect(calls).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Read syllabus" })).toBeDisabled();
  await waitFor(() =>
    expect(
      screen.getByRole("group", { name: "Assessment clarification" }),
    ).toHaveFocus(),
  );
  expect(
    screen.queryByText("We need a source for this course"),
  ).not.toBeInTheDocument();
  fireEvent.change(recovery, { target: { value: "source-paper-two" } });
  expect(
    screen.queryByLabelText("Assessment found in your source"),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Paper")).toHaveValue("paper_2");
  expect(screen.getByLabelText("Assessment mode")).toHaveValue("full_mock");
  expect(
    screen.getByLabelText("Specification version / teaching dates (optional)"),
  ).toHaveValue(dates);
  expect(screen.getByText("physics-spec.txt")).toBeVisible();
  expect(calls).toHaveLength(1);
  expect(pending.clear).toHaveBeenCalledWith("Physics", calls[0].requestId);
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await screen.findByRole("button", { name: "Yes, build it" });
  expect(calls).toHaveLength(2);
  expect(calls[1].identity).toMatchObject({
    component: "7408/2",
    specificationVersion: dates,
  });
  expect(calls[1].mode).toBe("full_mock");
  expect(calls[1].uploads).toEqual(calls[0].uploads);
  expect(calls[1].requestId).not.toBe(calls[0].requestId);
});

it("a named option source choice preserves Astrophysics and cannot silently switch to another option", async () => {
  pending.read.mockResolvedValue(null);
  const calls: Record<string, any>[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (calls.length > 1)
      return {
        job: {
          jobId: String(input.requestId),
          stage: "ready",
          mode: "short_practice",
          identity: identitySchema.parse(input.identity),
          progress: { completed: 1, total: 2 },
          message: "Ready to confirm.",
        },
      };
    return {
      job: {
        jobId: String(input.requestId),
        stage: "needs_details",
        mode: "short_practice",
        identity: identitySchema.parse(input.identity),
        progress: { completed: 0, total: 1 },
        message: "We need a little more assessment information.",
        needs: ["Which assessment in this source are you preparing for?"],
        assessmentChoices: [
          {
            id: "medical",
            label: "Medical physics",
            kind: "component",
            componentCode: "7408/3BB",
          },
          {
            id: "astro",
            label: "Astrophysics",
            kind: "component",
            componentCode: "7408/3BA",
          },
        ],
      },
    };
  };
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      examBoard="AQA"
      api={api}
    />,
  );
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_3" },
  });
  fireEvent.change(screen.getByLabelText("Paper option"), {
    target: { value: "astrophysics" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode(
    "A-level\nComponent: Astrophysics\n7408/3BA\n35 marks",
  );
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "astro.txt",
          type: "text/plain",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer,
        },
      ],
    },
  });
  await screen.findByText("astro.txt");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  const recovery = await screen.findByLabelText(
    "Assessment found in your source",
  );
  expect(calls[0].identity.module).toBe("Astrophysics");
  fireEvent.change(recovery, { target: { value: "medical" } });
  expect(screen.getByRole("alert")).toHaveTextContent(
    /does not match your selected course/,
  );
  expect(screen.getByLabelText("Paper option")).toHaveValue("astrophysics");
  expect(calls).toHaveLength(1);
  fireEvent.change(recovery, { target: { value: "astro" } });
  expect(screen.getByLabelText("Paper")).toHaveValue("paper_3");
  expect(screen.getByLabelText("Paper option")).toHaveValue("astrophysics");
  expect(screen.getByText("astro.txt")).toBeVisible();
  expect(calls).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  await screen.findByRole("button", { name: "Yes, build it" });
  expect(calls).toHaveLength(2);
  expect(calls[1].identity).toMatchObject({
    component: "7408/3",
    module: "Astrophysics",
  });
  fireEvent.click(screen.getByRole("button", { name: "Change details" }));
  expect(screen.getByLabelText("Paper option")).toHaveValue("astrophysics");
});

it("shows one missing question, retains the upload and read, and continues the same server job", async () => {
  pending.read.mockResolvedValue(null);
  const calls: Record<string, any>[] = [];
  let receipt = "",
    savedIdentity: ReturnType<typeof identitySchema.parse>;
  const missing = [
    {
      field: "assessment" as const,
      question: "Which assessment in your source should we use?",
      choices: [{ value: "document-paper-2", label: "Paper 2" }],
    },
    {
      field: "source_pages" as const,
      question: "Which PDF pages describe this assessment?",
    },
  ];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "prepare_source") {
      receipt = String(input.requestId);
      savedIdentity = identitySchema.parse(input.identity);
      return {
        job: {
          jobId: receipt,
          stage: "needs_details",
          revision: 7,
          identity: savedIdentity,
          mode: "short_practice",
          progress: { completed: 0, total: 1 },
          message: "One detail is missing.",
          missingItems: missing,
        },
      };
    }
    expect(input.action).toBe("answer_source");
    expect(input.jobId).toBe(receipt);
    expect(input).not.toHaveProperty("uploads");
    if (calls.length === 2) {
      expect(input.revision).toBe(7);
      expect(input.answers).toEqual({ assessment: "document-paper-2" });
      savedIdentity = { ...savedIdentity, component: "7408/2" };
      return {
        job: {
          jobId: receipt,
          stage: "needs_details",
          revision: 8,
          identity: savedIdentity,
          mode: "short_practice",
          progress: { completed: 0, total: 1 },
          message: "One detail is missing.",
          missingItems: [missing[1]],
        },
      };
    }
    expect(input.revision).toBe(8);
    expect(input.answers).toEqual({ source_pages: "9-10" });
    return {
      job: {
        jobId: receipt,
        stage: "ready",
        revision: 9,
        identity: savedIdentity,
        mode: "short_practice",
        progress: { completed: 1, total: 2 },
        message: "Ready to confirm.",
      },
    };
  };
  render(
    <ExamProfileBuilder
      {...base}
      subjectName="Physics"
      examBoard="AQA"
      api={api}
    />,
  );
  fireEvent.change(screen.getByLabelText("Paper"), {
    target: { value: "paper_1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  const bytes = new TextEncoder().encode(
    "A-level\nPaper 2\n7408/2\n85 marks\n2 hours",
  );
  fireEvent.change(screen.getByLabelText("Syllabus or assessment brief"), {
    target: {
      files: [
        {
          name: "combined-spec.txt",
          type: "text/plain",
          size: bytes.length,
          arrayBuffer: async () => bytes.buffer,
        },
      ],
    },
  });
  await screen.findByText("combined-spec.txt");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read syllabus" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Read syllabus" }));
  const question = await screen.findByLabelText(missing[0].question);
  const inspections = localInspection.inspect.mock.calls.length;
  expect(screen.getAllByRole("combobox")).toHaveLength(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(screen.queryByLabelText(missing[1].question)).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Paper / component code"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Assessment mode")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Syllabus or assessment brief"),
  ).not.toBeInTheDocument();
  expect(screen.getByText("combined-spec.txt")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Remove combined-spec.txt" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  expect(screen.getByLabelText("Paper")).toHaveValue("paper_1");
  fireEvent.click(screen.getByRole("button", { name: "Back to question" }));
  expect(calls).toHaveLength(1);
  expect(pending.clear).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(missing[0].question), {
    target: { value: "document-paper-2" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const pages = await screen.findByLabelText(missing[1].question);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.getByText("combined-spec.txt")).toBeVisible();
  fireEvent.change(pages, { target: { value: "9-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("button", { name: "Yes, build it" });
  expect(
    screen.getByRole("heading", { name: /We’ll build.*Paper 2/ }),
  ).toBeVisible();
  expect(calls.map((call) => call.action)).toEqual([
    "prepare_source",
    "answer_source",
    "answer_source",
  ]);
  expect(localInspection.inspect).toHaveBeenCalledTimes(inspections);
  expect(pending.clear).not.toHaveBeenCalled();
  expect(screen.getByText("combined-spec.txt")).toBeVisible();
});
