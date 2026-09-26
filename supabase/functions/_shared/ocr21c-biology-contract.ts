import { OCR_21C_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { OCR21C_TOPICS, OCR21C_OUTCOMES, ocr21cOutcomeAllowed, ocr21cBiologyRules,
  type Ocr21cChapter, type Ocr21cPaper } from './ocr21c-biology-scope.ts';

export const OCR21C_CONTRACT_VERSION = 1;
export function ocr21cComponent(paper: Ocr21cPaper, tier: PaperPlan['tier']): string | null {
  if (!['breadth','depth'].includes(paper)) throw new Error('Choose Breadth or Depth for OCR Biology B.');
  if (tier !== 'foundation' && tier !== 'higher') return null;
  return `J257/0${(paper === 'breadth' ? 1 : 2) + (tier === 'higher' ? 2 : 0)}`;
}
export function ocr21cDefinition(paper: Ocr21cPaper, tier: PaperPlan['tier']) {
  return {courseId:OCR_21C_BIOLOGY_ID, paperId:paper, contractVersion:OCR21C_CONTRACT_VERSION,
    displayName:`OCR Twenty First Century Biology B - ${paper === 'breadth' ? 'Breadth' : 'Depth'} in biology`,
    topics:Object.values(OCR21C_TOPICS), fullMockMarks:90, fullMockMinutes:105, componentCode:ocr21cComponent(paper,tier)};
}

type Group = {chapter:Ocr21cChapter; refs:string[][]; resource:'data_table'|'graph'|'none'; maths?:number; practical?:number};
const breadthGroups = (higher:boolean): Group[] => [
  {chapter:1,refs:[['B1.1.2'],['B1.1.1'],['B1.1.3']],resource:'none'},
  {chapter:2,refs:[['B2.1.1'],['B2.2.1'],['B2.2.4']],resource:'none'},
  {chapter:3,refs:[['B3.1.2'],['B3.1.1'],higher?['B3.1.6']:['B3.1.4']],resource:'graph',maths:1,practical:3},
  {chapter:4,refs:[['B4.1.3'],['B4.1.1'],['B4.1.5']],resource:'data_table',maths:2,practical:3},
  {chapter:5,refs:[['B5.4.1'],['B5.1.4'],['B5.1.8']],resource:'data_table',maths:2},
  {chapter:6,refs:[['B6.1.1'],['B6.1.3'],['B6.4.1']],resource:'data_table'},
  {chapter:1,refs:[['B1.2.1'],['B1.1.5'],['B1.2.3','B1.2.4']],resource:'none',maths:2},
  {chapter:2,refs:[['B2.6.1'],['B2.4.2'],['B2.4.3']],resource:'data_table',maths:2,practical:3},
  {chapter:3,refs:[['B3.3.5'],['B3.1.3'],['B3.3.8']],resource:'data_table',maths:2},
  {chapter:4,refs:[['B4.3.1'],['B4.2.1'],higher?['B4.2.2c']:['B4.2.2ab']],resource:'data_table',maths:2},
  {chapter:5,refs:[['B5.1.2'],['B5.2.3'],['B5.2.3']],resource:'data_table',maths:1,practical:3},
  {chapter:6,refs:[['B6.3.1'],['B6.1.6'],['B6.2.1']],resource:'none'},
  {chapter:1,refs:[['B1.1.3'],['B1.1.6'],higher?['B1.1.8','B1.1.9']:['B1.3.2']],resource:'none'},
  {chapter:3,refs:[['B3.3.5'],['B3.4.2'],['B3.4.3']],resource:'graph',maths:2,practical:3},
  {chapter:5,refs:[['B5.4.1'],['B5.4.2'],higher?['B5.6.2']:['B5.6.1']],resource:'graph'},
];
const depthGroups = (higher:boolean): Group[] => [
  {chapter:5,refs:[['B5.1.2'],['B5.1.2'],['B5.1.8'],higher?['B5.4.6']:['B5.4.2']],resource:'data_table',maths:3,practical:2},
  {chapter:3,refs:[['B3.1.2'],['B3.1.1'],higher?['B3.1.5']:['B3.1.4'],['B3.1.3','B3.1.4']],resource:'graph',maths:2,practical:3},
  {chapter:1,refs:[['B1.2.1'],['B1.1.5'],['B1.1.6'],higher?['B1.1.8','B1.1.9']:['B1.2.3','B1.2.4']],resource:'none',maths:0},
  {chapter:2,refs:[['B2.6.1'],['B2.4.2'],['B2.4.3'],higher?['B2.4.5']:['B2.2.4']],resource:'data_table',maths:2,practical:3},
  {chapter:4,refs:[['B4.1.3'],['B4.1.1'],['B4.1.5'],['B4.3.1','B4.3.3']],resource:'graph',maths:2,practical:3},
  {chapter:6,refs:[['B6.1.1'],['B6.1.6'],['B6.3.1'],['B6.1.3','B6.2.1']],resource:'data_table'},
  {chapter:5,refs:[['B5.4.1'],['B5.2.3'],['B5.6.1'],higher?['B5.4.3']:['B5.4.2']],resource:'data_table',maths:1,practical:2},
  {chapter:3,refs:[['B3.3.5'],['B3.4.2'],['B3.4.3'],['B3.4.2']],resource:'data_table',maths:2,practical:3},
  {chapter:6,refs:[['B6.3.1'],['B6.4.1'],['B6.1.1'],higher?['B6.4.2']:['B6.4.1']],resource:'data_table',maths:1},
];
const DEPTH_MARKS = [[1,2,3,4],[1,2,3,6],[1,2,2,3],[1,2,3,4],[1,2,3,4],[1,2,3,6],[1,2,2,3],[1,2,3,4],[1,2,3,4]];

function part(paper:Ocr21cPaper, group:number, slot:number, g:Group, marks:number,
  refs:string[], demand:PlannedPart['demand'], resource:PlannedPart['resource'], mcq=false, maths=0, practical=0): PlannedPart {
  const id=`j257_${paper}_${group}${'abcd'[slot]}`;
  return {partId:id,parentId:`q${group}`,questionNumber:`${group}(${'abcd'[slot]})`,topic:OCR21C_TOPICS[g.chapter],
    responseType:mcq?'mcq_single':marks===6?'long_form':'short_answer',marks,demand,resource,
    ...(resource==='none'?{}:{resourceId:`r_${id}`}),specRefs:refs,mathsMarks:maths,practicalMarks:practical};
}

export function buildOcr21cPlan(paper:Ocr21cPaper, mode:PaperMode, tier:PaperPlan['tier']): PaperPlan | null {
  if (!['breadth','depth'].includes(paper)) throw new Error('Choose Breadth or Depth for OCR Biology B.');
  if (mode === 'custom') return null;
  if (!['full_mock','short_practice'].includes(mode)) throw new Error('Unknown OCR Biology B paper mode.');
  if (tier !== 'foundation' && tier !== 'higher') throw new Error('Choose Foundation or Higher for OCR Biology B.');
  const groups=paper==='breadth'?breadthGroups(tier==='higher'):depthGroups(tier==='higher');
  const parts:PlannedPart[]=[];
  if (mode==='full_mock') groups.forEach((g,i)=> {
    const n=i+1;
    const marks=paper==='breadth'?[1,2,3]:DEPTH_MARKS[i];
    marks.forEach((m,j)=> {
      const demand:PlannedPart['demand']=paper==='breadth'
        ? (j===2 ? ([3,6,10,14].includes(n)?'AO3':'AO2') : n===15&&j===1?'AO3':'AO1')
        : j<2?'AO1':j===2?(n===3?'AO1':'AO2'):([1,4,5,9].includes(n)?'AO2':'AO3');
      parts.push(part(paper,n,j,g,m,g.refs[j],demand,j===2?g.resource:'none',
        j===0&&(paper==='breadth'?[1,4,6,9,11,14].includes(n):[1,4,7].includes(n)),j===2?g.maths??0:0,j===2?g.practical??0:0));
    });
  });
  else {
    // Six compact contexts, one per content chapter. Counts and timings are
    // Examly choices; short practice is never advertised as an official paper.
    const selected=paper==='breadth'?[6,7,2,3,14,5]:[2,3,1,4,6,5];
    selected.forEach((index,i)=> {
      const g=groups[index];
      const extended=paper==='depth' && [3,6].includes(i+1);
      const refs=paper==='breadth'?g.refs[2]:extended?g.refs[3]:i===0?(tier==='higher'?['B1.1.8','B1.1.9']:['B1.2.3','B1.2.4']):g.refs[2];
      parts.push(part(paper,i+1,0,g,1,g.refs[0],'AO1','none',[0,3].includes(i)));
      parts.push(part(paper,i+1,1,g,extended?6:3,refs,extended?'AO3':'AO2',g.resource,false,
        Math.min(2,g.maths??0),Math.min(3,g.practical??0)));
    });
  }
  const totalMarks=parts.reduce((n,p)=>n+p.marks,0);
  const plan:PaperPlan={courseId:OCR_21C_BIOLOGY_ID,paperId:paper,contractVersion:OCR21C_CONTRACT_VERSION,tier,mode,
    componentCode:ocr21cComponent(paper,tier)!,parts,partCount:parts.length,parentCount:new Set(parts.map(p=>p.parentId)).size,
    totalMarks,durationMinutes:mode==='full_mock'?105:Math.round(totalMarks*105/90),
    label:`OCR Twenty First Century Biology B ${paper==='breadth'?'Breadth':'Depth'} ${mode==='full_mock'?'full mock':'short practice'}`};
  assertOcr21cPlan(plan);
  return plan;
}

export function assertOcr21cPlan(plan:PaperPlan): void {
  if (plan.courseId!==OCR_21C_BIOLOGY_ID || !['breadth','depth'].includes(plan.paperId) ||
    !['foundation','higher'].includes(plan.tier??'') || plan.contractVersion!==OCR21C_CONTRACT_VERSION) throw new Error('Invalid OCR Biology B course/paper/tier/version.');
  for (const p of plan.parts) {
    if (!p.specRefs?.length || p.specRefs.some(ref=>!ocr21cOutcomeAllowed(ref,plan.tier)||OCR21C_TOPICS[OCR21C_OUTCOMES[ref].chapter]!==p.topic)) throw new Error(`OCR Biology B Q${p.questionNumber}: outcome does not match the chapter or tier.`);
    if (p.section) throw new Error('OCR Biology B has no Gateway MCQ section.');
    if (plan.paperId==='breadth'&&(p.marks>4||p.responseType==='long_form')) throw new Error('Breadth has no extended level-response tasks.');
    if ([p.mathsMarks,p.practicalMarks].some(n=>n!==undefined&&(!Number.isInteger(n)||n<0||n>p.marks))) throw new Error('Invalid OCR Biology B skill annotation.');
  }
  if (new Set(plan.parts.map(p=>p.topic)).size!==6) throw new Error('OCR Biology B templates must sample all six content chapters, with B7/B8 embedded.');
  if (plan.paperId==='depth'&&plan.parts.filter(p=>p.marks===6&&p.responseType==='long_form').length<2) throw new Error('Depth template requires two six-mark responses.');
  if (plan.mode==='full_mock') {
    const ao=['AO1','AO2','AO3'].map(a=>plan.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0));
    if (plan.totalMarks!==90 || plan.durationMinutes!==105 || ao.join('/')!==(plan.paperId==='breadth'?'43/33/14':'29/39/22') ||
      plan.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)<9 || plan.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)<14) throw new Error('Invalid OCR Biology B marks, timing or skill targets.');
  }
}

