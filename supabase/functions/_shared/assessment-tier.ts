// Shared catalogue for the frontend and Deno runtime. Custom names are display
// labels; the explicit board and qualification determine the supported course.
// An absent tier remains unknown. Subject names never select a tier themselves.

export type AssessmentTier = "foundation" | "higher" | "not_tiered";
import type { CurriculumIdentity } from './curriculum-identity.ts';

export const ASSESSMENT_TIER_VALUES: AssessmentTier[] = [
  "foundation",
  "higher",
  "not_tiered",
];

export const ASSESSMENT_TIER_LABELS: Record<AssessmentTier, string> = {
  foundation: "Foundation",
  higher: "Higher",
  not_tiered: "Not tiered",
};

const GCSE_LEVEL_IDS = [
  "level2",
  "level2_gcse",
  "gcse",
  "gcse_9_1",
  "ks4",
  "secondary_14_16",
  "level 2",
];

export interface CourseCapability {
  id: string;
  label: string;
  subjects: string[];
  boards: string[];
  levels: string[];
  tiers: AssessmentTier[];
  specificationCode?: string;
  generationAvailable?: boolean;
  tierMode?: 'tiered' | 'untiered';
  curriculum?: CurriculumIdentity;
  requiresPaperSelection?: boolean;
}

export const OCR_GATEWAY_BIOLOGY_ID = 'ocr_gcse_biology_a_j247';
export const OCR_21C_BIOLOGY_ID = 'ocr_gcse_biology_b_j257';
export const EDEXCEL_BIOLOGY_ID = 'edexcel_gcse_biology_1bi0';
export const WJEC_BIOLOGY_ID = 'wjec_gcse_biology_wales_3400';
export const AQA_ALEVEL_BIOLOGY_ID = 'aqa_alevel_biology_7402';
export const OCR_ALEVEL_BIOLOGY_ID = 'ocr_alevel_biology_a_h420';
export const OCR_ALEVEL_BIOLOGY_B_ID = 'ocr_alevel_biology_b_h422';
const OCR_ALEVEL_NAMES = ['biology', 'biology a', 'biology b', 'advancing biology', 'advancing biology b', 'biology (single science)'];
const OCR_BIOLOGY_NAMES = ['biology', 'biology a', 'biology b', 'gateway biology', 'gateway biology a', 'biology (single science)', 'twenty first century biology', 'twenty first century biology b'];

