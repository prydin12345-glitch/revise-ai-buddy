// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  REVIEWED_ASSESSMENT_COURSES,
  reviewedAssessmentCourses,
  reviewedAssessmentIdentity,
  reviewedAssessmentPapers,
  reviewedAssessmentSource,
} from "../functions/_shared/profile-assessment-catalogue";
import { AQA_SCIENCE_SOURCES } from "../functions/_shared/profile-aqa-science-sources";
import {
  validateEvidence,
  validateEvidenceTemplate,
} from "../functions/_shared/profile-evidence";
import { resolveRegisteredSource } from "../functions/_shared/profile-source-registry";
import { approvalCatalogue } from "../functions/_shared/preset-approval";
import type { TemplateIdentity } from "../functions/_shared/profile-template";

const physics = {
  country: "GB",
  qualification: "GCSE",
  organisation: "AQA",
  subject: "Physics",
};

describe("reviewed source-backed assessment catalogue", () => {
  it("offers human paper choices for explicitly identified separate GCSE Physics", () => {
    expect(reviewedAssessmentCourses(physics).map((entry) => entry.id)).toEqual(
      ["aqa_gcse_physics_8463"],
    );
    expect(
      reviewedAssessmentPapers(physics).map((entry) => entry.label),
    ).toEqual(["Paper 1", "Paper 2"]);
    const identity = reviewedAssessmentIdentity(
      "aqa_gcse_physics_8463",
      "paper_1",
      "higher",
    )!;
    expect(identity).toMatchObject({
      course: "8463",
      component: "8463/1H",
      specificationVersion: "v1.1-2019-09-30",
      tier: "higher",
    });
    expect(reviewedAssessmentSource(identity)).toBe(
      "aqa-8463-1h-v1.1-2019-09-30",
    );
  });

  it.each([
    { ...physics, subject: "Combined Science" },
    { ...physics, subject: "Combined Science: Trilogy" },
    { ...physics, subject: "Physics and Chemistry" },
    { ...physics, country: "US" },
    { ...physics, qualification: "A-level" },
    { ...physics, organisation: "Pearson Edexcel", subject: "Biology" },
    { ...physics, organisation: "" },
  ])("does not guess a reviewed course for %j", (identity) => {
    expect(reviewedAssessmentCourses(identity)).toEqual([]);
    expect(reviewedAssessmentPapers(identity)).toEqual([]);
  });

  it("requires an explicit applicable tier and component", () => {
    expect(
      reviewedAssessmentIdentity("aqa_gcse_physics_8463", "paper_1", null),
    ).toBeNull();
    expect(
      reviewedAssessmentIdentity(
        "aqa_gcse_physics_8463",
        "paper_1",
        "not_tiered",
      ),
    ).toBeNull();
    expect(
      reviewedAssessmentIdentity("aqa_gcse_physics_8463", "paper_3", "higher"),
    ).toBeNull();
  });

  it("binds source lookup to the complete canonical identity", () => {
    const identity = reviewedAssessmentIdentity(
      "aqa_gcse_physics_8463",
      "paper_1",
      "higher",
    )!;
    const changes: Partial<TemplateIdentity>[] = [
      { country: "UK" },
      { educationSystem: "UK" },
      { stage: "University" },
      { course: "8464" },
      { qualification: "A-level" },
      { component: "8463/1F" },
      { specificationVersion: "older" },
      { tier: null },
      { subject: "physics (single science)" },
      { organisation: "aqa" },
    ];
    for (const change of changes)
      expect(reviewedAssessmentSource({ ...identity, ...change })).toBeNull();
  });

  it("uses the specification currently linked by AQA rather than the stale Chemistry filestore copy", () => {
    const identity = reviewedAssessmentIdentity(
      "aqa_gcse_chemistry_8462",
      "paper_1",
      "foundation",
    )!;
    expect(identity.specificationVersion).toBe("v1.2-2026-01-16");
    const evidence = resolveRegisteredSource(
      reviewedAssessmentSource(identity)!,
    );
    expect(evidence.documents[0]).toMatchObject({
      version: "Version 1.2, 16 January 2026",
      checksum:
        "e73a5320c62b589c691823cd235a5790c106c246f12762b72b94e06b1bf6ca1c",
    });
  });

  it("validates all eight component/tier evidence packs without awarding approval", () => {
    expect(AQA_SCIENCE_SOURCES).toHaveLength(8);
    expect(new Set(AQA_SCIENCE_SOURCES.map((entry) => entry.id)).size).toBe(8);
    for (const entry of AQA_SCIENCE_SOURCES) {
      const evidence = validateEvidence(entry.evidence);
      expect(evidence.facts).toMatchObject({
        marks: 100,
        durationMinutes: 105,
        calculator: "allowed",
        selection: "all_compulsory",
      });
      expect(
        evidence.documents.every(
          (document) => document.authority === "official_registered",
        ),
      ).toBe(true);
      expect(
        evidence.documents[1].locations.every(
          (location) => location.page === 1,
        ),
      ).toBe(true);
      expect(resolveRegisteredSource(entry.id)).toEqual(evidence);
    }
    for (const course of REVIEWED_ASSESSMENT_COURSES)
      expect(
        approvalCatalogue().some((entry) => entry.course === course.id),
      ).toBe(false);
  });

  it("retains the specifically permitted Paper 2 foundations without opening all Paper 1 content", () => {
    const chemistry = resolveRegisteredSource("aqa-8462-2h-v1.2-2026-01-16");
    expect(chemistry.facts.topics).toContain("Quantitative chemistry");
    expect(chemistry.facts.topics).toContain("Organic chemistry");
    expect(chemistry.facts.topics).not.toContain("Chemical changes");
    expect(chemistry.facts.topics).not.toContain("Energy changes");
    const physics = resolveRegisteredSource("aqa-8463-2f-v1.1-2019-09-30");
    expect(physics.facts.topics).toContain("Space physics");
    expect(physics.facts.topics).not.toContain("Atomic structure");
    expect(physics.facts.topics).not.toContain("Electricity");
    expect(
      physics.facts.topics.some((topic) =>
        topic.includes("energy conservation"),
      ),
    ).toBe(true);
  });

  it("a shared specification URL cannot silently choose a paper or tier", () => {
    const entry = AQA_SCIENCE_SOURCES[0];
    const specificationUrl = entry.evidence.documents[0].url!;
    expect(() => resolveRegisteredSource(undefined, specificationUrl)).toThrow(
      /paper and tier/,
    );
    expect(resolveRegisteredSource(entry.id, specificationUrl)).toEqual(
      entry.evidence,
    );
    expect(() =>
      resolveRegisteredSource(
        entry.id,
        AQA_SCIENCE_SOURCES[4].evidence.documents[0].url!,
      ),
    ).toThrow(/not registered/);
    expect(() =>
      resolveRegisteredSource(
        undefined,
        "https://cdn.sanity.io/files/another-tenant/document.pdf",
      ),
    ).toThrow(/not registered/);
  });

  it("source validation rejects a draft that imports an out-of-paper topic", () => {
    const evidence = resolveRegisteredSource("aqa-8463-1h-v1.1-2019-09-30");
    expect(() =>
      validateEvidenceTemplate(
        {
          schemaVersion: 1,
          identity: evidence.identity,
          mode: "short_practice",
          marks: 1,
          durationMinutes: 2,
          topics: ["Space physics"],
          calculator: "allowed",
          sections: [
            {
              id: "paper",
              title: "Paper",
              groups: [
                {
                  id: "q1",
                  parts: [
                    {
                      id: "q1a",
                      topic: "Space physics",
                      marks: 1,
                      response: "short_answer",
                      demand: "AO1",
                      resource: "none",
                    },
                  ],
                },
              ],
            },
          ],
          warnings: [],
          designDecisions: [],
        },
        evidence,
      ),
    ).toThrow(/outside source scope/);
  });
});
