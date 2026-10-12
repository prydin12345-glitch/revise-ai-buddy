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
    organisation: c.board ?? "",
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
export function builderCourses(i: TemplateIdentity): CourseCapability[] {
  // A UK level must never be inferred from an international age-band setting.
  if (i.country && !["GB", "UK", "United Kingdom"].includes(i.country))
    return [];
  const level =
    i.qualification === "GCSE"
      ? "level2"
      : i.qualification === "A-level"
        ? "level3"
        : i.qualification;
  return getCourseOptions({
    subject: i.subject,
    examBoard: i.organisation,
    educationalTier: level,
  });
}
export function builderSelectedCourse(
  i: TemplateIdentity,
): CourseCapability | null {
  const options = builderCourses(i);
  if (i.course)
    return (
      options.find(
        (v) => v.id === i.course || v.specificationCode === i.course,
      ) ?? null
    );
  return options.length === 1 ? options[0] : null;
}
export function builderPapers(i: TemplateIdentity) {
  const course = builderSelectedCourse(i);
  return biologyPaperOptions(course?.id).map((pack) => ({
    id: pack.paperId,
    label: pack.definition(i.tier ?? pack.tiers[0]).displayName,
    pack,
  }));
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
  const paper = papers.find(
    (p) =>
      p.id === i.component ||
      p.pack.definition(i.tier ?? p.pack.tiers[0]).componentCode ===
        i.component,
  );
  if (!i.component.trim() || (papers.length && !paper))
    throw Error("Which paper or assessment are you preparing for?");
  if (builderNeedsTier(i) && !["foundation", "higher"].includes(i.tier ?? ""))
    throw Error("Choose Foundation or Higher.");
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
      (s.evidence.identity.organisation.toLowerCase() ===
        i.organisation.toLowerCase() ||
        course?.boards.includes(
          s.evidence.identity.organisation.toLowerCase(),
        )) &&
      s.evidence.identity.course === (course?.specificationCode ?? i.course) &&
      s.evidence.identity.component ===
        (paper?.pack.definition(tier).componentCode ?? i.component) &&
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
      educationSystem: i.educationSystem || i.country,
      tier,
      course: i.course || `${i.qualification} ${i.subject}`,
      specificationVersion: i.specificationVersion || "Not verified",
    },
    presetId: "",
    sourceId: "",
  };
}
export function builderAssessmentLabel(i: TemplateIdentity): string {
  const course = builderSelectedCourse(i),
    paper = builderPapers(i).find(
      (p) =>
        p.id === i.component ||
        p.pack.definition(i.tier ?? p.pack.tiers[0]).componentCode ===
          i.component,
    );
  const label = course?.label.replace(/\s*\((?:7402|1BI0|J247|J257)\)/g, "");
  const name = label
    ? /a[- ]level|GCSE/i.test(label)
      ? label
      : `${i.qualification} ${label}`
    : `${i.qualification} ${i.subject}`;
  const board = name.toLowerCase().startsWith(i.organisation.toLowerCase())
    ? ""
    : `${i.organisation} `;
  const component =
    paper?.label
      .replace(/\s*\([^)]*\)/g, "")
      .match(/(?:Paper|Unit)\s+\d.*$/i)?.[0] ?? i.component.replace(/_/g, " ");
  return `${board}${name}${component ? " · " + component : ""}${i.tier === "foundation" ? " · Foundation" : i.tier === "higher" ? " · Higher" : ""}`;
}
