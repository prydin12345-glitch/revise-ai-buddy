import { canonicalCourseId } from './assessment-tier.ts';
import { AQA_BIOLOGY_P1, BIOLOGY_CONTRACT_VERSION, buildAqaPlan, aqaPlanInstructions } from './aqa-biology-contract.ts';
import { OCR_GATEWAY_PAPER, buildGatewayPlan, gatewayComponent } from './ocr-biology-contract.ts';
import { gatewayPartInstruction, gatewayPlanInstructions, GATEWAY_RULES } from './ocr-biology-scope.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { AQA_BIOLOGY_P2, aqaPaper2Component, buildAqaPaper2Plan, aqaPaper2Instructions, aqaPaper2PartInstruction, AQA_P2_RULES } from './aqa-biology-paper2.ts';
import { EDEXCEL_BIOLOGY_ID, OCR_21C_BIOLOGY_ID } from './assessment-tier.ts';
import { edexcelBiologyDefinition, buildEdexcelBiologyPlan, edexcelBiologyInstructions,
  edexcelBiologyPartInstruction, assertEdexcelBiologyPlan } from './edexcel-biology-contract.ts';
import { edexcelBiologyRules, type EdexcelBiologyPaper } from './edexcel-biology-scope.ts';

import {ocr21cDefinition, buildOcr21cPlan, ocr21cInstructions, ocr21cPartInstruction, assertOcr21cPlan} from './ocr21c-biology-contract.ts';
import {ocr21cBiologyRules, type Ocr21cPaper} from './ocr21c-biology-scope.ts';

export interface BiologyPaperDefinition {
  courseId: string;
  paperId: string;
  contractVersion: number;
  displayName: string;
  topics: readonly string[];
  fullMockMarks: number;
  fullMockMinutes: number;
  componentCode: string | null;
}

export interface BiologyPaperPack {
  /** Stable internal identity. Never inferred from a student's subject label. */
  id: string;
  courseId: string;
  paperId: string;
  contractVersion: number;
  curriculum: { country: 'GB'; jurisdiction: 'England'; qualification: 'GCSE'; subject: 'Biology' };
  examBoard: string;
  tiers: readonly ['foundation', 'higher'];
  sources: readonly { url: string; section: string; checkedOn: string }[];
  official: { fullMarks: number; durationMinutes: number; sections?: readonly { id: 'A' | 'B'; marks: number }[] };
  /** Separate each board's official structure from our subpart/topic choices. */
  layoutChoices: readonly string[];
  validation: { rows: 'legacy_totals' | 'exact_parts'; mcqOptions: number; levelSchemeAtMarks: number | null };
  /** Retain the proven AQA path while other adapters are migrated separately. */
  generation: { strategy: 'augment_existing' | 'contract_only'; systemPrompt?: string };
  /** Board/paper scope rules, repeated in every batch request of this paper. */
  rules?: string;
  definition: (tier: PaperPlan['tier']) => BiologyPaperDefinition;
  build: (mode: PaperMode, tier: PaperPlan['tier']) => PaperPlan | null;
  instructions: (plan: PaperPlan) => string;
  repairPartInstructions?: (part: PlannedPart, includeOptions: boolean) => string;
  validatePlan?: (plan: PaperPlan) => void;
}

const curriculum = { country: 'GB', jurisdiction: 'England', qualification: 'GCSE', subject: 'Biology' } as const;

