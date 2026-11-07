import { describe, expect, it } from "vitest";
import { resolveReviewedAssessmentRules } from "../../supabase/functions/_shared/profile-reviewed-assessment-rules";
import { fillFormatsFromCitedBlock } from "../../supabase/functions/_shared/profile-builder-jobs";
import type { ProfileEvidence } from "../../supabase/functions/_shared/profile-evidence";

const identity = (component: string) => ({
  country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level",
  subject: "Physics", organisation: "AQA", course: "7408", component,
  specificationVersion: "v1.4-july-2026", tier: "not_tiered" as const,
});

describe("AQA A-level Physics reviewed cover instructions", () => {
  it("covers Paper 2 with answer-all and calculator rules", () => {
    const r = resolveReviewedAssessmentRules(identity("7408/2"))!;
    expect(r.facts).toEqual({ selection: "all_compulsory", calculator: "allowed" });
    expect(r.documents[0].title).toContain("7408/2");
  });
  it("still excludes Paper 3, which has an optional section", () => {
    expect(resolveReviewedAssessmentRules(identity("7408/3A"))).toBeNull();
  });
});

describe("question formats from the cited assessment block", () => {
  it("recovers formats the reader skipped", () => {
    const text = "Paper 2 What's assessed Sections 6.2 (Thermal Physics), 7 and 8 Assessed written exam: 2 hours 85 marks Questions 60 marks of short and long answer questions and 25 multiple choice questions on content.";
    const e: ProfileEvidence = {
      version: 1, identity: identity("7408/2"),
      documents: [{ id: "u", checksum: "a".repeat(64), title: "Spec", url: null, version: "1.4",
        kind: "specification", authority: "owner_supplied", retrievedOn: "unknown", state: "active",
        applicableCohort: "x", locations: [{ id: "l1", page: 9, section: "Paper 2", text }] }],
      facts: { marks: 85, durationMinutes: null, topics: [], tier: null, calculator: "unknown",
        formats: [], selection: "unknown", mathsRequirement: null, practicalRequirement: null },
      claims: [{ field: "marks", documentId: "u", locationId: "l1", quote: "85 marks", rule: "mandatory" }],
      unresolved: [], conflicts: [],
    };
    expect(fillFormatsFromCitedBlock(e).facts.formats).toEqual(["mcq_single", "short_answer", "long_form"]);
  });
});

import { validateEvidenceTemplate } from "../../supabase/functions/_shared/profile-evidence";
import { structureGaps } from "../../supabase/functions/_shared/profile-builder-jobs";

describe("missing paper structure is filled in by the student", () => {
  const base = (): ProfileEvidence => ({
    version: 1, identity: identity("7408/2"),
    documents: [{ id: "u", checksum: "a".repeat(64), title: "Spec", url: null, version: "1.4",
      kind: "specification", authority: "owner_supplied", retrievedOn: "unknown", state: "active",
      applicableCohort: "x", locations: [{ id: "l1", page: 9, section: "Paper 2", text: "Sections 7 and 8 written exam: 2 hours 85 marks" }] }],
    facts: { marks: 85, durationMinutes: 120, topics: ["Sections 7 and 8"], tier: "not_tiered", calculator: "unknown",
      formats: [], selection: "unknown", mathsRequirement: null, practicalRequirement: null },
    claims: [
      { field: "marks", documentId: "u", locationId: "l1", quote: "85 marks", rule: "mandatory" },
      { field: "durationMinutes", documentId: "u", locationId: "l1", quote: "written exam: 2 hours", rule: "mandatory" },
      { field: "topics", documentId: "u", locationId: "l1", quote: "Sections 7 and 8", rule: "mandatory" },
    ],
    unresolved: [], conflicts: [], catalogueFacts: [{ version: 1, field: "tier", source: "assessment_catalogue", courseId: "aqa_alevel_physics_7408", value: "not_tiered" }],
  });
  const template = (marks: number): any => ({
    schemaVersion: 1, identity: identity("7408/2"), mode: "full_mock", marks, durationMinutes: 120,
    topics: ["Sections 7 and 8"], calculator: "unknown", warnings: [], designDecisions: [],
    sections: [{ id: "s", title: "S", groups: [{ id: "g", parts: [{ id: "p", topic: "Sections 7 and 8", marks, response: "short_answer", demand: "AO1", resource: "none" }] }] }],
  });
  it("lists unknown formats and question choice as gaps", () => {
    expect(structureGaps(base()).map((g) => g.warning)).toEqual(["question types", "which questions to answer"]);
  });
  it("allows a full mock when formats are unknown", () => {
    expect(() => validateEvidenceTemplate(template(85), base())).not.toThrow();
  });
  it("still rejects marks that contradict the source", () => {
    expect(() => validateEvidenceTemplate(template(30), base())).toThrow();
  });
});
