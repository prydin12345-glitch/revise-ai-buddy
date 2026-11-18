import { canonicalCourseId, getCourseOptions } from "./assessment-tier.ts";
import { assessmentMetadataCourses } from "./profile-assessment-options.ts";
import { REVIEWED_ASSESSMENT_COURSES } from "./profile-assessment-catalogue.ts";
import type { TemplateIdentity } from "./profile-template.ts";

const key = (value: string) => value.replace(/\s+/g, "").toLowerCase();
export const isSourceCoursePlaceholder = (identity: Pick<TemplateIdentity, "course" | "qualification" | "subject">) =>
  !identity.course.trim() || key(identity.course) === key(`${identity.qualification} ${identity.subject}`);

/** Intake placeholders describe a choice, never source evidence or a saved template.
 * Only prepare_source may accept blank course/version fields. All other fields
 * and all save/confirm requests still pass the original strict identity schema. */
export function normaliseSourceIdentity(input: TemplateIdentity): TemplateIdentity {
  const identity = { ...input };
  const uk = ["GB", "UK", "United Kingdom"].includes(identity.country);
  const courses = uk ? [
    ...getCourseOptions({ subject: identity.subject, examBoard: identity.organisation, educationalTier: identity.qualification })
      .map(course => ({ id: course.id, code: course.specificationCode ?? course.id, untiered: course.tierMode === "untiered" })),
    ...assessmentMetadataCourses(identity).map(course => ({ id: course.id, code: course.courseCode, untiered: course.tier === "not_tiered" })),
    ...REVIEWED_ASSESSMENT_COURSES.filter(course =>
      course.subjectAliases.includes(identity.subject.trim().toLowerCase()) &&
      key(course.organisation) === key(identity.organisation) && course.qualification === identity.qualification,
    ).map(course => ({ id: course.id, code: course.courseCode, untiered: false })),
  ].filter((course, index, all) => all.findIndex(item => item.id === course.id) === index) : [];
  const placeholder = isSourceCoursePlaceholder(identity);
  const selected = placeholder
    ? courses.length === 1 ? courses[0] : undefined
    : courses.find(course => key(course.id) === key(canonicalCourseId(identity.course) ?? identity.course) || key(course.code) === key(identity.course));
  identity.course = selected?.code ?? (identity.course.trim() || `${identity.qualification.trim()} ${identity.subject.trim()}`);
  identity.specificationVersion = identity.specificationVersion.trim() || "Not verified";
  if (selected?.untiered && identity.tier === null) identity.tier = "not_tiered";
  return identity;
}

/** Leave malformed types untouched for strict validation, including unknown keys. */
export function normaliseSourceRequest(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !("action" in raw) || raw.action !== "prepare_source" || !("identity" in raw)) return raw;
  const identity = raw.identity;
  if (!identity || typeof identity !== "object" || !["country", "qualification", "subject", "organisation", "course", "specificationVersion"].every(field => typeof (identity as Record<string, unknown>)[field] === "string")) return raw;
  return { ...raw, identity: normaliseSourceIdentity(identity as TemplateIdentity) };
}