const edexcelPack = (paper: EdexcelBiologyPaper): BiologyPaperPack => ({
  id: `edexcel-1bi0-${paper.replace('_', '-')}-v1`, courseId: EDEXCEL_BIOLOGY_ID, paperId: paper,
  contractVersion: 1, curriculum, examBoard: 'Pearson Edexcel', tiers: ['foundation', 'higher'],
  sources: [
    {url: 'https://qualifications.pearson.com/content/dam/pdf/GCSE/Science/2016/Specification/gcse-biology-spec.pdf',
      section: 'Issue 4 (March 2024): qualification overview, subject content (bold Higher content), assessment information', checkedOn: '2026-09-24'},
    {url: 'https://qualifications.pearson.com/content/dam/pdf/GCSE/Science/2016/Specification/SAMs_GCSE_L1-L2_in_Biology.pdf',
      section: 'Sample assessment materials, Issue 1: both tiers, papers and marking guidance', checkedOn: '2026-09-24'},
    {url: 'https://www.gov.uk/government/publications/gcse-9-to-1-subject-level-conditions-and-requirements-for-single-science',
      section: 'Assessment requirements: mathematical and practical skills across the qualification', checkedOn: '2026-09-25'},
  ],
  official: {fullMarks: 100, durationMinutes: 105},
  layoutChoices: ['Pearson specifies ten parent questions; 40 parts, eight MCQs and three six-mark responses are Examly choices.',
    'AO marks 40/40/20, maths/practical marks and 27 common-tier demand marks are template targets, not certification of generated content.',
    'Separately generated tier papers do not contain the 27 identical overlap marks of an official paired set.',
    'Short practice covers five topic areas with ten parts, 25 marks and 26 minutes; it is not a full paper.'],
  validation: {rows: 'exact_parts', mcqOptions: 4, levelSchemeAtMarks: 6},
  rules: edexcelBiologyRules(paper),
  generation: {strategy: 'contract_only', systemPrompt: 'Write an original Pearson Edexcel GCSE separate Biology 1BI0 paper using the supplied saved paper, tier, immutable part plan and Edexcel specification outcomes. Do not import AQA/OCR content exclusions or an OCR Section A. Return complete JSON with canonical resources and private marking schemes.'},
  definition: tier => edexcelBiologyDefinition(paper, tier),
  build: (mode, tier) => buildEdexcelBiologyPlan(paper, mode, tier),
  instructions: edexcelBiologyInstructions, repairPartInstructions: edexcelBiologyPartInstruction,
  validatePlan: assertEdexcelBiologyPlan,
});

const ocr21cPack = (paper: Ocr21cPaper): BiologyPaperPack => ({
  id:`ocr-j257-${paper}-v1`, courseId:OCR_21C_BIOLOGY_ID, paperId:paper, contractVersion:1,
  curriculum, examBoard:'OCR', tiers:['foundation','higher'],
  sources:[
    {url:'https://www.ocr.org.uk/Images/234595-specification-accredited-gcse-twenty-first-century-science-suite-biology-b-j257.pdf',
      section:'Version 4.0 (August 2026), sections 2a/2c and 3a/3b; bold Higher-only content',checkedOn:'2026-09-25'},
    {url:'https://www.ocr.org.uk/Images/462607-exploring-our-question-papers-twenty-first-century-science.pdf',
      section:'Assessment approach: Breadth short tasks (maximum four marks), Depth level responses, interspersed MCQs',checkedOn:'2026-09-25'},
    {url:'https://www.ocr.org.uk/qualifications/gcse/twenty-first-century-science-suite-biology-b-j257-from-2016/assessment/',
      section:'J257/01-04 sample question papers and mark schemes',checkedOn:'2026-09-25'},
  ],
  official:{fullMarks:90,durationMinutes:105},
  layoutChoices:[
    'Both papers assess B1-B6 with B7/B8 embedded. There is no Gateway-style MCQ section.',
    'Breadth: 15 groups, 45 parts and six MCQs. Depth: nine groups, 36 parts, three MCQs and two six-mark responses. These are Examly choices, not fixed OCR counts.',
    'Whole-mark AO targets are Breadth 43/33/14 and Depth 29/39/22; together 72/72/36. They approximate OCR component proportions and do not certify generated demand.',
    'Short practice samples six chapters in 12 parts: Breadth 24 marks/28 minutes; Depth 30 marks/35 minutes. Independently generated tier papers do not promise identical overlap questions.',
  ],
  validation:{rows:'exact_parts',mcqOptions:4,levelSchemeAtMarks:paper==='depth'?6:null},
  rules:ocr21cBiologyRules(paper),
  generation:{strategy:'contract_only',systemPrompt:'Write an original OCR Twenty First Century GCSE Biology B J257 paper at the saved tier and Breadth/Depth component. Follow the immutable plan and reviewed J257 outcomes. Use complete assessed tasks, consistent resources and private answer keys. Return valid JSON only.'},
  definition:tier=>ocr21cDefinition(paper,tier), build:(mode,tier)=>buildOcr21cPlan(paper,mode,tier),
  instructions:ocr21cInstructions, repairPartInstructions:ocr21cPartInstruction, validatePlan:assertOcr21cPlan,
});

