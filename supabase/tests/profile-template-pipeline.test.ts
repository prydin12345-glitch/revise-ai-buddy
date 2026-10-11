// @vitest-environment node
import { it, expect } from "vitest";
import { extract, boundaryHandler, practice } from "./aqa-alevel-runtime";
import { templateFixture, genericRows } from "./profile-builder-fixtures";
import {
  prepareProfileSave,
  type BuilderProposal,
} from "../functions/_shared/profile-builder-service";
import { snapshotTemplate } from "../functions/_shared/profile-template-context";
import { compileTemplate } from "../functions/_shared/profile-template";
const template = templateFixture(),
  proposal: BuilderProposal = {
    proposalVersion: 1,
    promptVersion: 1,
    template,
    origin: "model_knowledge_ai",
    evidence: null,
    evidenceVersion: null,
    presetId: null,
    profileSettings: null,
  };
function fixture() {
  const saved = prepareProfileSave(proposal, template),
    profile = { ...saved.settings, profile_template: saved.context },
    plan = compileTemplate(template);
  return {
    plan,
    rows: genericRows(),
    snapshot: {
      context_version: 2,
      resolved_by: "server",
      profile_id: "profile",
      subject_name: "Biology",
      exam_board: template.identity.organisation,
      educational_tier: template.identity.qualification,
      assessment_tier: "not_tiered",
      course_id: plan.courseId,
      paper_id: plan.paperId,
      component_code: plan.componentCode,
      paper_contract: null,
      profile_template: snapshotTemplate(profile),
    },
  };
}
it("a saved generic template drives the actual bounded exam generator and publication gate", async () => {
  const f = fixture(),
    result = await extract(false, "short_practice", "paper_1", f);
  expect(String(result.error ?? "")).toBe("");
  expect(result.exam.extraction_status).toBe("completed");
  expect(result.drafts.map((q) => q.question_number)).toEqual(
    f.plan.parts.map((p) => p.questionNumber),
  );
  expect(result.drafts.reduce((n, q) => n + q.marks, 0)).toBe(6);
  expect(result.generationCalls).toHaveLength(1);
  expect(
    result.generationCalls[0].messages.map((m: any) => m.content).join("\n"),
  ).toContain("SAVED TEMPLATE SCOPE");
  const publication = await boundaryHandler(
    "publish-exam",
    result.drafts,
    "short_practice",
    "paper_1",
    f.snapshot,
  );
  expect((await publication.run({ draftId: "exam" })).status).toBe(200);
});
it("missing generic required resources remain blocked after bounded repairs", async () => {
  const f = fixture(),
    result = await extract(
      {
        mutate: (q) => {
          delete q[1].chart_data;
        },
      },
      "short_practice",
      "paper_1",
      f,
    );
  expect(String(result.error)).toContain("missing_required_resource");
  expect(result.repairCalls.length).toBeLessThanOrEqual(8);
  expect(result.exam.extraction_status).not.toBe("completed");
});
it.each(["generate-practice-questions", "get-practice-questions"])(
  "%s preserves ordinary quiz shape and never reads or writes a builder global cache",
  async (name) => {
    const f = fixture(),
      questions = genericRows().map((r, i) => ({
        ...r,
        question_number: String(i + 1),
        subtopic: r.topic_tag,
        difficulty_level: "medium",
        diagram_config: null,
        question_text:
          "Describe a function of " + r.topic_tag.toLowerCase() + ".",
        task: "Describe a function of " + r.topic_tag.toLowerCase() + ".",
      })),
      result = await practice(name, true, false, "paper_1", {
        snapshot: f.snapshot,
        questions,
        topics: template.topics,
      });
    expect(result.set.extraction_status, JSON.stringify(result.errors)).toBe(
      "completed",
    );
    expect(result.writes.some((w) => w.table === "practice_questions")).toBe(
      true,
    );
    expect(result.reads).not.toContain("question_generation_cache");
    expect(result.reads).not.toContain("student_cache_slots");
    expect(
      result.writes.some((w) => w.table === "question_generation_cache"),
    ).toBe(false);
  },
);