export function ocr21cPartInstruction(p:PlannedPart, includeOptions=true): string {
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | topic_tag="${p.topic}" | `+
    (p.specRefs??[]).map(ref=>`${ref}: ${OCR21C_OUTCOMES[ref].text}`).join('; ')+
    (p.responseType==='mcq_single'?(includeOptions?' | question_type="mcq"; four distinct options; private correct_answer matches one.':' | Preserve MCQ options and their correct answer.'):' | question_type="written".')+
    (p.resource==='none'?' | Self-contained text with all required inputs; no invented or decorative diagram.':` | REQUIRED ${p.resource} in chart_data, with real measurements, units and a neutral caption. Use the same values in the task and private key.`)+
    (p.mathsMarks?` | Target ${p.mathsMarks} mathematical marks; supply inputs and private working; scaffold for Foundation.`:'')+
    (p.practicalMarks?` | Target ${p.practicalMarks} practical-skills marks: methods, controls, evidence or justified improvements, embedding B7/B8.`:'')+
    (p.marks===6?' | Private task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) scheme, indicative science and zero for no relevant response. Assess a coherent line of reasoning, not six disconnected facts. Do not print the scheme in the question.':'');
}
export function ocr21cInstructions(plan:PaperPlan): string {
  return `${ocr21cBiologyRules(plan.paperId as Ocr21cPaper)}\nSAVED TIER: ${plan.tier}; component ${plan.componentCode}; ${plan.totalMarks} marks; ${plan.durationMinutes} minutes.
${plan.mode==='full_mock'?'This full mock follows Examly template v1, with original question contexts.':'This is short practice, not an official-length paper.'}
Return only the listed scored rows, in order. Required fields: question_number, root_question_number and parent_question_number (leading integer as string), context, task, question_text (context plus task), question_type, marks, topic_tag, and private correct_answer. Never renumber, omit, merge or add parts. Do not create unscored parent rows. Each part must include an explicit assessed task.
${plan.parts.map(p=>ocr21cPartInstruction(p)).join('\n')}`;
}
