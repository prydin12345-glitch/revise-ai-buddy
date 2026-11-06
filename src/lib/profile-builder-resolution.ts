/** Presentation-only catalogue resolution. No new presets, evidence or approval claims. */
import {
  getCourseOptions,
  canonicalCourseId,
  type CourseCapability,
} from "../../supabase/functions/_shared/assessment-tier";
import { biologyPaperOptions } from "../../supabase/functions/_shared/biology-course-packs";
import { approvalCatalogue } from "../../supabase/functions/_shared/preset-approval";
import { templateFromPreset } from "../../supabase/functions/_shared/profile-builder-service";
import { SOURCE_REGISTRY } from "../../supabase/functions/_shared/profile-source-registry";
import {
  type TemplateIdentity,
  type ProfileTemplate,
} from "../../supabase/functions/_shared/profile-template";
import { ALL_LEVELS, detectRegionKey } from "./educational-levels";
import { REVIEWED_ASSESSMENT_COURSES } from "../../supabase/functions/_shared/profile-assessment-catalogue";
import {
  ASSESSMENT_METADATA_COURSES,
  assessmentMetadataCourses,
  type AssessmentKind,
  type AssessmentOption,
} from "../../supabase/functions/_shared/profile-assessment-options";
export type {
  AssessmentKind,
  AssessmentOption,
} from "../../supabase/functions/_shared/profile-assessment-options";

export type BuilderCourse = Pick<
  CourseCapability,
  "id" | "label" | "specificationCode" | "tierMode" | "tiers" | "boards"
>;

export interface BuilderContext {
  subject: string;
  board?: string | null;
  level?: string | null;
  region?: string | null;
  courseId?: string | null;
  paperId?: string | null;
  tier?: string | null;
}
export const BUILDER_BOARDS = [
  "AQA",
  "Pearson Edexcel",
  "OCR",
  "WJEC",
  "Eduqas",
  "CCEA",
];
const norm = (v: string) => v.trim().toLowerCase();
/** Board labels are catalogue aliases, never model inference or institution rewriting. */
export function builderBoardLabel(value: string | null | undefined): string {
  const text = value?.trim() ?? "";
  if (norm(text) === "edexcel") return "Pearson Edexcel";
  return BUILDER_BOARDS.find((board) => norm(board) === norm(text)) ?? text;
}
/** Only normalise typography for an explicit catalogue lookup. Unknown text stays unknown. */
export function normaliseAssessmentAlias(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/^\((.*)\)$/s, "$1")
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015_]/g, " ")
    .replace(/\b(paper|unit|component)\s*(\d+)\b/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}
