import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart, ResourceKind } from './paper-contract-types.ts';

// OCR J247 v4.0 (August 2026), section 3a. Section A/B totals are official;
// our particular Section B groups are a versioned Examly practice template.
export const OCR_GATEWAY_PAPER = {
  courseId: OCR_GATEWAY_BIOLOGY_ID,
  paperId: 'first_paper',
  contractVersion: 1,
  topics: ['B1: Cell level systems', 'B2: Scaling up', 'B3: Organism level systems'],
  fullMockMarks: 90,
  fullMockMinutes: 105,
} as const;

export const gatewayComponent = (tier: PaperPlan['tier']): string | null =>
  tier === 'foundation' ? 'J247/01' : tier === 'higher' ? 'J247/03' : null;

export function buildGatewayPlan(mode: PaperMode, tier: PaperPlan['tier']): PaperPlan | null {
  if (mode === 'custom') return null;
  if (!tier) throw new Error('Choose Foundation or Higher before selecting an OCR paper.');
  if (mode !== 'full_mock' && mode !== 'short_practice') throw new Error('Unknown OCR paper mode.');
  const high = tier === 'higher';
  const parts: PlannedPart[] = [];
  const add = (number: string, topic: number, marks: number, demand: PlannedPart['demand'],
    specRefs: string[], resource: ResourceKind = 'none', mathsMarks = 0, practicalMarks = 0) => {
    const parent = number.match(/^\d+/)![0];
    parts.push({partId: `ocr_${number}`, parentId: `q${parent}`, questionNumber: number,
      topic: OCR_GATEWAY_PAPER.topics[topic - 1], marks, demand, resource,
      resourceId: resource === 'none' ? undefined : `ocr_r_${number}`,
      responseType: marks === 6 ? 'long_form' : 'short_answer', section: 'B',
      specRefs, mathsMarks, practicalMarks});
  };
  const mcqs = mode === 'full_mock' ? 15 : 3;
  const mcqRefs = ['B1.1b', 'B1.2a', 'B1.3b', 'B1.4a', 'B1.2g', 'B2.1a', 'B2.1b',
    'B2.1d', 'B2.2e', 'B2.2g', 'B3.1a', 'B3.1f', 'B3.2a', 'B3.2h', 'B3.3a'];
  for (let i = 0; i < mcqs; i++) {
    const t = mode === 'full_mock' ? Math.floor(i / 5) : i;
    parts.push({partId: `ocr_${i + 1}`, parentId: `q${i + 1}`, questionNumber: String(i + 1),
      topic: OCR_GATEWAY_PAPER.topics[t], marks: 1, responseType: 'mcq_single',
      demand: mode === 'full_mock' && i % 5 === 4 ? 'AO2' : 'AO1', resource: 'none',
      section: 'A', specRefs: [mcqRefs[mode === 'full_mock' ? i : i * 5]]});
  }
  if (mode === 'short_practice') {
    add('4(a)', 1, 3, 'AO2', ['B1.1a'], 'data_table', 3, 0);
    add('4(b)', 1, 3, 'AO3', ['B1.2f'], 'graph', 0, 3);
    add('5(a)', 2, 3, 'AO2', ['B2.1a'], 'data_table', 3, 3);
    add('5(b)', 2, 2, 'AO1', ['B2.2c']);
    add('6', 3, 6, 'AO3', high ? ['B3.3d', 'B3.3i'] : ['B3.3a', 'B3.3b']);
  } else {
    add('16(a)', 1, 2, 'AO1', ['B1.1b']);
    add('16(b)', 1, 3, 'AO2', ['B1.1a', high ? 'BM1.1iii' : 'BM1.1i'], 'data_table', 3);
    add('16(c)', 1, 3, 'AO3', ['B1.1a'], 'none', 0, 3);
    add('17(a)', 1, 2, 'AO1', ['B1.2g']);
    add('17(b)', 1, 3, 'AO2', ['B1.2f'], 'graph', 0, 3);
    add('17(c)', 1, 3, 'AO3', ['B1.2f'], 'none', 0, 3);
    add('18(a)', 1, 2, 'AO1', ['B1.2a', 'B1.2c']);
    add('18(b)', 1, 2, 'AO1', ['B1.3a']);
    add('18(c)', 1, 4, 'AO2', high ? ['B1.2d', 'B1.2e'] : ['B1.3c', 'B1.3d']);
    add('19(a)', 1, 2, 'AO1', ['B1.4b']);
    add('19(b)', 1, 3, 'AO2', ['B1.4e'], 'graph', 0, 3);
    add('19(c)', 1, 3, 'AO3', high ? ['B1.4f'] : ['B1.4d'], 'none', 0, 3);
    add('20(a)', 2, 2, 'AO1', ['B2.1b']);
    add('20(b)', 2, 4, 'AO2', ['B2.1a', 'BM2.1i'], 'data_table', 4, 4);
    add('20(c)', 2, 3, 'AO3', ['B2.1a'], 'none', 0, 3);
    add('21(a)', 2, 2, 'AO1', ['B2.2c']);
    add('21(b)', 2, 3, 'AO1', ['B2.2f', 'B2.2h']);
    add('21(c)', 2, 3, 'AO2', ['B2.2i'], 'data_table');
    add('22(a)', 3, 2, 'AO1', ['B3.1a']);
    add('22(b)', 3, 3, 'AO2', ['B3.1c'], 'data_table', 3, 3);
    add('22(c)', 3, 3, 'AO1', high ? ['B3.1g'] : ['B3.1d', 'B3.1f']);
    add('23(a)', 3, 2, 'AO1', ['B3.2c']);
    add('23(b)', 3, 2, 'AO2', ['B3.2g'], 'graph');
    add('23(c)', 3, 4, 'AO2', high ? ['B3.2d', 'B3.2f'] : ['B3.2e', 'B3.2h']);
    add('24(a)', 3, 4, 'AO2', high ? ['B3.3d', 'B3.3i'] : ['B3.3c', 'B3.3e'], 'data_table');
    add('24(b)', 3, 6, 'AO3', high ? ['B3.3j'] : ['B3.3a', 'B3.3b', 'B3.3g']);
  }
  const totalMarks = parts.reduce((n, p) => n + p.marks, 0);
  const plan: PaperPlan = {courseId: OCR_GATEWAY_PAPER.courseId, paperId: OCR_GATEWAY_PAPER.paperId,
    componentCode: gatewayComponent(tier)!, contractVersion: OCR_GATEWAY_PAPER.contractVersion,
    tier, mode, parts, parentCount: new Set(parts.map(p => p.parentId)).size, partCount: parts.length,
    totalMarks, durationMinutes: mode === 'full_mock' ? 105 : 25,
    label: `OCR Gateway Biology A ${high ? 'Paper 3' : 'Paper 1'} ${mode === 'full_mock' ? 'full mock' : 'short practice'}`};
  if (mode === 'full_mock' && totalMarks !== 90) throw new Error('Invalid OCR mark allocation.');
  return plan;
}
