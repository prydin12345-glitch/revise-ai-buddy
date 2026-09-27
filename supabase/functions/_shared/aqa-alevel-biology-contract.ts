import { AQA_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { AQA_ALEVEL_BIOLOGY_SPECIFICATION, AQA_ALEVEL_P1_TOPICS, AQA_ALEVEL_P1_OUTCOMES, AQA_ALEVEL_P1_RULES } from './aqa-alevel-biology-scope.ts';

export const AQA_ALEVEL_P1 = {
  courseId:AQA_ALEVEL_BIOLOGY_ID,paperId:'paper_1',contractVersion:1,
  specificationVersion:AQA_ALEVEL_BIOLOGY_SPECIFICATION,componentCode:'7402/1',
  displayName:'AQA A-level Biology Paper 1',topics:AQA_ALEVEL_P1_TOPICS,
  fullMockMarks:91,fullMockMinutes:120,
} as const;

type Group = {topic:number; refs:string[]; resource:'graph'|'data_table'; practical:boolean};
const GROUPS: readonly Group[] = [
  {topic:0,refs:['3.1.4.1','3.1.4.2'],resource:'graph',practical:true},
  {topic:1,refs:['3.2.1','3.2.2'],resource:'data_table',practical:true},
  {topic:1,refs:['3.2.3'],resource:'graph',practical:true},
  {topic:2,refs:['3.3.1','3.3.2','3.3.3'],resource:'data_table',practical:false},
  {topic:2,refs:['3.3.4.1','3.3.4.2'],resource:'graph',practical:true},
  {topic:3,refs:['3.4.1','3.4.2','3.4.3'],resource:'data_table',practical:false},
  {topic:3,refs:['3.4.4'],resource:'data_table',practical:true},
];
function part(n:number,slot:number,topic:number,refs:string[],marks:number,demand:PlannedPart['demand'],resource:PlannedPart['resource']='none',practical=false,extended=false):PlannedPart {
  const id=`aqa_7402_p1_${n}${'abcd'[slot]}`;
  return {partId:id,parentId:`q${n}`,questionNumber:`${n}(${'abcd'[slot]})`,topic:AQA_ALEVEL_P1_TOPICS[topic],
    specRefs:refs,marks,demand,responseType:extended?'long_form':'short_answer',resource,
    ...(resource==='none'?{}:{resourceId:`r_${id}`}),assessmentRole:extended?'extended_response':'structured',
    mathsMarks:resource==='none'?0:Math.min(marks,2),practicalMarks:practical?Math.min(marks,3):0};
}

export function buildAqaAlevelPaper1Plan(mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
  if(tier!=='not_tiered')throw new Error('AQA A-level Biology is untiered. Reapply the A-level profile; do not select Foundation or Higher.');
  if(mode==='custom')return null;
  if(mode!=='full_mock'&&mode!=='short_practice')throw new Error('Unknown A-level paper mode.');
  const parts:PlannedPart[]=[];
  if(mode==='full_mock'){
    GROUPS.forEach((g,i)=>[2,2,3,3].forEach((marks,j)=>{
      const demand:PlannedPart['demand']=j<2?'AO1':j===2?'AO2':i===2?'AO1':i===4?'AO2':'AO3';
      parts.push(part(i+1,j,g.topic,g.refs,marks,demand,j===2?g.resource:'none',g.practical&&j>=2));
    }));
    [1,2,3].forEach((marks,j)=>parts.push(part(8,j,3,['3.4.5','3.4.6','3.4.7'],marks,'AO1')));
    parts.push(part(9,0,0,['3.1.2','3.1.3','3.1.5.1','3.1.5.2','3.1.6','3.1.7','3.1.8'],5,'AO1','none',false,true));
    parts.push(part(9,1,1,['3.2.4'],5,'AO2','none',false,true));
    parts.push(part(9,2,3,['3.4.3','3.4.4','3.4.6','3.4.7'],5,'AO3','none',false,true));
  }else{
    [GROUPS[0],GROUPS[2],GROUPS[4],GROUPS[5]].forEach((g,i)=>{
      parts.push(part(i+1,0,g.topic,g.refs,2,'AO2',g.resource,g.practical));
      parts.push(part(i+1,1,g.topic,g.refs,i===3?5:4,i===3?'AO3':'AO1','none',false,i===3));
    });
  }
  const totalMarks=parts.reduce((sum,p)=>sum+p.marks,0);
  const plan:PaperPlan={...AQA_ALEVEL_P1,tier,mode,parts,totalMarks,parentCount:new Set(parts.map(p=>p.parentId)).size,
    partCount:parts.length,durationMinutes:mode==='full_mock'?120:Math.round(totalMarks*120/91),
    label:`AQA A-level Biology Paper 1 ${mode==='full_mock'?'full mock':'short practice'}`};
  assertAqaAlevelPaper1Plan(plan);return plan;
}

export function assertAqaAlevelPaper1Plan(plan:PaperPlan):void {
  if(plan.courseId!==AQA_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_1'||plan.tier!=='not_tiered'||plan.componentCode!=='7402/1'||plan.contractVersion!==1||plan.specificationVersion!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('Invalid AQA A-level Paper 1 course/component/edition.');
  for(const p of plan.parts){
    if(!p.specRefs?.length||p.specRefs.some(ref=>!AQA_ALEVEL_P1_OUTCOMES[ref]||AQA_ALEVEL_P1_TOPICS[AQA_ALEVEL_P1_OUTCOMES[ref].topic]!==p.topic))throw new Error(`A-level Q${p.questionNumber}: wrong outcome/topic.`);
    if(p.section||p.responseType==='mcq_single'||!['structured','extended_response'].includes(p.assessmentRole??''))throw new Error('Invalid A-level Paper 1 assessment role.');
    if([p.mathsMarks,p.practicalMarks].some(n=>n===undefined||!Number.isInteger(n)||n<0||n>p.marks))throw new Error('Invalid A-level skill annotation.');
  }
  if(plan.mode==='full_mock'){
    const ao=['AO1','AO2','AO3'].map(a=>plan.parts.filter(p=>p.demand===a).reduce((s,p)=>s+p.marks,0));
    const extended=plan.parts.filter(p=>p.assessmentRole==='extended_response').reduce((s,p)=>s+p.marks,0);
    if(plan.totalMarks!==91||plan.durationMinutes!==120||extended!==15||ao.join('/')!=='42/29/20'||
      plan.parts.reduce((s,p)=>s+(p.mathsMarks??0),0)<10||plan.parts.reduce((s,p)=>s+(p.practicalMarks??0),0)<14)throw new Error('Invalid A-level Paper 1 marks, time, 76+15 split or skill targets.');
  }
}

export function aqaAlevelPartInstruction(p:PlannedPart):string {
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | ${p.assessmentRole} | topic_tag="${p.topic}" | `+
    (p.specRefs??[]).map(ref=>`${ref}: ${AQA_ALEVEL_P1_OUTCOMES[ref].text}`).join('; ')+
    ' | question_type="written". Choose a coherent task within these outcomes; do not try to assess every listed outcome in one part. '+
    (p.resource==='none'?'Use a self-contained task, without a decorative figure.':`REQUIRED ${p.resource} in canonical chart_data with measured values, units, neutral labels and sufficient inputs; all private working must use exactly this data. `)+
    (p.mathsMarks?`Target ${p.mathsMarks} mathematical marks in the assessed instruction. `:'')+
    (p.practicalMarks?`Target ${p.practicalMarks} enquiry marks using methods, variables, evidence or evaluation. `:'')+
    (p.assessmentRole==='extended_response'?'Require a developed biological explanation/evaluation, not a GCSE recall list. ':'')+
    `Private correct_answer: task-specific marking points and caps totalling ${p.marks}, acceptable alternatives and numerical working where relevant. No three-level GCSE rubric. Never expose the key in a resource or stem.`;
}

export function aqaAlevelPaper1Instructions(plan:PaperPlan):string {
  return `${AQA_ALEVEL_P1_RULES}\nSAVED ${plan.componentCode}, untiered; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes.
Return exactly the planned rows in order. Include question_number, root_question_number, parent_question_number, context, task, question_text, question_type, marks, topic_tag and private correct_answer. Every scored part has its own explicit instruction. Never renumber or invent rows.\n`+plan.parts.map(aqaAlevelPartInstruction).join('\n');
}
