// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveReviewedAssessmentRules } from "../functions/_shared/profile-reviewed-assessment-rules";
import { evidenceSchema } from "../functions/_shared/profile-evidence";
import type { TemplateIdentity } from "../functions/_shared/profile-template";

const identity: TemplateIdentity = {
  country: "GB",
  educationSystem: "UK",
  stage: "Secondary",
  qualification: "A-level",
  subject: "Physics",
  organisation: "AQA",
  course: "7408",
  component: "7408/1",
  specificationVersion: "v1.4-july-2026",
  tier: "not_tiered",
};

describe("reviewed assessment instruction supplements", () => {
  it("resolves real cover instruction provenance without adding unrelated facts or approval", () => {
    const rules = resolveReviewedAssessmentRules(identity)!;
    expect(rules.facts).toEqual({
      selection: "all_compulsory",
      calculator: "allowed",
    });
    expect(rules).toMatchObject({
      id: "aqa-7408-01-reviewed-cover-rules-v1",
      version: 1,
    });
    expect(rules).not.toHaveProperty("approval");
    expect(rules).not.toHaveProperty("identity");
    expect(rules.facts).not.toHaveProperty("tier");
    expect(rules.facts).not.toHaveProperty("marks");
    expect(rules.facts).not.toHaveProperty("topics");
    expect(evidenceSchema.shape.documents.parse(rules.documents)).toEqual(
      rules.documents,
    );
    expect(evidenceSchema.shape.claims.parse(rules.claims)).toEqual(
      rules.claims,
    );
    expect(rules.documents[0]).toMatchObject({
      authority: "official_registered",
      kind: "past_paper",
      version: "June 2025 sitting",
      retrievedOn: "2026-11-06",
      checksum:
        "596abcf08ef3cebdafcc6ef377d461259809ebb470f36fc3f4af5d2c85848d73",
      url: "https://cdn.sanity.io/files/p28bar15/green/c2d052b11c09b8b207fdcb98da24ae0e81515b46.pdf",
    });
    for (const claim of rules.claims) {
      const document = rules.documents.find(
        (document) => document.id === claim.documentId,
      )!;
      const location = document.locations.find(
        (location) => location.id === claim.locationId,
      )!;
      expect(location.page).toBe(1);
      expect(location.text).toBe(claim.quote);
      expect(claim.rule).toBe("mandatory");
    }
  });

  it.each([
    "Paper 1",
    "paper1",
    "paper_1",
    "(Paper 1)",
    "（Paper 1）",
    "7408/1",
  ])(
    "accepts exact known Paper 1 alias %s within the supported course",
    (component) => {
      expect(
        resolveReviewedAssessmentRules({ ...identity, component }),
      ).not.toBeNull();
    },
  );

  it.each([
    "",
    "Not verified",
    "unknown",
    "First teaching 2015, first exams 2017",
    "Version 1.4 July 2026",
    "1.4 July 2026",
  ])(
    "does not invent a source version from input %s",
    (specificationVersion) => {
      const input = { ...identity, specificationVersion };
      const before = structuredClone(input);
      expect(resolveReviewedAssessmentRules(input)).not.toBeNull();
      expect(input).toEqual(before);
    },
  );

  it.each(["7408/2", "Paper 2"])(
    "resolves the newly reviewed Paper 2 independently from Paper 1: %s",
    (component) => {
      const rules = resolveReviewedAssessmentRules({ ...identity, component })!;
      expect(rules.id).toBe("aqa-7408-02-reviewed-cover-rules-v1");
      expect(rules.documents[0].title).toContain("7408/2");
      expect(rules.documents[0].checksum).not.toBe(
        resolveReviewedAssessmentRules(identity)!.documents[0].checksum,
      );
      expect(rules.facts).toEqual({
        selection: "all_compulsory",
        calculator: "allowed",
      });
    },
  );

  it.each([
    { country: "US" },
    { country: "AU" },
    { country: "United States" },
    { organisation: "OCR" },
    { organisation: "Pearson Edexcel" },
    { qualification: "AS" },
    { qualification: "GCSE" },
    { qualification: "International A-level" },
    { subject: "Chemistry" },
    { course: "7407" },
    { course: "7405" },
    { course: "8463" },
    { course: "A-level Physics" },
    { component: "7407/1" },
    { component: "7408/3" },
    { component: "7408/3A" },
    { component: "7408/3BA" },
    { component: "7408/10" },
    { component: "Paper 3" },
    { component: "Paper 1 Higher" },
    { component: "AQA A-level Physics Paper 1" },
    { tier: "higher" as const },
    { tier: "foundation" as const },
    { specificationVersion: "v1.3-may-2025" },
    { specificationVersion: "v14-july-2026" },
    { specificationVersion: "2015" },
    { specificationVersion: "Issue 1.4 July 2026" },
    { specificationVersion: "Version 1.4; first teaching 2015" },
    { specificationVersion: "another edition" },
  ])("cannot confer instructions on a different identity: %s", (change) => {
    expect(
      resolveReviewedAssessmentRules({ ...identity, ...change }),
    ).toBeNull();
  });

  it("supports the existing metadata course ID, UK alias and unresolved tier without asserting tier", () => {
    const rules = resolveReviewedAssessmentRules({
      ...identity,
      country: "UK",
      organisation: "aqa",
      subject: "physics",
      course: "aqa_alevel_physics_7408",
      tier: null,
    });
    expect(rules?.facts).toEqual({
      selection: "all_compulsory",
      calculator: "allowed",
    });
  });

  it("returns isolated data so one build cannot corrupt later reviewed provenance", () => {
    const first = resolveReviewedAssessmentRules(identity)!;
    first.documents[0].checksum = "0".repeat(64);
    first.documents[0].locations[0].text = "Answer any question.";
    first.claims[0].quote = "changed";
    const second = resolveReviewedAssessmentRules(identity)!;
    expect(second.documents[0].checksum).toBe(
      "596abcf08ef3cebdafcc6ef377d461259809ebb470f36fc3f4af5d2c85848d73",
    );
    expect(second.documents[0].locations[0].text).toBe("Answer all questions.");
    expect(second.claims[0].quote).toBe("Answer all questions.");
  });
});
