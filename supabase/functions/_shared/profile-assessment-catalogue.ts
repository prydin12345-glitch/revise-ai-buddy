import type { TemplateIdentity } from "./profile-template.ts";

/** Reviewed assessment identity/evidence, not approval of an Examly paper layout. */
export interface ReviewedAssessmentCourse {
  id: string;
  label: string;
  subject: string;
  subjectAliases: readonly string[];
  organisation: string;
  qualification: string;
  country: string;
  educationSystem: string;
  courseCode: string;
  specificationVersion: string;
  tiers: readonly ["foundation", "higher"];
  papers: readonly {
    id: string;
    label: string;
    components: Record<"foundation" | "higher", string>;
    sources: Record<"foundation" | "higher", string>;
  }[];
}

const course = (
  subject: "Physics" | "Chemistry",
  courseCode: "8463" | "8462",
  specificationVersion: string,
): ReviewedAssessmentCourse => ({
  id: `aqa_gcse_${subject.toLowerCase()}_${courseCode}`,
  label: `AQA GCSE ${subject}`,
  subject,
  // These are explicit separate-science aliases. Combined Science is a different course.
  subjectAliases: [
    subject.toLowerCase(),
    `${subject.toLowerCase()} (single science)`,
  ],
  organisation: "AQA",
  qualification: "GCSE",
  country: "GB",
  educationSystem: "England",
  courseCode,
  specificationVersion,
  tiers: ["foundation", "higher"],
  papers: [1, 2].map((number) => ({
    id: `paper_${number}`,
    label: `Paper ${number}`,
    components: {
      foundation: `${courseCode}/${number}F`,
      higher: `${courseCode}/${number}H`,
    },
    sources: {
      foundation: `aqa-${courseCode}-${number}f-${specificationVersion}`,
      higher: `aqa-${courseCode}-${number}h-${specificationVersion}`,
    },
  })),
});

export const REVIEWED_ASSESSMENT_COURSES: readonly ReviewedAssessmentCourse[] =
  [
    course("Physics", "8463", "v1.1-2019-09-30"),
    course("Chemistry", "8462", "v1.2-2026-01-16"),
  ];

const normalise = (value: string) => value.trim().toLowerCase();

/** Catalogue presentation requires an explicit subject, country, level and board. */
export function reviewedAssessmentCourses(
  identity: Partial<TemplateIdentity>,
): ReviewedAssessmentCourse[] {
  return REVIEWED_ASSESSMENT_COURSES.filter(
    (entry) =>
      identity.country === entry.country &&
      identity.qualification === entry.qualification &&
      normalise(identity.organisation ?? "") ===
        normalise(entry.organisation) &&
      entry.subjectAliases.includes(normalise(identity.subject ?? "")),
  );
}

export function reviewedAssessmentPapers(identity: Partial<TemplateIdentity>) {
  const entries = reviewedAssessmentCourses(identity).filter(
    (entry) =>
      !identity.course ||
      identity.course === entry.id ||
      identity.course === entry.courseCode,
  );
  return entries.length === 1 ? entries[0].papers : [];
}

/** Called only after the student has selected the component and applicable tier. */
export function reviewedAssessmentIdentity(
  courseId: string,
  paperId: string,
  tier: string | null,
): TemplateIdentity | null {
  const entry = REVIEWED_ASSESSMENT_COURSES.find(
    (value) => value.id === courseId,
  );
  const paper = entry?.papers.find((value) => value.id === paperId);
  if (!entry || !paper || (tier !== "foundation" && tier !== "higher"))
    return null;
  return {
    country: entry.country,
    educationSystem: entry.educationSystem,
    stage: "Secondary",
    qualification: entry.qualification,
    subject: entry.subject,
    organisation: entry.organisation,
    course: entry.courseCode,
    component: paper.components[tier],
    specificationVersion: entry.specificationVersion,
    tier,
  };
}

/** Exact evidence identity, including version and tier; never a title-based guess. */
export function reviewedAssessmentSource(
  identity: TemplateIdentity,
): string | null {
  if (identity.stage !== "Secondary") return null;
  for (const entry of reviewedAssessmentCourses(identity)) {
    if (
      identity.subject !== entry.subject ||
      identity.organisation !== entry.organisation ||
      identity.educationSystem !== entry.educationSystem ||
      identity.course !== entry.courseCode ||
      identity.specificationVersion !== entry.specificationVersion ||
      (identity.tier !== "foundation" && identity.tier !== "higher")
    )
      continue;
    const paper = entry.papers.find(
      (value) =>
        value.components[identity.tier as "foundation" | "higher"] ===
        identity.component,
    );
    if (paper) return paper.sources[identity.tier];
  }
  return null;
}