/** Register only implemented paper versions. A catalogue entry alone never enables generation. */
export const BIOLOGY_PAPER_PACKS: readonly BiologyPaperPack[] = [
  {
    id: 'aqa-8461-paper-1-v1', courseId: AQA_BIOLOGY_P1.courseId, paperId: AQA_BIOLOGY_P1.paperId,
    contractVersion: BIOLOGY_CONTRACT_VERSION, curriculum, examBoard: 'AQA', tiers: ['foundation', 'higher'],
    sources: [{ url: 'https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/specification-at-a-glance', section: '2.2 Assessments, Paper 1', checkedOn: '2026-09-18' }],
    official: { fullMarks: 100, durationMinutes: 105 },
    layoutChoices: ['Four topic groups of 25 marks are Examly choices.', 'The eight MCQs, 32 scored parts and selected resources belong to template v1.'],
    validation: { rows: 'legacy_totals', mcqOptions: 4, levelSchemeAtMarks: null },
    generation: { strategy: 'augment_existing' },
    definition: () => ({ ...AQA_BIOLOGY_P1, contractVersion: BIOLOGY_CONTRACT_VERSION, componentCode: null }),
    build: buildAqaPlan, instructions: aqaPlanInstructions,
  },
  {
    id: 'ocr-j247-first-paper-v1', courseId: OCR_GATEWAY_PAPER.courseId, paperId: OCR_GATEWAY_PAPER.paperId,
    contractVersion: OCR_GATEWAY_PAPER.contractVersion, curriculum, examBoard: 'OCR', tiers: ['foundation', 'higher'],
    sources: [{ url: 'https://www.ocr.org.uk/Images/234594-specification-accredited-gcse-gateway-science-suite-biology-a-j247.pdf', section: 'Version 4.0 (August 2026), 2a and 3a: first paper at each tier', checkedOn: '2026-09-18' }],
    official: { fullMarks: 90, durationMinutes: 105, sections: [{ id: 'A', marks: 15 }, { id: 'B', marks: 75 }] },
    layoutChoices: ['The nine Section B groups and their specific allocations belong to Examly template v1.', 'The short practice is a reduced exercise, not an official-length paper.'],
    validation: { rows: 'exact_parts', mcqOptions: 4, levelSchemeAtMarks: 6 },
    rules: GATEWAY_RULES,
    generation: { strategy: 'contract_only', systemPrompt: 'Write an original OCR Gateway GCSE Biology practice paper using the supplied immutable plan and tier. Output valid JSON only, with complete questions, canonical resources and private marking schemes.' },
    definition: tier => ({ ...OCR_GATEWAY_PAPER, componentCode: gatewayComponent(tier), displayName: `OCR Gateway Biology A ${tier === 'higher' ? 'Paper 3' : 'Paper 1'}` }),
    build: buildGatewayPlan, instructions: gatewayPlanInstructions, repairPartInstructions: gatewayPartInstruction,
  },
  {
    id: 'aqa-8461-paper-2-v1', courseId: AQA_BIOLOGY_P2.courseId, paperId: AQA_BIOLOGY_P2.paperId,
    contractVersion: 1, curriculum, examBoard: 'AQA', tiers: ['foundation', 'higher'],
    sources: ['specification-at-a-glance', 'scheme-of-assessment', 'subject-content/homeostasis-and-response',
      'subject-content/inheritance-variation-and-evolution', 'subject-content/ecology'].map(section => ({
        url: `https://www.aqa.org.uk/subjects/biology/gcse/biology-8461/specification/${section}`,
        section, checkedOn: '2026-09-19',
      })),
    official: { fullMarks: 100, durationMinutes: 105 },
    layoutChoices: ['Nine groups, 36 parts, nine MCQs and four six-mark responses are Examly template choices.',
      'Planned AO marks are 40/40/20; maths and practical annotations are targets, not proof of generated content.',
      'Short practice has eight parts and 20 marks; it is not a full paper.'],
    validation: { rows: 'exact_parts', mcqOptions: 4, levelSchemeAtMarks: 6 },
    rules: AQA_P2_RULES,
    generation: { strategy: 'contract_only', systemPrompt: 'Write an original AQA GCSE separate Biology 8461 Paper 2 practice paper at the saved Foundation or Higher tier. Follow the immutable part plan, Paper 2 scope and resource schema. Return complete JSON only, including private answer keys.' },
    definition: tier => ({...AQA_BIOLOGY_P2, componentCode: aqaPaper2Component(tier)}),
    build: buildAqaPaper2Plan, instructions: aqaPaper2Instructions, repairPartInstructions: aqaPaper2PartInstruction,
  },
  edexcelPack('paper_1'),
  edexcelPack('paper_2'),
  ocr21cPack('breadth'),
  ocr21cPack('depth'),
];

