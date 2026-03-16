/**
 * Board-to-Level mapping and region-aware board filtering.
 * Centralised configuration for exam board / educational level linking.
 */

import { EXAM_BOARD_OPTIONS } from './board-scrubber';

/* ────────────────────────────────────────────
 * Board → Level linking
 * ──────────────────────────────────────────── */

export const BOARD_LEVEL_MAP: Record<string, string[]> = {
  aqa: ['level2_gcse', 'level3_as_level', 'level3_a_level'],
  edexcel: ['level2_gcse', 'level3_as_level', 'level3_a_level', 'level3_btec', 'level4_btec_hnd'],
  ocr: ['level2_gcse', 'level3_as_level', 'level3_a_level', 'level3_cambridge_technical'],
  wjec: ['level2_gcse', 'level3_as_level', 'level3_a_level', 'level3_applied'],
  cie: ['level2_igcse', 'level3_as_level', 'level3_a_level', 'level3_pre_u'],
  ib: ['level2_myp', 'level3_diploma', 'level3_career'],
  college_board: ['level3_ap', 'level3_psat', 'level3_sat', 'level4_clep'],
  cbse: ['level2_class_10', 'level3_class_11', 'level3_class_12'],
  icse: ['level2_class_10', 'level3_class_11', 'level3_class_12'],
  ncea: ['level1_ncea', 'level2_ncea', 'level3_ncea'],
  vce: ['level3_vce_units_1_2', 'level3_vce_units_3_4'],
  hsc: ['level3_hsc_preliminary', 'level3_hsc_hsc_year'],
  leaving_cert: ['level2_junior_cert', 'level3_leaving_cert_ordinary', 'level3_leaving_cert_higher'],
};

export const LEVEL_DISPLAY_NAMES: Record<string, string> = {
  level2_gcse: 'GCSE',
  level3_as_level: 'AS-Level',
  level3_a_level: 'A-Level',
  level3_btec: 'BTEC Level 3',
  level4_btec_hnd: 'BTEC HND / Level 4',
  level3_cambridge_technical: 'Cambridge Technical',
  level3_applied: 'Applied Certificate',
  level2_igcse: 'IGCSE',
  level3_pre_u: 'Cambridge Pre-U',
  level2_myp: 'IB Middle Years (MYP)',
  level3_diploma: 'IB Diploma',
  level3_career: 'IB Career Programme',
  level3_ap: 'AP (Advanced Placement)',
  level3_psat: 'PSAT / NMSQT',
  level3_sat: 'SAT',
  level4_clep: 'CLEP (College Level)',
  level2_class_10: 'Class 10 (Board Exam)',
  level3_class_11: 'Class 11',
  level3_class_12: 'Class 12 (Board Exam)',
  level1_ncea: 'NCEA Level 1',
  level2_ncea: 'NCEA Level 2',
  level3_ncea: 'NCEA Level 3',
  level3_vce_units_1_2: 'VCE Units 1 & 2',
  level3_vce_units_3_4: 'VCE Units 3 & 4',
  level3_hsc_preliminary: 'HSC Preliminary',
  level3_hsc_hsc_year: 'HSC Year',
  level2_junior_cert: 'Junior Certificate',
  level3_leaving_cert_ordinary: 'Leaving Certificate (Ordinary)',
  level3_leaving_cert_higher: 'Leaving Certificate (Higher)',
};

/* ────────────────────────────────────────────
 * Region → Board filtering
 * ──────────────────────────────────────────── */