export const COURSE_CAPABILITIES: CourseCapability[] = [
  ...[
    {id:OCR_ALEVEL_BIOLOGY_ID,label:'Biology A',specificationCode:'H420',generationAvailable:true},
    {id:OCR_ALEVEL_BIOLOGY_B_ID,label:'Advancing Biology B',specificationCode:'H422',generationAvailable:false},
  ].map(course=>({...course,subjects:OCR_ALEVEL_NAMES,boards:['ocr','cambridge ocr'],
    levels:['level3','level3_a_level','a-level','a level','alevel','a_level'],
    tiers:['not_tiered'] as AssessmentTier[],tierMode:'untiered' as const,requiresPaperSelection:true,
    curriculum:{country:'GB',jurisdiction:'England',qualification:'A-level',subject:'Biology'}})),
  {id:AQA_ALEVEL_BIOLOGY_ID,label:'AQA A-level Biology (7402)',subjects:['biology','biology (single science)'],
    boards:['aqa'],levels:['level3','level3_a_level','a-level','a level','alevel','a_level'],
    tiers:['not_tiered'],tierMode:'untiered',specificationCode:'7402',generationAvailable:true,requiresPaperSelection:true,
    curriculum:{country:'GB',jurisdiction:'England',qualification:'A-level',subject:'Biology'}},
  {id:WJEC_BIOLOGY_ID,label:'WJEC GCSE Biology — Wales',subjects:['biology','gcse biology','biology (single science)'],
    boards:['wjec','wjec wales','wjec (wales)'],levels:GCSE_LEVEL_IDS,tiers:['foundation','higher'],specificationCode:'3400QS',generationAvailable:true},
  {
    id: "aqa_gcse_biology",
    label: "AQA GCSE Biology",
    subjects: ["biology", "gcse biology", "biology (single science)"],
    boards: ["aqa"],
    levels: GCSE_LEVEL_IDS,
    tiers: ["foundation", "higher"],
    specificationCode: '8461',
  },
  {
    id: EDEXCEL_BIOLOGY_ID,
    label: 'Pearson Edexcel GCSE Biology (1BI0)',
    subjects: ['biology', 'gcse biology', 'biology (single science)'],
    boards: ['edexcel', 'pearson edexcel'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: '1BI0',
  },
  {
    id: OCR_GATEWAY_BIOLOGY_ID,
    label: 'OCR Gateway Biology A (J247)',
    subjects: OCR_BIOLOGY_NAMES,
    boards: ['ocr', 'cambridge ocr'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: 'J247',
  },
  {
    id: OCR_21C_BIOLOGY_ID,
    label: 'OCR Twenty First Century Biology B (J257)',
    subjects: OCR_BIOLOGY_NAMES,
    boards: ['ocr', 'cambridge ocr'],
    levels: GCSE_LEVEL_IDS,
    tiers: ['foundation', 'higher'],
    specificationCode: 'J257',
    generationAvailable: true,
  },
];

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

const DECORATION = /\b(aqa|pearson|edexcel|cambridge|ocr|wjec|eduqas|wales|gcse|igcse|a[-\s]?level|7402|h420|h422|ks4|j247|j257|1bi0|3400qs|unit\s*\d+|paper\s*\d+|higher|foundation|tier|hl|sl)\b/g;

const subjectForms = (value?: string | null): string[] => {
  const base = norm(value);
  if (!base) return [];
  const stripped = base
    .replace(DECORATION, " ")
    .replace(/\(\s*\)|\[\s*\]/g, " ")
    .replace(/[–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped && stripped !== base ? [base, stripped] : [base];
};

export interface CourseLookup {
  subject?: string | null;
  examBoard?: string | null;
  educationalTier?: string | null;
  /** A subject label never chooses between OCR's two Biology qualifications. */
  courseId?: string | null;
}

export const canonicalCourseId = (value?: string | null): string | null => {
  const id = norm(value);
  // Preserve historical AQA snapshot ids and its existing paper-contract id.
  return id === 'aqa_gcse_biology_8461' ? 'aqa_gcse_biology' : id || null;
};

export const getCourseOptions = (
  lookup: CourseLookup,
): CourseCapability[] => {
  const subjects = subjectForms(lookup.subject);
  const board = norm(lookup.examBoard);
  const level = norm(lookup.educationalTier);
  if (subjects.length === 0 || !board || !level) return [];
  return COURSE_CAPABILITIES.filter(
      (c) =>
        subjects.some((s) => c.subjects.includes(s)) &&
        c.boards.includes(board) &&
        c.levels.includes(level),
    );
};

export const getCourseCapability = (lookup: CourseLookup): CourseCapability | null => {
  const options = getCourseOptions(lookup);
  const selected = canonicalCourseId(lookup.courseId);
  if (selected) return options.find(c => c.id === selected) ?? null;
  return options.length === 1 ? options[0] : null;
};

export const supportsAssessmentTier = (lookup: CourseLookup): boolean =>
  getAssessmentTierOptions(lookup).length > 0;

export const getAssessmentTierOptions = (
  lookup: CourseLookup,
): AssessmentTier[] => {
  const course = getCourseCapability(lookup);
  return course?.tierMode === 'untiered' ? [] : course?.tiers ?? [];
};

/** Known untiered courses are explicit, unlike an unknown legacy tier. */
export function resolveCourseAssessmentTier(value: string|null|undefined, lookup: CourseLookup): AssessmentTier|null {
  const course = getCourseCapability(lookup);
  if(course?.tierMode === 'untiered') {
    if(!isUnknownAssessmentTier(value) && normaliseAssessmentTier(value)!=='not_tiered')
      throw new Error('This course is untiered; Foundation and Higher do not apply.');
    return 'not_tiered';
  }
  return supportsAssessmentTier(lookup) ? normaliseAssessmentTier(value) : null;
}

export const normaliseAssessmentTier = (
  value?: string | null,
): AssessmentTier | null => {
  const v = norm(value);
  return (ASSESSMENT_TIER_VALUES as string[]).includes(v)
    ? (v as AssessmentTier)
    : null;
};

/** True only for genuinely absent values — the legacy "not recorded" state. */
export const isUnknownAssessmentTier = (value?: string | null): boolean =>
  value === null || value === undefined || value.trim() === "";

/**
 * Absent (null / empty) is valid legacy "unknown". An explicit but
 * unrecognised string is REJECTED rather than silently downgraded.
 */
export const isValidAssessmentTierFor = (
  value: string | null | undefined,
  lookup: CourseLookup,
): boolean => {
  if (isUnknownAssessmentTier(value)) return true;
  const tier = normaliseAssessmentTier(value);
  if (tier === null) return false;
  return (getCourseCapability(lookup)?.tiers ?? []).includes(tier);
};

export const formatAssessmentTier = (value?: string | null): string | null => {
  const tier = normaliseAssessmentTier(value);
  return tier ? ASSESSMENT_TIER_LABELS[tier] : null;
};