export const biologyPaperOptions = (courseId: string | null | undefined) =>
  BIOLOGY_PAPER_PACKS.filter(pack => canonicalCourseId(pack.courseId) === canonicalCourseId(courseId));

/** Explicit paper/version lookups never fall back to a different registered paper. */
export function getBiologyPaperPack(courseId: string | null | undefined, paperId?: string | null, contractVersion?: number): BiologyPaperPack | null {
  const course = canonicalCourseId(courseId);
  // Before Paper 2 shipped, an absent AQA paper meant Paper 1. Preserve old
  // callers/profiles explicitly; never infer Paper 2 from a display name.
  const selectedPaper = paperId ?? (course === 'aqa_gcse_biology' ? 'paper_1' : null);
  const matches = BIOLOGY_PAPER_PACKS.filter(pack => canonicalCourseId(pack.courseId) === course &&
    (selectedPaper == null || pack.paperId === selectedPaper) && (contractVersion === undefined || pack.contractVersion === contractVersion));
  // Ambiguous defaults require an explicit paper/version; never select the first match.
  return matches.length === 1 ? matches[0] : null;
}

export function packForBiologyPlan(plan: PaperPlan): BiologyPaperPack {
  const pack = getBiologyPaperPack(plan.courseId, plan.paperId, plan.contractVersion);
  if (!pack) throw new Error('This Biology paper version is not supported. Reapply a supported preset.');
  return pack;
}

export const biologyPlanInstructions = (plan: PaperPlan): string => packForBiologyPlan(plan).instructions(plan);

export interface BiologyBatchSibling {
  question_number: string;
  marks?: number;
  question_text?: string;
  chart_data?: unknown;
}

/**
 * Instructions for ONE batch of a guided paper. The whole-paper plan is stated
 * as context only; the parts required in this response are listed explicitly,
 * so a six-part batch is never told to write nine groups and 36 parts.
 */
export function biologyBatchInstructions(
  plan: PaperPlan,
  batch: readonly PlannedPart[],
  context: { siblings?: readonly BiologyBatchSibling[] } = {},
): string {
  const pack = packForBiologyPlan(plan);
  const numbers = batch.map(part => part.questionNumber);
  const lines: string[] = [
    pack.rules ?? '',
    `${pack.examBoard} GUIDED PAPER, written in batches. ${plan.label}${plan.componentCode ? `, component ${plan.componentCode}` : ''}; saved tier ${plan.tier ?? 'not tiered'}.`,
    `WHOLE PAPER (context only, do NOT write it now): ${plan.partCount} scored parts, ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. The layout is an Examly template, not an official fixed blueprint.`,
    `PARTS IN THIS RESPONSE: ${numbers.join(', ')}`,
    `Write exactly ${batch.length} scored row(s) - only the parts listed above, in order, with their exact question numbers, marks, response types and topic tags. Never renumber, relabel, split, merge, omit or add a part, and never restate a part that is not listed.`,
    'Each row needs question_number, root_question_number (leading integer as a string), parent_question_number (same leading integer), context, task, question_text (context joined to task), question_type, marks, topic_tag and a private correct_answer. Every scored part needs an explicit assessed instruction, including parts with a table or graph.',
    'Resources are question-local: one canonical chart_data payload per required resource, with real self-consistent values used by the task and a neutral caption. Keep answer keys and level descriptors out of the stem and resource.',
  ];
  if (context.siblings?.length) {
    lines.push(
      'ALREADY WRITTEN in this paper (reference only - do not rewrite, repeat or renumber them). Where a listed part depends on this data, reuse these exact values and name the earlier part:',
      JSON.stringify(context.siblings),
    );
  }
  const instruction = pack.repairPartInstructions;
  lines.push(instruction
    ? batch.map(part => instruction(part, true)).join('\n')
    : pack.instructions({ ...plan, parts: [...batch], partCount: batch.length,
        parentCount: new Set(batch.map(part => part.parentId)).size }));
  return lines.filter(line => line.trim().length > 0).join('\n');
}

