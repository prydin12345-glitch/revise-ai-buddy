// @vitest-environment node
import { expect, it } from "vitest";
import { assessmentMetadataCourses } from "../functions/_shared/profile-assessment-options";
import { resolveCatalogueTier } from "../functions/_shared/profile-catalogue-evidence";
import { completeOwnedAssessmentEvidence } from "../functions/_shared/profile-evidence-ingestion";
import { normaliseSourceIdentity } from "../functions/_shared/profile-builder-identity";
import { getCourseOptions } from "../functions/_shared/assessment-tier";
import { ownerEvidence } from "./profile-builder-fixtures";

const identity = { country: "GB", educationSystem: "UK", stage: "Secondary", qualification: "A-level",
  subject: "Business", organisation: "Pearson Edexcel", course: "9BS0", component: "9BS0/01",
  specificationVersion: "Issue 1 September 2014", tier: null };

it.each(["Business", "Business Studies"])("resolves the reviewed %s course, three paper codes and untiered provenance", subject => {
  const course = assessmentMetadataCourses({ ...identity, subject })[0];
  expect(course?.id).toBe("pearson_alevel_business_9bs0");
  expect(course.papers.map(paper => paper.componentCode)).toEqual(["9BS0/01", "9BS0/02", "9BS0/03"]);
  expect(course.tierSource?.quote).toBe("In line with current practice, all reformed AS and A levels will be untiered.");
  expect(resolveCatalogueTier({ ...identity, subject })).toMatchObject({ value: "not_tiered", source: "assessment_catalogue", courseId: course.id });
  expect(normaliseSourceIdentity({ ...identity, subject, course: "" })).toMatchObject({ course: "9BS0", tier: "not_tiered" });
  // Metadata and a tier fact do not grant a guided course adapter or approval.
  expect(getCourseOptions({ subject, examBoard: "Pearson Edexcel", educationalTier: "A-level" })).toEqual([]);
});

it.each([
  { country: "US" }, { stage: "University" }, { qualification: "AS" },
  { qualification: "GCSE" }, { qualification: "International A-level" }, { organisation: "AQA" },
  { subject: "Economics" }, { course: "8BS0" }, { course: "9BS1" }, { course: "Unreviewed" },
])("does not apply the Business tier record across another identity %j", change => {
  expect(resolveCatalogueTier({ ...identity, ...change })).toBeNull();
});

it("adds server catalogue provenance without inventing an untiered sentence in an upload", async () => {
  const evidence = await ownerEvidence();
  evidence.identity = { ...identity };
  evidence.facts.tier = null;
  evidence.claims = evidence.claims.filter(claim => claim.field !== "tier");
  evidence.documents[0].locations[0].text = evidence.documents[0].locations[0].text.replace("This assessment is untiered. ", "");
  const completed = completeOwnedAssessmentEvidence(evidence);
  expect(completed.identity.tier).toBe("not_tiered");
  expect(completed.facts.tier).toBe("not_tiered");
  expect(completed.catalogueFacts?.[0].courseId).toBe("pearson_alevel_business_9bs0");
  expect(completed.claims.some(claim => claim.field === "tier")).toBe(false);
  expect(completed.documents).toEqual(evidence.documents);
});

it("continues to reject a concrete Foundation/Higher contradiction", async () => {
  const evidence = await ownerEvidence();
  evidence.identity = { ...identity, tier: "higher" };
  evidence.facts.tier = null;
  expect(() => completeOwnedAssessmentEvidence(evidence)).toThrow(/untiered/);
});
