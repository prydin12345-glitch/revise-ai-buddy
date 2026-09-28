import { AQA_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';
import { AQA_ALEVEL_BIOLOGY_SPECIFICATION } from './aqa-alevel-biology-scope.ts';
import { AQA_ALEVEL_P2_TOPICS, AQA_ALEVEL_P2_OUTCOMES, AQA_ALEVEL_P2_RULES } from './aqa-alevel-biology-paper2-scope.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { questionResourceInstructions } from './question-resource-instructions.ts';

export const AQA_ALEVEL_P2 = {
  courseId:AQA_ALEVEL_BIOLOGY_ID,paperId:'paper_2',contractVersion:1,
  specificationVersion:AQA_ALEVEL_BIOLOGY_SPECIFICATION,componentCode:'7402/2',
  displayName:'AQA A-level Biology Paper 2',topics:AQA_ALEVEL_P2_TOPICS,fullMockMarks:91,fullMockMinutes:120,
} as const;
const GROUPS = [
  {topic:0,refs:['3.5.1'],resource:'graph',practical:true},
  {topic:0,refs:['3.5.2','3.5.3','3.5.4'],resource:'data_table',practical:true},
  {topic:1,refs:['3.6.1.1','3.6.1.2','3.6.1.3','3.6.2.1','3.6.2.2','3.6.3'],resource:'graph',practical:true},
  {topic:1,refs:['3.6.4.1','3.6.4.2','3.6.4.3'],resource:'graph',practical:true},
  {topic:2,refs:['3.7.1','3.7.2'],resource:'data_table',practical:false},
  {topic:2,refs:['3.7.3','3.7.4'],resource:'data_table',practical:true},
] as const;
function part(n:number,slot:number,topic:number,refs:readonly string[],marks:number,demand:PlannedPart['demand'],resource:PlannedPart['resource']='none',practical=false):PlannedPart {
  const id=`aqa_7402_p2_${n}${'abcde'[slot]}`;
  return {partId:id,parentId:`q${n}`,questionNumber:`${n}(${'abcde'[slot]})`,topic:AQA_ALEVEL_P2_TOPICS[topic],specRefs:[...refs],marks,demand,
    responseType:marks>=6?'long_form':'short_answer',resource,...(resource==='none'?{}:{resourceId:`r_${id}`}),
    assessmentRole:resource==='passage'?'comprehension':'structured',
    mathsMarks:resource==='graph'||resource==='data_table'?Math.min(marks,2):0,practicalMarks:practical?Math.min(marks,3):0};
}
export function buildAqaAlevelPaper2Plan(mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
  if(tier!=='not_tiered')throw new Error('AQA A-level Biology is untiered; reapply the A-level profile.');
  if(mode==='custom')return null;
  if(mode!=='full_mock'&&mode!=='short_practice')throw new Error('Unknown A-level paper mode.');
  const parts:PlannedPart[]=[];
  if(mode==='full_mock'){
    GROUPS.forEach((g,i)=>[2,2,3,3].forEach((marks,j)=>parts.push(part(i+1,j,g.topic,g.refs,marks,j===0?'AO1':j===3&&i!==5?'AO3':'AO2',j===2?g.resource:'none',g.practical&&j>=2))));
    [2,2,6].forEach((marks,j)=>parts.push(part(7,j,3,['3.8.1','3.8.2.1','3.8.2.2','3.8.2.3'],marks,j===2?'AO2':'AO1')));
    [1,2,3].forEach((marks,j)=>parts.push(part(8,j,3,['3.8.3','3.8.4.1','3.8.4.2','3.8.4.3'],marks,j===2?'AO2':'AO1')));
    [2,3,3,3,4].forEach((marks,j)=>parts.push(part(9,j,3,['3.8.2.2','3.8.2.3','3.8.4.1','3.8.4.2'],marks,j<2?'AO1':j===3?'AO3':'AO2','passage')));
  }else{
    [GROUPS[0],GROUPS[3],GROUPS[4]].forEach((g,i)=>{
      parts.push(part(i+1,0,g.topic,g.refs,i===2?2:3,'AO2',g.resource,g.practical));
      parts.push(part(i+1,1,g.topic,g.refs,3,'AO2'));
    });
    [2,3,3].forEach((marks,j)=>parts.push(part(4,j,3,['3.8.2.2','3.8.2.3','3.8.4.1','3.8.4.2'],marks,j===0?'AO1':j===1?'AO2':'AO3','passage')));
  }
  const totalMarks=parts.reduce((s,p)=>s+p.marks,0);
  const plan:PaperPlan={...AQA_ALEVEL_P2,tier,mode,parts,totalMarks,parentCount:new Set(parts.map(p=>p.parentId)).size,partCount:parts.length,
    durationMinutes:mode==='full_mock'?120:Math.round(totalMarks*120/91),label:`AQA A-level Biology Paper 2 ${mode==='full_mock'?'full mock':'short practice'}`};
  assertAqaAlevelPaper2Plan(plan);return plan;
}
export function assertAqaAlevelPaper2Plan(plan:PaperPlan):void {
  if(plan.courseId!==AQA_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_2'||plan.tier!=='not_tiered'||plan.componentCode!=='7402/2'||plan.contractVersion!==1||plan.specificationVersion!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('Invalid AQA A-level Paper 2 course/component/edition.');
  for(const p of plan.parts){
    if(!p.specRefs?.length||p.specRefs.some(r=>!AQA_ALEVEL_P2_OUTCOMES[r]||AQA_ALEVEL_P2_TOPICS[AQA_ALEVEL_P2_OUTCOMES[r].topic]!==p.topic))throw new Error(`Paper 2 Q${p.questionNumber}: wrong outcome/topic.`);
    if(p.section||p.responseType==='mcq_single'||!['structured','comprehension'].includes(p.assessmentRole??'')||((p.resource==='passage')!==(p.assessmentRole==='comprehension')))throw new Error('Invalid Paper 2 assessment role/resource.');
    if([p.mathsMarks,p.practicalMarks].some(n=>n===undefined||!Number.isInteger(n)||n<0||n>p.marks))throw new Error('Invalid Paper 2 skill annotation.');
  }
  const reading=plan.parts.filter(p=>p.assessmentRole==='comprehension');
  if(new Set(reading.map(p=>p.parentId)).size!==1||reading.reduce((s,p)=>s+p.marks,0)!==(plan.mode==='full_mock'?15:8))throw new Error('Paper 2 requires one complete comprehension group.');
  if(plan.mode==='full_mock'){
    const ao=['AO1','AO2','AO3'].map(a=>plan.parts.filter(p=>p.demand===a).reduce((s,p)=>s+p.marks,0));
    if(plan.totalMarks!==91||plan.durationMinutes!==120||ao.join('/')!=='24/49/18'||plan.parts.reduce((s,p)=>s+(p.mathsMarks??0),0)<10||plan.parts.reduce((s,p)=>s+(p.practicalMarks??0),0)<14)throw new Error('Invalid Paper 2 totals, 76+15 split or skill targets.');
  }
}
export function aqaAlevelPaper2PartInstruction(p:PlannedPart):string {
  const reading=p.assessmentRole==='comprehension';
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | ${p.assessmentRole} | topic_tag="${p.topic}" | `+
    (p.specRefs??[]).map(r=>`${r}: ${AQA_ALEVEL_P2_OUTCOMES[r].text}`).join('; ')+
    ' | question_type="written". Select a coherent assessed task from this pool, not every outcome at once. '+
    (reading?`All parts of parent ${p.parentId} use ONE original reading passage. On part (a), chart_data must be {"type":"biology_comprehension","resourceId":"${p.parentId}_reading","title":"...","paragraphs":["...","..."]}; all other parts use {"type":"biology_comprehension_ref","resourceId":"${p.parentId}_reading"}. Use 4–8 numbered paragraphs and 350–650 words for a full mock; 3–5 paragraphs and 180–350 words for short practice. These are Examly length targets. No markdown/HTML, private keys or answer fields inside this payload. A completion batch missing (a) must reuse the source supplied in its siblings, without changing it. State the specific paragraph(s) in each assessed task and make the question depend meaningfully on this source. `:
      p.resource==='none'?'Keep the task self-contained; no dependency on a figure/table owned by a different part. ':`REQUIRED ${p.resource} in chart_data with measured values/units; the private key must use this exact data. ${questionResourceInstructions('chart_data')} `)+
    (p.mathsMarks?`Target ${p.mathsMarks} mathematical marks. `:'')+(p.practicalMarks?`Target ${p.practicalMarks} enquiry marks using methods, variables or evidence. `:'')+
    `Private correct_answer: independently creditable points, explicit caps totalling ${p.marks}, acceptable alternatives and working. No GCSE levels or Paper 3 essay rubric.`;
}
export function aqaAlevelPaper2Instructions(plan:PaperPlan):string {
  return `${AQA_ALEVEL_P2_RULES}\nSAVED ${plan.componentCode}, untiered; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes.
Return exactly the planned rows with question_number, root_question_number, parent_question_number, context, task, question_text, question_type, marks, topic_tag and private correct_answer. Every part has an explicit instruction. Never renumber or invent rows.\n`+plan.parts.map(aqaAlevelPaper2PartInstruction).join('\n');
}
