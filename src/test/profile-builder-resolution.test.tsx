import { afterEach, expect, it, vi } from "vitest";
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
afterEach(cleanup);
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
  expect(screen.getByLabelText("Paper or assessment")).toBeInTheDocument();
  expect(screen.getByLabelText("Tier")).toBeInTheDocument();
  expect(screen.queryByLabelText("Educational level")).not.toBeInTheDocument();
  expect(
    screen.getByLabelText("Course / specification code").closest("details"),
  ).not.toHaveAttribute("open");
  expect(
    screen.getByLabelText("Specification / cohort version").closest("details"),
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
  expect(screen.getByLabelText("Total marks")).toHaveValue(70);
  expect(screen.getByLabelText("Time limit (minutes)")).toHaveValue(90);
  expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
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
  fireEvent.change(screen.getByLabelText("Paper or assessment"), {
    target: { value: "Paper 1" },
  });
  expect(screen.queryByLabelText("Tier")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Course / specification code")).toHaveValue(
    "9BN0",
  );
  expect(screen.getByText(/We need a source/)).toBeInTheDocument();
  confirm();
  expect(screen.getByRole("button", { name: "Yes, build it" })).toBeDisabled();
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
  expect(screen.getByText(/Using your saved GCSE level/)).toBeInTheDocument();
  expect(screen.getByText("AQA · Physics")).toBeInTheDocument();
  expect(screen.queryByLabelText("Educational level")).not.toBeInTheDocument();
});
it("unsupported university upload creates an editable source-backed preview and can save without entering codes", async () => {
  const calls: any[] = [];
  const api: BuilderApi = async (input) => {
    calls.push(input);
    if (input.action === "save")
      return { profile: { id: crypto.randomUUID() } };
    const template = templateFixture();
    template.identity = input.identity as typeof template.identity;
    const evidence = await ownerEvidence();
    evidence.identity = template.identity;
    return {
      proposalId: crypto.randomUUID(),
      proposal: {
        proposalVersion: 1,
        promptVersion: 1,
        origin: "source_backed_ai",
        template,
        evidence,
        evidenceVersion: await evidenceFingerprint(evidence),
        presetId: null,
        profileSettings: null,
      },
    };
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
  fireEvent.change(screen.getByLabelText("Paper or assessment"), {
    target: { value: "Final assessment" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Upload syllabus" }));
  fireEvent.change(
    screen.getByLabelText("Does everyone sit the same assessment?"),
    { target: { value: "not_tiered" } },
  );
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
  confirm();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Yes, build it" })).toBeEnabled(),
  );
  build();
  await screen.findByText("Source-backed AI draft");
  expect(
    screen.queryByRole("img", { name: "Examly-approved preset" }),
  ).not.toBeInTheDocument();
  expect(calls[0].identity.specificationVersion).toBe("Not verified");
  expect(calls[0].upload).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "My university revision" },
  });
  fireEvent.change(screen.getByLabelText("Time limit (minutes)"), {
    target: { value: "31" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
  await waitFor(() =>
    expect(calls[1].profileName).toBe("My university revision"),
  );
  expect(calls[1].template.durationMinutes).toBe(31);
});
