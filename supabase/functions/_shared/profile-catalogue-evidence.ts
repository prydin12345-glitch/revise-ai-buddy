import { getCourseOptions } from "./assessment-tier.ts";
import { assessmentMetadataCourses } from "./profile-assessment-options.ts";
import type { TemplateIdentity } from "./profile-template.ts";

/** Course-level provenance, not a fabricated quote from an uploaded document. */
export interface CatalogueTierFact {
  version: 1;
  field: "tier";
  source: "assessment_catalogue";
  courseId: string;
  value: "not_tiered";
}

const key = (value: string) => value.trim().toLowerCase();

/** Only explicit catalogue identities establish an untiered qualification. */
export function resolveCatalogueTier(
  identity: TemplateIdentity,
): CatalogueTierFact | null {
  if (!["GB", "UK", "United Kingdom"].includes(identity.country)) return null;
  const metadata = assessmentMetadataCourses(identity).find((course) =>
    [course.id, course.courseCode].some(
      (value) => key(value) === key(identity.course),
    ),
  );
  // These reviewed metadata records identify A-level courses, but do not
  // provide or approve an assessment blueprint.
  if (metadata?.qualification === "A-level")
    return {
      version: 1,
      field: "tier",
      source: "assessment_catalogue",
      courseId: metadata.id,
      value: "not_tiered",
    };
  const course = getCourseOptions({
    subject: identity.subject,
    examBoard: identity.organisation,
    educationalTier: identity.qualification,
  }).find(
    (course) =>
      course.tierMode === "untiered" &&
      course.tiers.length === 1 &&
      course.tiers[0] === "not_tiered" &&
      course.curriculum?.qualification === identity.qualification &&
      [course.id, course.specificationCode].some(
        (value) => value && key(value) === key(identity.course),
      ),
  );
  return course
    ? {
        version: 1,
        field: "tier",
        source: "assessment_catalogue",
        courseId: course.id,
        value: "not_tiered",
      }
    : null;
}
