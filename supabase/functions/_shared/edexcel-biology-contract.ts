import { EDEXCEL_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { EDEXCEL_BIOLOGY_TOPICS, EDEXCEL_BIOLOGY_OUTCOMES, edexcelTopicNumbers,
  edexcelOutcomeAllowed, edexcelBiologyRules, type EdexcelBiologyPaper, type EdexcelTopic } from './edexcel-biology-scope.ts';

export const EDEXCEL_BIOLOGY_CONTRACT_VERSION = 1;
export const EDEXCEL_BIOLOGY_SPECIFICATION = '1BI0 Issue 4 (March 2024)';

export function edexcelBiologyComponent(paper: EdexcelBiologyPaper, tier: PaperPlan['tier']): string | null {
  if (!['paper_1', 'paper_2'].includes(paper)) throw new Error('Unknown Edexcel Biology paper.');
  return tier === 'foundation' || tier === 'higher' ? `1BI0/${paper === 'paper_1' ? '1' : '2'}${tier === 'foundation' ? 'F' : 'H'}` : null;
}

export function edexcelBiologyDefinition(paper: EdexcelBiologyPaper, tier: PaperPlan['tier']) {
  return {courseId: EDEXCEL_BIOLOGY_ID, paperId: paper, contractVersion: EDEXCEL_BIOLOGY_CONTRACT_VERSION,
    displayName: `Pearson Edexcel GCSE Biology (1BI0) Paper ${paper === 'paper_1' ? '1' : '2'}`,
    topics: edexcelTopicNumbers(paper).map(n => EDEXCEL_BIOLOGY_TOPICS[n]),
    fullMockMarks: 100, fullMockMinutes: 105, componentCode: edexcelBiologyComponent(paper, tier)};
}

type Group = {topic: EdexcelTopic; refs: [string[], string[], string[], string[]]; resource: 'data_table' | 'graph' | 'none'; maths: number; practical?: number; practicalEnd?: number};
const groupsFor = (paper: EdexcelBiologyPaper, higher: boolean): Group[] => paper === 'paper_1' ? [
  {topic: 1, refs: [['1.1'], ['1.3'], ['1.5','1.6'], ['1.15']], resource:'data_table', maths:2, practical:2},
  {topic: 1, refs: [['1.7'], ['1.8'], ['1.10','1.11'], ['1.9','1.10']], resource:'graph', maths:2, practical:3, practicalEnd:4},
  {topic: 2, refs: [['2.2'], ['2.1','2.3'], ['2.5','2.7'], ['2.8']], resource:'data_table', maths:2},
  {topic: 2, refs: [['2.10B'], ['2.13'], ['2.14'], higher ? ['2.11B','2.12B'] : ['2.8','2.9']], resource:'data_table', maths:2, practical:3},
  {topic: 3, refs: [['3.13'], higher ? ['3.7B','3.8B'] : ['3.4','3.5'], ['3.14','3.16'], higher ? ['3.18B'] : ['3.17B']], resource:'data_table', maths:2},
  {topic: 3, refs: [['3.5'], ['3.4'], ['3.20'], ['3.1B','3.2B']], resource:'none', maths:2},
  {topic: 4, refs: [['4.2'], ['4.1B'], ['4.4','4.5'], ['4.2','4.3','4.6B']], resource:'data_table', maths:2},
  {topic: 4, refs: [['4.10'], ['4.8'], ['4.12B'], ['4.13B','4.14']], resource:'none', maths:2},
  {topic: 5, refs: [['5.4'], ['5.16'], ['5.18B','5.19B'], ['5.17B','5.18B']], resource:'data_table', maths:3, practical:3, practicalEnd:4},
  {topic: 5, refs: [['5.12'], ['5.13'], ['5.14','5.15B'], higher ? ['5.21B','5.22B'] : ['5.13','5.14','5.20']], resource:'graph', maths:0},
] : [
  {topic: 1, refs: [['1.1'], ['1.15'], ['1.16','1.17'], ['1.15']], resource:'data_table', maths:2, practical:2},
  {topic: 6, refs: [['6.1'], ['6.2'], ['6.3','6.5'], higher ? ['6.4','6.5','6.6'] : ['6.3','6.5']], resource:'graph', maths:2, practical:3, practicalEnd:4},
  {topic: 6, refs: [['6.7'], ['6.8'], ['6.12','6.13'], ['6.9','6.10']], resource:'data_table', maths:2},
  {topic: 7, refs: [['7.1'], ['7.13'], ['7.15','7.17'], higher ? ['7.13','7.14'] : ['7.15','7.16','7.17']], resource:'data_table', maths:2},
  {topic: 7, refs: [['7.18B'], ['7.19B'], ['7.19B','7.21B'], higher ? ['7.20B'] : ['7.19B','7.22B']], resource:'data_table', maths:2},
  {topic: 8, refs: [['8.1'], ['8.3'], ['8.2','8.5B'], ['8.4B']], resource:'none', maths:2},
  {topic: 8, refs: [['8.6'], ['8.7'], ['8.8','8.12'], ['8.9','8.10','8.11']], resource:'data_table', maths:2, practicalEnd:6},
  {topic: 9, refs: [['9.1'], ['9.3','9.4'], ['9.5','9.6'], ['9.2','9.5']], resource:'data_table', maths:2, practical:3, practicalEnd:4},
  {topic: 9, refs: [['9.7B'], ['9.7B'], ['9.8B'], higher ? ['9.9','9.16B'] : ['9.9','9.10']], resource:'data_table', maths:3},
  {topic: 9, refs: [['9.12'], ['9.13','9.15'], ['9.17B'], ['9.13','9.14','9.15']], resource:'graph', maths:0},
];

// Ten parent questions are specified by Pearson. Forty subparts, eight MCQs,
// three six-mark responses and these group allocations are Examly's template.
const MARKS = [[1,2,2,3], [1,2,3,4], [1,2,3,3], [1,2,3,6], [1,2,3,4],
  [1,2,2,3], [1,2,2,6], [1,2,3,4], [1,2,3,4], [1,2,3,6]];
const END_AO: PlannedPart['demand'][] = ['AO1','AO2','AO1','AO3','AO1','AO2','AO3','AO3','AO3','AO2'];

function makePart(paper: EdexcelBiologyPaper, group: number, index: number, topic: EdexcelTopic, marks: number,
  refs: string[], resource: PlannedPart['resource'], mathsMarks = 0, practicalMarks = 0, short = false): PlannedPart {
  const letter = 'abcd'[index];
  const prefix = `ed${paper === 'paper_1' ? '1' : '2'}`;
  return {partId:`${prefix}_${group}${letter}`, parentId:`q${group}`, questionNumber:`${group}(${letter})`,
    topic:EDEXCEL_BIOLOGY_TOPICS[topic], marks, specRefs:refs,
    responseType: marks === 6 ? 'long_form' : index === 0 && (short || ![6,8].includes(group)) ? 'mcq_single' : 'short_answer',
    demand: short ? (index === 0 ? 'AO1' : 'AO2') : index < 2 ? 'AO1' : index === 2 ? 'AO2' : END_AO[group-1],
    resource, ...(resource === 'none' ? {} : {resourceId:`${prefix}_r${group}${letter}`}), mathsMarks, practicalMarks,
    ...(!short && [3,6,8].includes(group) ? {commonTierTarget:true} : {})};
}

export function buildEdexcelBiologyPlan(paper: EdexcelBiologyPaper, mode: PaperMode, tier: PaperPlan['tier']): PaperPlan | null {
  if (!['paper_1','paper_2'].includes(paper)) throw new Error('Unknown Edexcel Biology paper.');
  if (mode === 'custom') return null;
  if (!['full_mock','short_practice'].includes(mode)) throw new Error('Unknown Edexcel Biology paper mode.');
  if (tier !== 'foundation' && tier !== 'higher') throw new Error('Choose Foundation or Higher for Edexcel Biology.');
  const groups = groupsFor(paper, tier === 'higher');
  const parts: PlannedPart[] = [];
  if (mode === 'full_mock') {
    groups.forEach((g,i) => MARKS[i].forEach((marks,j) => parts.push(makePart(paper,i+1,j,g.topic,marks,g.refs[j],
      j === 2 ? g.resource : 'none', j === 2 ? g.maths : 0, j === 2 ? g.practical ?? 0 : j === 3 ? g.practicalEnd ?? 0 : 0))));
  } else {
    // Cover all five paper topics in a small exercise. It is explicitly
    // not an official-length paper and does not promise the full-paper AO mix.
    const selected = paper === 'paper_1' ? [1,3,5,8,9] : [1,2,4,6,8];
    selected.forEach((number,i) => {
      const g = groups[number-1];
      parts.push(makePart(paper,i+1,0,g.topic,1,g.refs[0],'none',0,0,true));
      const refs = paper === 'paper_1' && number === 5 && tier === 'higher' ? ['3.7B','3.8B']
        : paper === 'paper_2' && number === 4 && tier === 'higher' ? ['7.13','7.14'] : g.refs[2];
      const resource = paper === 'paper_1' && number === 3 ? 'graph' : g.resource;
      const maths = paper === 'paper_1' && number === 5 && tier === 'higher' ? 0 : Math.min(2,g.maths);
      parts.push(makePart(paper,i+1,1,g.topic,4,refs,resource,maths,g.practical ?? 0,true));
    });
  }
  const plan: PaperPlan = {courseId:EDEXCEL_BIOLOGY_ID,paperId:paper,contractVersion:EDEXCEL_BIOLOGY_CONTRACT_VERSION,
    tier,mode,componentCode:edexcelBiologyComponent(paper,tier)!,parts,partCount:parts.length,
    parentCount:new Set(parts.map(p=>p.parentId)).size,totalMarks:parts.reduce((n,p)=>n+p.marks,0),
    durationMinutes:mode === 'full_mock' ? 105 : 26,
    label:`Pearson Edexcel GCSE Biology Paper ${paper === 'paper_1' ? '1' : '2'} ${mode === 'full_mock' ? 'full mock' : 'short practice'}`};
  assertEdexcelBiologyPlan(plan);
  return plan;
}

/** Authoring errors stop BEFORE a model call, including accidental transfer of
 * an AQA rule, a Paper 2 outcome, or a Higher-only ref into a Foundation slot. */
export function assertEdexcelBiologyPlan(plan: PaperPlan): void {
  const paper = plan.paperId as EdexcelBiologyPaper;
  if (plan.courseId !== EDEXCEL_BIOLOGY_ID || !['paper_1','paper_2'].includes(paper) ||
    !['foundation','higher'].includes(plan.tier ?? '') || plan.contractVersion !== EDEXCEL_BIOLOGY_CONTRACT_VERSION) {
    throw new Error('Invalid Edexcel Biology course/paper/tier/version.');
  }
  for (const p of plan.parts) {
    if (!p.specRefs?.length || p.specRefs.some(ref => !edexcelOutcomeAllowed(ref,paper,plan.tier) ||
      (p.commonTierTarget && !edexcelOutcomeAllowed(ref,paper,'foundation')) ||
      EDEXCEL_BIOLOGY_TOPICS[Number(ref.split('.')[0]) as EdexcelTopic] !== p.topic)) throw new Error(`Edexcel Q${p.questionNumber}: outcome is not valid for this paper/topic/tier.`);
    if ([p.mathsMarks,p.practicalMarks].some(n=>n !== undefined && (!Number.isInteger(n) || n < 0 || n > p.marks))) throw new Error('Invalid Edexcel skill annotation.');
  }
  if (plan.mode === 'full_mock') {
    const ao = ['AO1','AO2','AO3'].map(a=>plan.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0));
    if (plan.totalMarks !== 100 || plan.parentCount !== 10 || plan.durationMinutes !== 105 || ao.join('/') !== '40/40/20' ||
      plan.parts.reduce((n,p)=>n+(p.mathsMarks??0),0) < 10 || plan.parts.reduce((n,p)=>n+(p.practicalMarks??0),0) < 15 ||
      plan.parts.filter(p=>p.commonTierTarget).reduce((n,p)=>n+p.marks,0) !== 27) throw new Error('Invalid Edexcel full-paper totals, skills or common-tier target.');
  }
}