const codeKey = (value: string) => value.replace(/\s+/g, "").toLowerCase();
export function builderLevel(
  level: string | null | undefined,
  region?: string | null,
): string {
  const key = detectRegionKey(region),
    l = level ?? "";
  if (
    ["level2", "level3", "level3_a_level"].includes(l) &&
    (!region || key === "UK")
  )
    return l === "level2" ? "GCSE" : "A-level";
  return (
    ALL_LEVELS.find((v) => v.id === l)?.aliases[key ?? ""] ??
    ALL_LEVELS.find((v) => v.id === l)?.label ??
    l
  );
}
export function builderInitialIdentity(c: BuilderContext): TemplateIdentity {
  const region = detectRegionKey(c.region),
    qualification = builderLevel(c.level, c.region);
  const uk =
    region === "UK" ||
    (!c.region && ["GCSE", "A-level"].includes(qualification)) ||
    (!c.region &&
      BUILDER_BOARDS.some(
        (b) =>
          norm(b) === norm(c.board ?? "") || norm(c.board ?? "") === "edexcel",
      ));
  const stage = ["undergrad", "postgrad", "doctoral"].includes(c.level ?? "")
    ? "University"
    : "Secondary";
  const country = uk
    ? "GB"
    : region === "USA"
      ? "US"
      : region === "AU"
        ? "AU"
        : (c.region ?? "");
  const identity: TemplateIdentity = {
    country,
    educationSystem: uk ? "UK" : country,
    stage,
    qualification,
    subject: c.subject,
    // A saved school exam-board preference does not identify a university.
    organisation:
      stage === "University" &&
      BUILDER_BOARDS.some((board) => norm(board) === norm(c.board ?? ""))
        ? ""
        : stage === "University"
          ? (c.board ?? "")
          : builderBoardLabel(c.board),
    course: "",
    component: c.paperId ?? "",
    specificationVersion: "",
    tier: null,
  };
  const courses = builderCourses(identity);
  const course = courses.find((v) => v.id === canonicalCourseId(c.courseId));
  if (course) identity.course = course.specificationCode ?? course.id;
  if (course?.tierMode === "untiered" || qualification === "A-level")
    identity.tier = "not_tiered";
  else if (["foundation", "higher"].includes(c.tier ?? ""))
    identity.tier = c.tier as "foundation" | "higher";
  return identity;
}
export function builderCourses(i: TemplateIdentity): BuilderCourse[] {
  // A UK level must never be inferred from an international age-band setting.
  if (i.country && !["GB", "UK", "United Kingdom"].includes(i.country))
    return [];
  const level =
    i.qualification === "GCSE"
      ? "level2"
      : i.qualification === "A-level"
        ? "level3"
        : i.qualification;
  const existing = getCourseOptions({
    subject: i.subject,
    examBoard: builderBoardLabel(i.organisation),
    educationalTier: level,
  });
  const reviewed = REVIEWED_ASSESSMENT_COURSES.filter(
    (course) =>
      course.subjectAliases.includes(norm(i.subject)) &&
      norm(course.organisation) === norm(i.organisation) &&
      course.qualification === i.qualification &&
      (!i.country || ["GB", "UK", "United Kingdom"].includes(i.country)),
  ).map((course) => ({
    id: course.id,
    label: course.label,
    specificationCode: course.courseCode,
    tierMode: "tiered" as const,
    tiers: [...course.tiers],
    boards: [norm(course.organisation)],
  }));
  const metadata = assessmentMetadataCourses({
    ...i,
    organisation: builderBoardLabel(i.organisation),
  }).map((course) => ({
    id: course.id,
    label: course.label,
    specificationCode: course.courseCode,
    tierMode: "untiered" as const,
    tiers: ["not_tiered"] as CourseCapability["tiers"],
    boards: [norm(course.board)],
  }));
  const combined = [...existing, ...reviewed, ...metadata];
  return combined.filter(
    (course, index) =>
      combined.findIndex((item) => item.id === course.id) === index,
  );
}
export function builderSelectedCourse(
  i: TemplateIdentity,
): BuilderCourse | null {
  const options = builderCourses(i);
  if (i.course && norm(i.course) !== norm(`${i.qualification} ${i.subject}`))
    return (
      options.find(
        (v) => v.id === i.course || v.specificationCode === i.course,
      ) ?? null
    );
  return options.length === 1 ? options[0] : null;
}
function conciseAssessmentLabel(label: string): {
  label: string;
  kind: AssessmentKind;
} {
  const cleaned = label.replace(/\s*\([^)]*\)/g, "").trim();
  const match = cleaned.match(/\b(Paper|Unit|Component)\s+\d.*$/i);
  if (match) {
    const kind = (match[1][0].toUpperCase() +
      match[1].slice(1).toLowerCase()) as AssessmentKind;
    return { label: match[0], kind };
  }
  return { label: cleaned, kind: "Assessment" };
}
export function builderPapers(i: TemplateIdentity): AssessmentOption[] {
  const course = builderSelectedCourse(i);
  const metadata = ASSESSMENT_METADATA_COURSES.find(
    (item) => item.id === course?.id,
  );
  if (metadata)
    return metadata.papers.map((paper) => ({
      ...paper,
      aliases: [...paper.aliases],
    }));
  const reviewed = REVIEWED_ASSESSMENT_COURSES.find(
    (item) => item.id === course?.id,
  );
  if (reviewed)
    return reviewed.papers.map((paper) => ({
      id: paper.id,
      label: paper.label,
      kind: "Paper",
      componentCode:
        paper.components[
          (i.tier ?? reviewed.tiers[0]) as keyof typeof paper.components
        ] ?? "",
      aliases: [paper.id, paper.label],
    }));
  return biologyPaperOptions(course?.id).map((pack) => {
    const definition = pack.definition(i.tier ?? pack.tiers[0]);
    const short = conciseAssessmentLabel(definition.displayName);
    const named = short.label
      .replace(
        /^(?:Paper|Unit|Component)\s+\d+\s*(?:[\u2013\u2014:-]\s*)?/i,
        "",
      )
      .trim();
    return {
      id: pack.paperId,
      ...short,
      componentCode: definition.componentCode,
      aliases: [
        pack.paperId,
        definition.displayName,
        short.label,
        ...(named && named !== short.label ? [named] : []),
      ],
    };
  });
}
export function builderFindAssessment(
  i: TemplateIdentity,
  value: string,
): AssessmentOption | null {
  const key = normaliseAssessmentAlias(value);
  if (!key) return null;
  const matches = builderPapers(i).filter((paper) =>
    [paper.id, paper.label, paper.componentCode, ...paper.aliases].some(
      (alias) =>
        normaliseAssessmentAlias(alias) === key ||
        codeKey(alias) === codeKey(value),
    ),
  );
  return matches.length === 1 ? matches[0] : null;
}
export function builderAssessmentKind(i: TemplateIdentity): AssessmentKind {
  const kinds = new Set(builderPapers(i).map((paper) => paper.kind));
  return kinds.size === 1 ? [...kinds][0] : "Assessment";
}
export function builderAssessmentDisplay(i: TemplateIdentity): string {
  const paper = builderFindAssessment(i, i.component);
  if (!paper) return i.component.trim();
  const option = paper.requiredOptions?.find(
    (item) => item.id === i.module || item.label === i.module,
  );
  return paper.label + (option ? ` · ${option.label}` : "");
}
/** Technical overrides are checked against the selected human assessment; they never choose a different paper. */
export function builderValidateComponentCode(
  i: TemplateIdentity,
  selectedId: string,
  code: string,
): string | null {
  const paper = builderFindAssessment(i, selectedId);
  if (!paper || !code.trim()) return null;
  const option = paper.requiredOptions?.find(
    (item) => item.id === i.module || item.label === i.module,
  );
  const allowed = [paper.componentCode, ...(option?.componentCodes ?? [])];
  if (allowed.some((value) => codeKey(value) === codeKey(code))) return null;
  return `This code does not match ${paper.label}. Keep the selected assessment or choose the assessment that matches the code.`;
}