export function biologyRepairInstructions(plan: PaperPlan | null | undefined, numbers: Set<string>, includeOptions: boolean): string {
  if (!plan) return '';
  const instruction = packForBiologyPlan(plan).repairPartInstructions;
  return instruction ? plan.parts.filter(part => numbers.has(part.questionNumber)).map(part => instruction(part, includeOptions)).join('\n') : '';
}

/** Pre-model check of our authored template, not a claim of scientific quality. */
export function assertBiologyPlanIntegrity(plan: PaperPlan, pack = packForBiologyPlan(plan)): void {
  const reject = (reason: string): never => { throw new Error(`Invalid Biology template ${pack.id}: ${reason}`); };
  if (plan.courseId !== pack.courseId || plan.paperId !== pack.paperId || plan.contractVersion !== pack.contractVersion) reject('identity mismatch');
  if (plan.mode !== 'full_mock' && plan.mode !== 'short_practice') reject('unknown guided mode');
  if (plan.tier !== null && !pack.tiers.includes(plan.tier)) reject('unsupported tier');
  const definition = pack.definition(plan.tier);
  const numbers = new Set<string>(), ids = new Set<string>(), resources = new Set<string>();
  for (const part of plan.parts) {
    if (!part.partId || !part.parentId || !part.questionNumber || ids.has(part.partId) || numbers.has(part.questionNumber)) reject('missing or duplicate part identity');
    ids.add(part.partId); numbers.add(part.questionNumber);
    if (!Number.isInteger(part.marks) || part.marks <= 0) reject(`invalid marks at ${part.questionNumber}`);
    if (!definition.topics.includes(part.topic)) reject(`out-of-paper topic at ${part.questionNumber}`);
    if (!['mcq_single', 'short_answer', 'long_form'].includes(part.responseType)) reject('unknown response type');
    if (!['AO1', 'AO2', 'AO3'].includes(part.demand)) reject('unknown demand');
    if (!['none', 'data_table', 'graph', 'diagram'].includes(part.resource)) reject('unknown resource type');
    if (part.resource !== 'none') {
      if (!part.resourceId || resources.has(part.resourceId)) reject('missing or duplicate resource identity');
      resources.add(part.resourceId);
    }
  }
  if (!plan.parts.length || plan.partCount !== plan.parts.length || plan.parentCount !== new Set(plan.parts.map(p => p.parentId)).size) reject('part or parent count mismatch');
  if (plan.totalMarks !== plan.parts.reduce((sum, p) => sum + p.marks, 0)) reject('computed mark total mismatch');
  if (!Number.isInteger(plan.durationMinutes) || plan.durationMinutes <= 0) reject('invalid duration');
  if ((plan.componentCode ?? null) !== definition.componentCode) reject('component/tier mismatch');
  if (plan.mode === 'full_mock') {
    if (plan.totalMarks !== pack.official.fullMarks || plan.durationMinutes !== pack.official.durationMinutes) reject('full-paper total or time differs from specification');
    for (const section of pack.official.sections ?? []) {
      if (plan.parts.filter(p => p.section === section.id).reduce((sum, p) => sum + p.marks, 0) !== section.marks) reject(`Section ${section.id} total mismatch`);
    }
  }
  pack.validatePlan?.(plan);
}
