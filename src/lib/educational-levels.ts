/**
 * Universal educational level definitions with regional aliases.
 */

export interface EducationalLevel {
  id: string;
  label: string;
  aliases: Partial<Record<string, string>>;
}

export interface EducationalLevelGroup {
  group: string;
  levels: EducationalLevel[];
}

export const EDUCATIONAL_LEVELS: EducationalLevelGroup[] = [
  {
    group: 'SCHOOL',
    levels: [
      {
        id: 'level1',
        label: 'Level 1 (Age 11–14)',
        aliases: { UK: 'KS3', USA: 'Middle School (Gr 6-8)', IB: 'MYP 1-3', AU: 'Year 7-9' },
      },
      {
        id: 'level2',
        label: 'Level 2 (Age 14–16)',
        aliases: { UK: 'GCSE', USA: 'High School (Gr 9-10)', IB: 'MYP 4-5 / IGCSE', AU: 'Year 10-11' },
      },
      {
        id: 'level3',
        label: 'Level 3 (Age 16–18)',
        aliases: { UK: 'A-Level', USA: 'High School / AP (Gr 11-12)', IB: 'IB Diploma', AU: 'Year 12 / HSC' },
      },
    ],
  },
  {
    group: 'HIGHER EDUCATION',
    levels: [
      {
        id: 'undergrad',
        label: "Undergraduate / Bachelor's",
        aliases: { UK: 'University Degree', USA: 'College (4-year)', IB: 'University', AU: 'University' },
      },
      {
        id: 'postgrad',
        label: "Postgraduate / Master's",
        aliases: { UK: 'Masters / MSc', USA: 'Graduate School', IB: 'Postgraduate', AU: 'Postgraduate' },
      },
      {
        id: 'doctoral',
        label: 'Doctoral / PhD',
        aliases: { UK: 'PhD / DPhil', USA: 'PhD', IB: 'Doctoral', AU: 'PhD' },
      },
    ],
  },
  {
    group: 'PROFESSIONAL & VOCATIONAL',
    levels: [
      {
        id: 'vocational_entry',
        label: 'Vocational — Entry Level',
        aliases: { UK: 'Level 2 NVQ / Apprenticeship', USA: 'Certificate I-II', AU: 'Certificate I-II' },
      },
      {
        id: 'vocational_advanced',
        label: 'Vocational — Advanced',
        aliases: { UK: 'Level 3-4 NVQ / HNC', USA: "Certificate III-IV / Associate's", AU: 'Certificate III-IV / Diploma' },
      },
      {
        id: 'professional_cert',
        label: 'Professional Certification',
        aliases: { UK: 'Professional Qualification', USA: 'Professional License / Cert', AU: 'Professional Cert' },
      },
      {
        id: 'cpd',
        label: 'CPD / Continuing Professional Development',
        aliases: { UK: 'CPD', USA: 'CEU / Professional Development', AU: 'CPD' },
      },
    ],
  },
  {
    group: 'OTHER',
    levels: [
      {
        id: 'other',
        label: 'Other — specify below',
        aliases: {},
      },
    ],
  },
];

/** All level definitions flat */
export const ALL_LEVELS = EDUCATIONAL_LEVELS.flatMap(g => g.levels);

/** Detect user region key from curriculum_region string */
export function detectRegionKey(curriculumRegion: string | null | undefined): string | null {
  if (!curriculumRegion) return null;
  const r = curriculumRegion.toLowerCase();
  if (r.includes('uk') || r.includes('gb') || r.includes('united kingdom')) return 'UK';
  if (r.includes('us') || r.includes('usa') || r.includes('united states')) return 'USA';
  if (r.includes('ib') || r.includes('international')) return 'IB';
  if (r.includes('au') || r.includes('australia')) return 'AU';
  return null;
}

/** Check if a tier ID is a known universal level */
export function isKnownLevel(tierId: string): boolean {
  return ALL_LEVELS.some(l => l.id === tierId);
}