export function builderNeedsTier(i: TemplateIdentity): boolean {
  const course = builderSelectedCourse(i);
  if (course)
    return course.tierMode !== "untiered" && course.tiers.includes("higher");
  return (
    i.qualification === "GCSE" &&
    /^(physics|chemistry|biology|maths|mathematics)$/i.test(i.subject.trim())
  );
}
export function resolveBuilderChoice(
  i: TemplateIdentity,
  mode: ProfileTemplate["mode"],
) {
  if (!i.qualification.trim()) throw Error("Choose your educational level.");
  if (!i.organisation.trim())
    throw Error(
      i.stage === "University"
        ? "Which institution runs your course?"
        : "Which exam board do you study?",
    );
  const courses = builderCourses(i),
    course = builderSelectedCourse(i);
  if (courses.length > 1 && !course)
    throw Error(
      "Choose which course you study; we won’t guess between course variants.",
    );
  if (!i.country.trim())
    throw Error("Which country or education system is your course in?");
  const papers = builderPapers(i);
  const paper = builderFindAssessment(i, i.component);
  if (!i.component.trim() || (papers.length && !paper))
    throw Error("Which paper or assessment are you preparing for?");
  if (builderNeedsTier(i) && !["foundation", "higher"].includes(i.tier ?? ""))
    throw Error("Choose Foundation or Higher.");
  const option = paper?.requiredOptions?.find(
    (value) => value.id === i.module || value.label === i.module,
  );
  if (paper?.requiredOptions?.length && !option)
    throw Error(`Choose the optional topic you study for ${paper.label}.`);
  const tier =
    course?.tierMode === "untiered" || i.qualification === "A-level"
      ? "not_tiered"
      : i.tier;
  const entries = approvalCatalogue().filter(
    (e) =>
      e.course === course?.id &&
      e.paper === paper?.id &&
      e.tier === tier &&
      e.mode === mode &&
      (!i.specificationVersion ||
        e.specificationVersion === i.specificationVersion),
  );
  if (entries.length === 1)
    return {
      identity: templateFromPreset(entries[0].id).template.identity,
      presetId: entries[0].id,
      sourceId: "",
    };
  const source = SOURCE_REGISTRY.find(
    (s) =>
      s.evidence.identity.country ===
        (["UK", "United Kingdom"].includes(i.country) ? "GB" : i.country) &&
      s.evidence.identity.qualification === i.qualification &&
      (!!course || norm(s.evidence.identity.subject) === norm(i.subject)) &&
      (s.evidence.identity.organisation.toLowerCase() ===
        i.organisation.toLowerCase() ||
        course?.boards.includes(
          s.evidence.identity.organisation.toLowerCase(),
        )) &&
      s.evidence.identity.course === (course?.specificationCode ?? i.course) &&
      s.evidence.identity.component === (paper?.componentCode ?? i.component) &&
      (!i.specificationVersion ||
        s.evidence.identity.specificationVersion === i.specificationVersion) &&
      s.evidence.identity.tier === tier,
  );
  if (source)
    return {
      identity: { ...source.evidence.identity },
      presetId: "",
      sourceId: source.id,
    };
  // Human-readable identity is valid for an uploaded brief or explicitly unverified practice.
  // These placeholders claim no official specification version and cannot confer approval.
  return {
    identity: {
      ...i,
      organisation:
        i.stage === "University"
          ? i.organisation.trim()
          : builderBoardLabel(i.organisation),
      educationSystem: i.educationSystem || i.country,
      tier,
      course:
        course?.specificationCode ||
        i.course ||
        `${i.qualification} ${i.subject}`,
      component: paper?.componentCode || i.component.trim(),
      specificationVersion:
        i.specificationVersion ||
        ASSESSMENT_METADATA_COURSES.find((value) => value.id === course?.id)
          ?.specificationVersion ||
        "Not verified",
      ...(option ? { module: option.label } : {}),
    },
    presetId: "",
    sourceId: "",
  };
}
export function builderAssessmentLabel(i: TemplateIdentity): string {
  const course = builderSelectedCourse(i);
  const label = course?.label.replace(/\s*\((?:7402|1BI0|J247|J257)\)/g, "");
  const name = label
    ? /a[- ]level|GCSE/i.test(label)
      ? label
      : `${i.qualification} ${label}`
    : `${i.qualification} ${i.subject}`;
  const organisation =
    i.stage === "University"
      ? i.organisation
      : builderBoardLabel(i.organisation);
  const board = name.toLowerCase().startsWith(organisation.toLowerCase())
    ? ""
    : `${organisation} `;
  const component = builderAssessmentDisplay(i).replace(/_/g, " ");
  return `${board}${name}${component ? " · " + component : ""}${i.tier === "foundation" ? " · Foundation" : i.tier === "higher" ? " · Higher" : ""}`;
}