export function edexcelBiologyPartInstruction(p: PlannedPart, includeOptions = true): string {
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | topic_tag="${p.topic}" | ` +
    (p.specRefs ?? []).map(ref=>`${ref}: ${EDEXCEL_BIOLOGY_OUTCOMES[ref]}`).join('; ') +
    (p.responseType === 'mcq_single' ? (includeOptions ? ' | question_type="mcq"; four distinct plain-string options, correct_answer equals one option.' : ' | Retain the existing MCQ choices and correct key.') : ' | question_type="written".') +
    (p.resource === 'none' ? ' | Self-contained text; put all calculation inputs in the stem or explicitly identify a sibling resource.' : ` | REQUIRED ${p.resource} in chart_data, with the real inputs used by this task. Do not substitute a biological diagram for required numerical data.`) +
    (p.mathsMarks ? ` | Allocate ${p.mathsMarks} marks to mathematical work, with working, units and the matching value in the private key; scaffold for the saved tier.` : '') +
    (p.practicalMarks ? ` | Allocate ${p.practicalMarks} marks to practical methods, experimental evidence or evaluation.` : '') +
    (p.commonTierTarget ? ' | Common-tier demand target: use common content accessible at grades 4–5, not Higher-only knowledge.' : '') +
    (p.marks === 6 ? ' | Private key: task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), indicative science and zero for no relevant science. Match the planned AO; higher level means better biological reasoning, not just more facts.' : '');
}

export function edexcelBiologyInstructions(plan: PaperPlan): string {
  return `${edexcelBiologyRules(plan.paperId as EdexcelBiologyPaper)}\nSAVED TIER: ${plan.tier}; component ${plan.componentCode}; ${plan.totalMarks} marks; ${plan.durationMinutes} minutes.
${plan.mode === 'full_mock' ? 'Ten parent questions; Examly template v1 chooses 40 scored parts, eight MCQs and three six-mark responses. The 27 common-tier target marks do not mean separately generated Foundation/Higher papers contain identical questions.' : 'Short practice: five groups, ten scored parts, 25 marks and 26 minutes. This is not a full exam.'}
Return only the listed rows in order. Each row needs question_number, root_question_number and parent_question_number (leading integer as a string), context, task, question_text (context joined to task), question_type, marks, topic_tag and correct_answer. Do not create unscored parent rows, renumber, merge, omit or add scored parts. Every scored part needs a complete assessed instruction.
${plan.parts.map(p=>edexcelBiologyPartInstruction(p)).join('\n')}`;
}