export function getRegionBoards(region: string | null | undefined) {
  const r = (region ?? '').toLowerCase();

  if (r.includes('gb') || r.includes('uk'))
    return EXAM_BOARD_OPTIONS.filter(b => ['aqa', 'edexcel', 'ocr', 'wjec', 'cie', 'ib', 'other'].includes(b.id));
  if (r.includes('us') || r.includes('united states'))
    return EXAM_BOARD_OPTIONS.filter(b => ['college_board', 'ib', 'other'].includes(b.id));
  if (r.includes('in') || r.includes('india'))
    return EXAM_BOARD_OPTIONS.filter(b => ['cbse', 'icse', 'ib', 'other'].includes(b.id));
  if (r.includes('au') || r.includes('australia'))
    return EXAM_BOARD_OPTIONS.filter(b => ['vce', 'hsc', 'ib', 'other'].includes(b.id));
  if (r.includes('ie') || r.includes('ireland'))
    return EXAM_BOARD_OPTIONS.filter(b => ['leaving_cert', 'ib', 'other'].includes(b.id));
  if (r.includes('nz') || r.includes('new zealand'))
    return EXAM_BOARD_OPTIONS.filter(b => ['ncea', 'ib', 'other'].includes(b.id));

  // International / unknown — show all
  return EXAM_BOARD_OPTIONS;
}

/** Get available levels for a specific board, or all levels if no board specified */
export function getLevelsForBoard(boardId: string | null | undefined): { id: string; label: string }[] {
  if (!boardId || boardId === 'other') {
    return Object.entries(LEVEL_DISPLAY_NAMES).map(([id, label]) => ({ id, label }));
  }
  const levelIds = BOARD_LEVEL_MAP[boardId] ?? [];
  return levelIds.map(id => ({ id, label: LEVEL_DISPLAY_NAMES[id] ?? id }));
}

/* ────────────────────────────────────────────
 * Board-specific mark scheme language
 * ──────────────────────────────────────────── */

export function getBoardMarkSchemeStyle(boardId: string): string {
  const styles: Record<string, string> = {
    aqa: `Mark scheme format: Use AQA-style mark schemes.
- Use "Allow" for acceptable alternative answers
- Use "Accept" for equivalent responses
- Use "Do not accept" for common wrong answers
- Award marks as B1 (independent), M1 (method), A1 (accuracy)
- For longer answers use "marking points" with max mark cap`,

    edexcel: `Mark scheme format: Use Pearson Edexcel-style mark schemes.
- Use "Award 1 mark for..." format
- Use "eg" for acceptable examples
- Progressive marking — later marks depend on earlier method marks
- Use QWC (Quality of Written Communication) for 6-mark questions`,

    ocr: `Mark scheme format: Use OCR-style mark schemes.
- Use "Credit any sensible answer that..."
- Use AO1/AO2/AO3 assessment objective labelling
- Level of response marking for extended answers (Level 1/2/3)
- Include "Indicative content" for open-ended questions`,

    ib: `Mark scheme format: Use IB-style mark schemes.
- Use assessment criteria bands (A/B/C/D) for IA
- Award marks with slash notation: "1/1" or "0/1"
- Include "Award [1] for..." format
- For extended response use Level descriptors not point marking`,

    college_board: `Mark scheme format: Use College Board AP-style rubrics.
- MCQ: 1 point each, no partial credit
- FRQ: Point-based rubric with specific earning criteria
- Use "Acceptable" and "Not acceptable" for alternatives
- Include "Scoring Note" for common variations`,

    cbse: `Mark scheme format: Use CBSE-style mark schemes.
- Use step marking with each step awarded independently
- Include "Value Points" for each mark
- Use "Any other relevant answer" for open questions`,

    icse: `Mark scheme format: Use ICSE-style mark schemes.
- Use detailed step-by-step marking
- Include alternative methods with full marks
- Mark for concept, formula, substitution, and answer separately`,

    wjec: `Mark scheme format: Use WJEC-style mark schemes.
- Use B/M/A marking notation
- Include "Credit" for acceptable alternatives
- Use indicative content for extended responses`,

    cie: `Mark scheme format: Use Cambridge International-style mark schemes.
- Use M1/A1/B1 notation
- Include "or equivalent" for alternative approaches  
- Award marks with [1] notation in square brackets`,
  };

  return styles[boardId] ?? 'Use clear mark scheme with numbered points, one mark per point.';
}
