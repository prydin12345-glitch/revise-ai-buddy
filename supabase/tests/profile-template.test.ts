// @vitest-environment node
import { it, expect } from "vitest";
import {
  compileTemplate,
  validateTemplate,
  canonical,
} from "../functions/_shared/profile-template";
import { validateQuestionCandidates } from "../functions/_shared/question-contract-validator";
import { validateGenericPlan } from "../functions/_shared/profile-template-plan-validator";
import {
  snapshotTemplate,
  templateSnapshotPlan,
} from "../functions/_shared/profile-template-context";
import {
  prepareProfileSave,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import {
  resolveProfileContext,
  toStoredGenerationContext,
} from "../functions/_shared/profile-context";
import { paperPlanForAttempt } from "../functions/_shared/course-selection";
import {
  biologyPracticeInstructions,
  assertBiologyPractice,
  biologyPracticeCacheVersion,
} from "../functions/_shared/biology-practice";
import {
  biologyMarkingInstructions,
  biologyQuestionResourceContext,
} from "../functions/_shared/biology-marking";
import { templateFixture, genericRows } from "./profile-builder-fixtures";
const proposal = (): BuilderProposal => ({
  proposalVersion: 1,
  promptVersion: 1,
  origin: "model_knowledge_ai",
  presetId: null,
  evidence: null,
  evidenceVersion: null,
  profileSettings: null,
  template: templateFixture(),
});
it("compiles a reusable blueprint into the real planned-question contract", () => {
  const plan = compileTemplate(templateFixture());
  expect(plan.totalMarks).toBe(6);
  expect(plan.parts.map((p) => p.questionNumber)).toEqual(["1(a)", "1(b)"]);
  expect(plan.parts[1].resource).toBe("data_table");
  expect(validateQuestionCandidates(genericRows(), { plan }).ok).toBe(true);
});
it("computes achievable optional marks and blocks unsupported selection adapters", () => {
  const t = templateFixture();
  t.sections[0].groups.push({
    id: "alternative",
    parts: [
      { ...t.sections[0].groups[0].parts[0], id: "alternativepart", marks: 6 },
    ],
  });
  t.sections[0].answerCount = 1;
  expect(validateTemplate(t).printedMarks).toBe(12);
  expect(validateTemplate(t).effectiveMarks).toBe(6);
  expect(() => compileTemplate(t)).toThrow(/selection/);
  t.sections[0].groups[1].parts[0].marks = 5;
  expect(() => validateTemplate(t)).toThrow(/equal/);
});
it.each(["marks", "topic", "id", "resource"] as const)(
  "blocks invalid edited %s",
  (field) => {
    const t = templateFixture(),
      p = t.sections[0].groups[0].parts[0];
    if (field === "marks") p.marks = 0;
    if (field === "topic") p.topic = "Unstudied genetics";
    if (field === "id") p.id = "enzymes";
    if (field === "resource") p.resource = "diagram";
    expect(() => compileTemplate(t)).toThrow();
  },
);
it("respects the existing database fifty-part bound", () => {
  const t = templateFixture();
  t.marks = 51;
  t.sections[0].groups = Array.from({ length: 6 }, (_, g) => ({
    id: "g" + g,
    parts: Array.from({ length: g === 5 ? 1 : 10 }, (_, i) => ({
      id: `p${g}-${i}`,
      topic: t.topics[0],
      marks: 1,
      response: "short_answer" as const,
      demand: "AO1" as const,
      resource: "none" as const,
    })),
  }));
  expect(() => compileTemplate(t)).toThrow(/50/);
});
it("blocks missing, repeated and invented planned parts without renumbering", () => {
  const rows = genericRows(),
    plan = compileTemplate(templateFixture());
  expect(
    validateGenericPlan(rows.slice(0, 1), plan).some((d) =>
      d.detail.includes("Missing planned"),
    ),
  ).toBe(true);
  expect(
    validateGenericPlan([rows[0], rows[0], rows[1]], plan).some((d) =>
      d.detail.includes("duplicate"),
    ),
  ).toBe(true);
  expect(
    validateGenericPlan([{ ...rows[0], question_number: "99" }, rows[1]], plan)
      .length,
  ).toBeGreaterThan(0);
});
it("reuses a frozen snapshot despite later profile changes; stale settings must be reviewed", () => {
  const save = prepareProfileSave(proposal(), templateFixture()),
    profile = {
      ...save.settings,
      id: "p",
      subject_name: "Biology",
      profile_template: save.context,
    },
    snapshot = snapshotTemplate(profile)!;
  profile.time_limit_minutes = 31;
  expect(() => snapshotTemplate(profile)).toThrow(/Settings changed/);
  expect(templateSnapshotPlan(snapshot)?.durationMinutes).toBe(30);
  snapshot.plan!.durationMinutes = 40;
  expect(() => templateSnapshotPlan(snapshot)).toThrow(/differs/);
});
it("owns context resolution and integrates practice, marking and cache scope", async () => {
  const save = prepareProfileSave(proposal(), templateFixture()),
    profile = {
      ...save.settings,
      id: "p",
      subject_name: "Biology",
      profile_template: save.context,
    },
    db = {
      from: () => ({
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => ({ data: profile, error: null }),
      }),
    };
  const context = toStoredGenerationContext(
    await resolveProfileContext(db, {
      userId: "owner",
      subjectName: "Biology",
      profileId: "p",
    }),
  );
  expect(paperPlanForAttempt(context)?.totalMarks).toBe(6);
  expect(biologyPracticeInstructions(context)).toContain(
    "preserve the requested count",
  );
  assertBiologyPractice(
    genericRows().map((r) => ({ ...r, subtopic: r.topic_tag })),
    context,
  );
  expect(() =>
    assertBiologyPractice(
      genericRows().map((r) => ({ ...r, subtopic: "Unstudied" })),
      context,
    ),
  ).toThrow(/scope/);
  expect(biologyMarkingInstructions(context)).toContain(
    "Failed marking remains ungraded",
  );
  expect(biologyQuestionResourceContext(context, genericRows()[1])).toContain(
    "Activity",
  );
  expect(biologyPracticeCacheVersion(context)).not.toEqual(
    biologyPracticeCacheVersion({
      ...context,
      profile_template: { ...(context.profile_template as any), version: 2 },
    }),
  );
});
it("refuses an absent owned profile before any AI work", async () => {
  const db = {
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({ data: null, error: null }),
    }),
  };
  await expect(
    resolveProfileContext(db, {
      userId: "foreign",
      subjectName: "Biology",
      profileId: "p",
    }),
  ).rejects.toThrow(/not found/);
});

it('keeps private syllabus spans and titles out of shareable attempt snapshots while freezing evidence versions',async()=>{
  const {ownerEvidence}=await import('./profile-builder-fixtures');
  const {evidenceFingerprint}=await import('../functions/_shared/profile-evidence');
  const evidence=await ownerEvidence(),p={...proposal(),origin:'source_backed_ai' as const,evidence,evidenceVersion:await evidenceFingerprint(evidence)};
  const saved=prepareProfileSave(p,p.template),snapshot=snapshotTemplate({...saved.settings,profile_template:saved.context})!;
  expect(JSON.stringify(saved.context)).toContain('Private module brief');
  expect(JSON.stringify(snapshot)).not.toContain('Private module brief');
  expect(JSON.stringify(snapshot)).not.toContain('award founder approval');
  expect(templateSnapshotPlan(snapshot)?.totalMarks).toBe(6);
  (snapshot.context.evidence as any).facts.marks=7;
  expect(()=>templateSnapshotPlan(snapshot)).toThrow(/binding changed/);
});
