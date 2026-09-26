// WJEC separate Biology Wales, not Eduqas or The Sciences Double Award.
// Awarding-body edition and Examly template version are separate identities.
export const WJEC_BIOLOGY_SPECIFICATION = 'wjec-3400-v3-2026-02';
export const WJEC_BIOLOGY_SPEC_URL = 'https://www.wjec.co.uk/media/m1lm4qb5/wjec-gcse-biology-from-2016-spec.pdf';
export const WJEC_BIOLOGY_LEGACY_SPEC_URL = 'https://www.wjec.co.uk/media/aaslc0sm/wjec-gcse-biology-spec-from-2016-e.pdf';
export const WJEC_WRITTEN_UNITS = {
  unit_1: {title:'Cells, Organ Systems and Ecosystems',foundation:'3400U1',higher:'3400UA'},
  unit_2: {title:'Variation, Homeostasis and Micro-organisms',foundation:'3400U2',higher:'3400UB'},
} as const;
export type WjecBiologyUnit = keyof typeof WJEC_WRITTEN_UNITS;
export const WJEC_GRADE_RANGES = {foundation:'C–G',higher:'A*–D'} as const;
export const WJEC_UNIT3_VERSIONS = {
  before_september_2026: {specificationVersion:'wjec-3400-v2-2019-01',title:'Practical Assessment',marks:30,
    qualificationWeight:10,assessmentTier:'not_tiered',componentCode:'3400U3',source:WJEC_BIOLOGY_LEGACY_SPEC_URL,generationAvailable:false},
  from_september_2026: {specificationVersion:WJEC_BIOLOGY_SPECIFICATION,title:'Scientific Enquiry',marks:28,
    qualificationWeight:10,assessmentTier:'not_tiered',componentCode:'3400U3',firstTeaching:'2026-09',firstAward:2028,
    practicalMarks:6,writtenMarks:22,practicalMinutes:60,writtenMinutes:60,enquiriesToChoose:2,enquiriesToComplete:1,
    source:WJEC_BIOLOGY_SPEC_URL,generationAvailable:false},
} as const;
/** Requires an explicit cohort period; never infer the cohort from today's date. */
export function wjecUnit3ForCohort(cohort: keyof typeof WJEC_UNIT3_VERSIONS | null | undefined) {
  return cohort ? WJEC_UNIT3_VERSIONS[cohort] ?? null : null;
}
export const isWjecWrittenUnit = (value:unknown):value is WjecBiologyUnit => value==='unit_1'||value==='unit_2';
