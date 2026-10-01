import { OCR_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { OCR_ALEVEL_BIOLOGY_SPECIFICATION, OCR_ALEVEL_P1_TOPICS, OCR_ALEVEL_P1_OUTCOMES, OCR_ALEVEL_P1_RULES, OCR_ALEVEL_MCQ_RULES } from './ocr-alevel-biology-scope.ts';
import { questionResourceInstructions } from './question-resource-instructions.ts';

export const OCR_ALEVEL_P1 = {
  courseId:OCR_ALEVEL_BIOLOGY_ID, paperId:'paper_1', contractVersion:1,
  specificationVersion:OCR_ALEVEL_BIOLOGY_SPECIFICATION, componentCode:'H420/01',
  displayName:'OCR A-level Biology A Paper 1 — Biological processes', topics:OCR_ALEVEL_P1_TOPICS,
  fullMockMarks:100, fullMockMinutes:135,
} as const;

type McqStyle = 'recall' | 'calculation' | 'data' | 'graph' | 'statements' | 'practical';
interface McqSlot { ref:string; style:McqStyle; demand:'AO1'|'AO2'; resource?:PlannedPart['resource']; maths?:number; }
const MCQS: readonly McqSlot[] = [
  {ref:'2.1.1',style:'calculation',demand:'AO2',maths:1},
  {ref:'2.1.2',style:'recall',demand:'AO1'},
  {ref:'2.1.3',style:'recall',demand:'AO1'},
  {ref:'2.1.4',style:'data',demand:'AO2',resource:'data_table',maths:1},
  {ref:'2.1.5',style:'statements',demand:'AO2'},
  {ref:'2.1.6',style:'recall',demand:'AO1'},
  {ref:'3.1.1',style:'recall',demand:'AO1'},
  {ref:'3.1.2',style:'graph',demand:'AO2',resource:'graph',maths:1},
  {ref:'3.1.3',style:'practical',demand:'AO2'},
  {ref:'5.1.2',style:'recall',demand:'AO1'},
  {ref:'5.1.3',style:'data',demand:'AO2',resource:'data_table'},
  {ref:'5.1.4',style:'recall',demand:'AO1'},
  {ref:'5.1.5',style:'statements',demand:'AO2'},
  {ref:'5.2.1',style:'recall',demand:'AO1'},
  {ref:'5.2.2',style:'calculation',demand:'AO2',maths:1},
];

function makePart(n:number,letter:string,refs:string[],marks:number,demand:PlannedPart['demand'],resource:PlannedPart['resource']='none'):PlannedPart {
  const id=`ocr_h420_p1_${n}${letter}`;
  return {partId:id,parentId:`q${n}`,questionNumber:letter?`${n}(${letter})`:String(n),
    topic:OCR_ALEVEL_P1_TOPICS[OCR_ALEVEL_P1_OUTCOMES[refs[0]].topic],specRefs:refs,marks,demand,
    section:letter?'B':'A',responseType:letter?(marks===6?'long_form':'short_answer'):'mcq_single',
    resource,...(resource==='none'?{}:{resourceId:`r_${id}`}),mathsMarks:0,practicalMarks:0,
    assessmentRole:marks===6?'extended_response':'structured'};
}
function mcq(n:number,slot:McqSlot):PlannedPart {
  return {...makePart(n,'',[slot.ref],1,slot.demand,slot.resource),mcqStyle:slot.style,
    mathsMarks:slot.maths??0,practicalMarks:slot.style==='practical'||slot.ref==='2.1.4'?1:0};
}

export function buildOcrAlevelPaper1Plan(mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
  if(tier!=='not_tiered')throw new Error('OCR A-level Biology A is untiered. Foundation and Higher do not apply.');
  if(mode==='custom')return null;
  if(mode!=='full_mock'&&mode!=='short_practice')throw new Error('Unsupported OCR A-level paper mode.');
  const parts:PlannedPart[]=[];
  if(mode==='full_mock'){
    MCQS.forEach((slot,i)=>parts.push(mcq(i+1,slot)));
    const groups = [
      {refs:['2.1.2','2.1.4'],marks:[2,3,3,4],ao:['AO1','AO1','AO2','AO3'],resource:'data_table'},
      {refs:['3.1.1','3.1.2'],marks:[2,2,2,6],ao:['AO1','AO2','AO2','AO2'],resource:'graph'},
      {refs:['2.1.1','2.1.5'],marks:[2,3,3,4],ao:['AO1','AO1','AO2','AO3'],resource:'data_table'},
      {refs:['3.1.3'],marks:[2,3,3,4],ao:['AO1','AO2','AO2','AO3'],resource:'graph'},
      {refs:['5.1.1','5.1.2','5.1.3','5.1.4','5.1.5'],marks:[2,3,4,4],ao:['AO1','AO1','AO2','AO3'],resource:'data_table'},
      {refs:['5.2.1'],marks:[2,2,2,6],ao:['AO1','AO2','AO2','AO2'],resource:'graph'},
      {refs:['5.2.2'],marks:[2,3,3,4],ao:['AO1','AO2','AO2','AO3'],resource:'data_table'},
    ] as const;
    groups.forEach((g,i)=>g.marks.forEach((marks,j)=>{
      const p=makePart(16+i,'abcd'[j],[...g.refs],marks,g.ao[j],j===2?g.resource:'none');
      p.mathsMarks=j===2?2:0;
      p.practicalMarks=(i===0||i===2||i===3||i===5||i===6)&&j>=2?Math.min(marks,2):0;
      if(marks===6)p.aoMarks={AO1:3,AO2:2,AO3:1};
      parts.push(p);
    }));
  }else{
    [MCQS[0],MCQS[3],MCQS[7],MCQS[12],MCQS[13]].forEach((slot,i)=>parts.push(mcq(i+1,slot)));
    [2,3,4].forEach((marks,j)=>parts.push({...makePart(6,'abc'[j],['2.1.4'],marks,j===0?'AO1':j===1?'AO2':'AO3',j===1?'data_table':'none'),mathsMarks:j===1?2:0,practicalMarks:j>0?2:0}));
    [2,3,6].forEach((marks,j)=>parts.push({...makePart(7,'abc'[j],['5.2.1'],marks,j===0?'AO1':'AO2',j===1?'graph':'none'),mathsMarks:j===1?2:0,practicalMarks:j===1?2:0,...(marks===6?{aoMarks:{AO1:3,AO2:2,AO3:1}}:{})}));
  }
  const plan:PaperPlan={...OCR_ALEVEL_P1,tier,mode,parts,totalMarks:parts.reduce((s,p)=>s+p.marks,0),
    parentCount:new Set(parts.map(p=>p.parentId)).size,partCount:parts.length,durationMinutes:mode==='full_mock'?135:34,
    label:`OCR A-level Biology A Paper 1 ${mode==='full_mock'?'full mock':'short practice'}`};
  assertOcrAlevelPaper1Plan(plan);return plan;
}

export function assertOcrAlevelPaper1Plan(plan:PaperPlan):void {
  if(plan.courseId!==OCR_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_1'||plan.componentCode!=='H420/01'||plan.tier!=='not_tiered'||plan.specificationVersion!==OCR_ALEVEL_BIOLOGY_SPECIFICATION||plan.contractVersion!==1)throw new Error('Invalid OCR A-level Paper 1 identity.');
  const count=plan.mode==='full_mock'?15:5;
  const a=plan.parts.filter(p=>p.section==='A'),b=plan.parts.filter(p=>p.section==='B');
  if(a.length!==count||plan.parts.slice(0,count).some((p,i)=>p!==a[i]||p.questionNumber!==String(i+1)||p.marks!==1||p.responseType!=='mcq_single'||!['AO1','AO2'].includes(p.demand))||b.some(p=>p.responseType==='mcq_single')||b[0]?.questionNumber!==`${count+1}(a)`)throw new Error('OCR Section A must precede Section B with consecutive one-mark MCQs.');
  for(const p of plan.parts){
    if(!p.specRefs?.length||p.specRefs.some(ref=>!OCR_ALEVEL_P1_OUTCOMES[ref]||OCR_ALEVEL_P1_TOPICS[OCR_ALEVEL_P1_OUTCOMES[ref].topic]!==p.topic))throw new Error('OCR Paper 1 outcome/topic mismatch.');
    if([p.mathsMarks,p.practicalMarks].some(n=>n===undefined||!Number.isInteger(n)||n<0||n>p.marks))throw new Error('Invalid OCR skill target.');
    if(p.aoMarks&&Object.values(p.aoMarks).reduce((s,n)=>s+(n??0),0)!==p.marks)throw new Error('Invalid OCR AO allocation.');
  }
  if(plan.mode==='full_mock'){
    const ao=['AO1','AO2','AO3'].map(a=>plan.parts.reduce((s,p)=>s+(p.aoMarks?p.aoMarks[a as PlannedPart['demand']]??0:p.demand===a?p.marks:0),0));
    if(plan.totalMarks!==100||plan.durationMinutes!==135||b.reduce((s,p)=>s+p.marks,0)!==85||ao.join('/')!=='36/42/22'||plan.parts.filter(p=>p.marks===6).length!==2||plan.parts.reduce((s,p)=>s+(p.mathsMarks??0),0)<10||plan.parts.reduce((s,p)=>s+(p.practicalMarks??0),0)<15)throw new Error('Invalid OCR Paper 1 marks, time or template demand targets.');
  }else if(plan.mode!=='short_practice'||plan.totalMarks!==25||plan.durationMinutes!==34)throw new Error('Invalid OCR short-practice totals.');
}

export function ocrAlevelPartInstruction(p:PlannedPart,includeOptions=true):string {
  const isMcq=p.responseType==='mcq_single';
  return `Q${p.questionNumber} | Section ${p.section} | ${p.marks} marks | ${p.responseType} | ${p.demand} | topic_tag="${p.topic}" | `+
    (p.specRefs??[]).map(ref=>`${ref}: ${OCR_ALEVEL_P1_OUTCOMES[ref].text}`).join('; ')+
    ' | Choose one coherent task within these outcomes, not every listed outcome. '+
    (isMcq?`question_type="mcq"; MCQ style=${p.mcqStyle}. ${OCR_ALEVEL_MCQ_RULES} ${includeOptions?'Return options and its matching correct_answer.':'TASK REPAIR: use the original fixed choices; do not return or change options.'} `:'question_type="written". ')+
    (p.resource==='none'?'Keep all givens in the stem, no decorative diagram and no dependency on an absent/earlier figure. ':`REQUIRED ${p.resource} as canonical chart_data, with exact givens, units and a neutral caption. It must supply useful evidence for this task without printing its answer. ${questionResourceInstructions('chart_data')} `)+
    (p.mathsMarks?`Target ${p.mathsMarks} mathematical marks. `:'')+(p.practicalMarks?`Target ${p.practicalMarks} practical/enquiry marks. `:'')+
    (p.marks===6?'Private key: task-specific Level 1 (1-2 marks), Level 2 (3-4 marks), Level 3 (5-6 marks), zero for no relevant response and indicative science. Scientific content selects the level, communication selects the mark within it. ':isMcq?'Check all four options; private correct_answer is exactly the ONE correct option text. ':'Private correct_answer: independently creditable points, caps, valid alternatives and exact numerical working consistent with visible data. ')+
    'Never show the private key in the stem or resource.';
}
export function ocrAlevelPaper1Instructions(plan:PaperPlan):string {
  return `${OCR_ALEVEL_P1_RULES}\nSAVED ${plan.componentCode}; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. Return exactly the planned rows with separately stated context and task, question_text, question_number, root_question_number, parent_question_number, marks, question_type, topic_tag and private correct_answer.\n`+plan.parts.map(p=>ocrAlevelPartInstruction(p,true)).join('\n');
}
