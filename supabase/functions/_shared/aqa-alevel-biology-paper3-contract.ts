import { AQA_ALEVEL_BIOLOGY_ID } from './assessment-tier.ts';
import { AQA_ALEVEL_BIOLOGY_SPECIFICATION } from './aqa-alevel-biology-scope.ts';
import { AQA_ALEVEL_P3_TOPICS, AQA_ALEVEL_P3_OUTCOMES, AQA_ALEVEL_P3_RULES } from './aqa-alevel-biology-paper3-scope.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { questionResourceInstructions } from './question-resource-instructions.ts';
export const AQA_ALEVEL_P3 = {
 courseId:AQA_ALEVEL_BIOLOGY_ID,paperId:'paper_3',contractVersion:1,specificationVersion:AQA_ALEVEL_BIOLOGY_SPECIFICATION,
 componentCode:'7402/3',displayName:'AQA A-level Biology Paper 3',topics:AQA_ALEVEL_P3_TOPICS,fullMockMarks:78,fullMockMinutes:120,
} as const;
function part(n:number,slot:number,topic:number,refs:string[],marks:number,demand:PlannedPart['demand'],resource:PlannedPart['resource']='none',role:PlannedPart['assessmentRole']='structured'):PlannedPart {
 const essay=role==='synoptic_essay',id=`aqa_7402_p3_${n}${essay?'':'abcde'[slot]}`;
 return {partId:id,parentId:`q${n}`,questionNumber:essay?String(n):`${n}(${'abcde'[slot]})`,topic:AQA_ALEVEL_P3_TOPICS[topic],specRefs:refs,
 marks,demand,responseType:essay||marks>=5?'long_form':'short_answer',resource,...(resource==='none'?{}:{resourceId:`r_${id}`}),assessmentRole:role,
 mathsMarks:resource==='data_table'?Math.min(marks,2):0,practicalMarks:essay?0:Math.min(marks,2),...(essay?{aoMarks:{AO1:13,AO2:12,AO3:0}}:{})};
}
export function buildAqaAlevelPaper3Plan(mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
 if(tier!=='not_tiered')throw new Error('AQA A-level Biology is untiered; reapply the A-level profile.');
 if(mode==='custom')return null;if(!['full_mock','short_practice'].includes(mode))throw new Error('Unknown Paper 3 mode.');
 const parts:PlannedPart[]=[];
 if(mode==='full_mock'){
  const groups=[{t:0,r:['3.1.4.2','3.2.3'],m:[2,3,5],d:['AO1','AO2','AO3']},{t:2,r:['3.3.4.1','3.6.1.3'],m:[2,3,5],d:['AO1','AO2','AO2']},{t:4,r:['3.5.1','3.5.2'],m:[2,3,5],d:['AO1','AO2','AO3']},{t:7,r:['3.8.4.1','3.4.2'],m:[2,3,3],d:['AO1','AO1','AO2']}];
  groups.forEach((g,i)=>g.m.forEach((m,j)=>parts.push(part(i+1,j,g.t,g.r,m,g.d[j] as PlannedPart['demand'],j===1?'data_table':'none'))));
  [2,3,3,3,4].forEach((m,j)=>parts.push(part(5,j,6,['3.7.4','3.5.4'],m,'AO3','data_table','critical_analysis')));
  parts.push(part(6,0,0,Object.keys(AQA_ALEVEL_P3_OUTCOMES),25,'AO2','essay_choice','synoptic_essay'));
 }else{
  parts.push(part(1,0,0,['3.1.4.2','3.2.3'],3,'AO2','data_table'),part(1,1,0,['3.1.4.2','3.2.3'],5,'AO3'));
  [3,4].forEach((m,j)=>parts.push(part(2,j,6,['3.7.4','3.5.4'],m,'AO3','data_table','critical_analysis')));
  parts.push(part(3,0,0,Object.keys(AQA_ALEVEL_P3_OUTCOMES),25,'AO2','essay_choice','synoptic_essay'));
 }
 const plan:PaperPlan={...AQA_ALEVEL_P3,mode,tier,parts,totalMarks:parts.reduce((s,p)=>s+p.marks,0),parentCount:new Set(parts.map(p=>p.parentId)).size,partCount:parts.length,
 durationMinutes:mode==='full_mock'?120:70,label:`AQA A-level Biology Paper 3 ${mode==='full_mock'?'full mock':'short practice'}`};
 assertAqaAlevelPaper3Plan(plan);return plan;
}
export function assertAqaAlevelPaper3Plan(plan:PaperPlan):void {
 if(plan.courseId!==AQA_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_3'||plan.tier!=='not_tiered'||plan.componentCode!=='7402/3'||plan.contractVersion!==1||plan.specificationVersion!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('Invalid Paper 3 course/component/edition.');
 for(const p of plan.parts){
  if(!AQA_ALEVEL_P3_TOPICS.includes(p.topic as any)||!p.specRefs?.length||p.specRefs.some(r=>!AQA_ALEVEL_P3_OUTCOMES[r]))throw new Error(`Paper 3 Q${p.questionNumber}: invalid outcome/topic.`);
  if(p.section||p.responseType==='mcq_single'||!['structured','critical_analysis','synoptic_essay'].includes(p.assessmentRole??''))throw new Error('Invalid Paper 3 role.');
  if((p.resource==='essay_choice')!==(p.assessmentRole==='synoptic_essay')||(p.assessmentRole==='critical_analysis'&&p.resource!=='data_table'))throw new Error('Invalid Paper 3 resource/role.');
  if([p.mathsMarks,p.practicalMarks].some(n=>n===undefined||!Number.isInteger(n)||n<0||n>p.marks))throw new Error('Invalid Paper 3 skill annotation.');
 }
 const marks=(role:string)=>plan.parts.filter(p=>p.assessmentRole===role).reduce((s,p)=>s+p.marks,0),full=plan.mode==='full_mock';
 const essays=plan.parts.filter(p=>p.assessmentRole==='synoptic_essay');
 if(essays.length!==1||essays[0].marks!==25||essays[0].responseType!=='long_form'||JSON.stringify(essays[0].aoMarks)!==JSON.stringify({AO1:13,AO2:12,AO3:0})||marks('structured')!==(full?38:8)||marks('critical_analysis')!==(full?15:7)||plan.totalMarks!==(full?78:40)||plan.durationMinutes!==(full?120:70))throw new Error('Invalid Paper 3 assessment split or essay.');
 if(full){const ao=['AO1','AO2','AO3'].map(a=>plan.parts.reduce((s,p)=>s+(p.aoMarks?.[a as PlannedPart['demand']]??(p.demand===a?p.marks:0)),0));if(ao.join('/')!=='24/29/25')throw new Error('Invalid Paper 3 AO targets.');}
}
export function aqaAlevelPaper3PartInstruction(p:PlannedPart):string {
 const prefix=`Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.assessmentRole} | topic_tag="${p.topic}" | question_type="written". `;
 if(p.assessmentRole==='synoptic_essay')return prefix+`Return ONE scored row with task="Write an essay on ONE of the two titles. Indicate your chosen title A or B." Do not emit two scored essays, subparts or MCQ options. chart_data MUST be {"type":"biology_essay_choice","version":1,"titles":[{"id":"A","title":"..."},{"id":"B","title":"..."}]}. Two distinct original broad synoptic titles must each support at least four distinct biological topic areas drawn from Topics 1–8; do not turn them into narrow six-mark tasks. Public titles contain NO indicative answers or hints. Private correct_answer MUST be a JSON object {"type":"biology_essay_key","version":1,"titles":[{"id":"A","title":"exact public title A","areas":[{"specRef":"3.1.4.2","content":"Detailed relevant A-level biological mechanism...","link":"Explain its relationship to this essay title..."}]},{"id":"B","title":"exact public title B","areas":[...]}]}. Supply 4–10 detailed areas per title, each with a valid specRef from ${Object.keys(AQA_ALEVEL_P3_OUTCOMES).join(', ')}. Several areas means at least four distinct 3.x.y topics, not four chapters. This is indicative content, not 25 independent marking points. The server applies the five-band holistic rubric; no GCSE three-level or legacy 16+3+3+3 rubric. Keep explanations concise enough for one bounded parent-group response.`;
 return prefix+(p.specRefs??[]).map(r=>`${r}: ${AQA_ALEVEL_P3_OUTCOMES[r].text}`).join('; ')+'. Select a coherent assessed task from this pool, not every outcome at once. '+
  (p.resource==='none'?'Keep the task self-contained; no unseen figure dependency. ':`REQUIRED chart_data: canonical data_table with headers, rows and units. ${questionResourceInstructions('chart_data')} `)+
  (p.assessmentRole==='critical_analysis'?`Every sibling in ${p.parentId} MUST carry exactly the SAME full table (headers, rows, units, caption) from ONE experimental investigation. Supply method, controls, sample sizes and measured variability/uncertainty; analyse evidence, limitations and improvements, not recall. Completion/repair must retain given siblings' data or rewrite the entire group and keys coherently. `:'')+
  (p.mathsMarks?`Target ${p.mathsMarks} mathematical marks requiring calculation/quantitative reasoning. `:'')+`Private correct_answer: task-specific creditable points and working, alternatives and caps totalling ${p.marks}; no essay rubric for this row.`;
}
export function aqaAlevelPaper3Instructions(plan:PaperPlan):string {
 return `${AQA_ALEVEL_P3_RULES}\nSAVED ${plan.componentCode}; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. Return only planned rows with question_number, root_question_number, parent_question_number, context, task, question_text, question_type, marks, topic_tag and private correct_answer; never renumber.\n`+plan.parts.map(aqaAlevelPaper3PartInstruction).join('\n');
}
