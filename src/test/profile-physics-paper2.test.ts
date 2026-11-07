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
