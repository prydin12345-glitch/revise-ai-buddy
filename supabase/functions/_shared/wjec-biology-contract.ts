import {WJEC_BIOLOGY_ID} from './assessment-tier.ts';
import type {PaperMode,PaperPlan,PlannedPart} from './paper-contract-types.ts';
import {WJEC_BIOLOGY_SPECIFICATION,WJEC_WRITTEN_UNITS,isWjecWrittenUnit,type WjecBiologyUnit} from './wjec-biology-specification.ts';
import {WJEC_TOPICS,WJEC_OUTCOMES,wjecOutcomeAllowed,wjecBiologyRules,type WjecTopic} from './wjec-biology-scope.ts';
export const WJEC_BIOLOGY_CONTRACT_VERSION=1;
export function wjecBiologyComponent(unit:WjecBiologyUnit,tier:PaperPlan['tier']):string|null {
  if(!isWjecWrittenUnit(unit))throw new Error('Choose WJEC Biology Unit 1 or Unit 2. Unit 3 is a separate practical assessment.');
  return tier==='foundation'||tier==='higher'?WJEC_WRITTEN_UNITS[unit][tier]:null;
}
export function wjecBiologyDefinition(unit:WjecBiologyUnit,tier:PaperPlan['tier']) {
  return {courseId:WJEC_BIOLOGY_ID,paperId:unit,contractVersion:1,specificationVersion:WJEC_BIOLOGY_SPECIFICATION,
    displayName:`WJEC Wales Biology Unit ${unit==='unit_1'?'1':'2'} — ${WJEC_WRITTEN_UNITS[unit].title}`,
    topics:Object.entries(WJEC_TOPICS).filter(([ref])=>ref.startsWith(unit==='unit_1'?'1.':'2.')).map(([,topic])=>topic),
    fullMockMarks:80,fullMockMinutes:105,componentCode:wjecBiologyComponent(unit,tier)};
}
type Group={topic:WjecTopic;refs:string[][];resource:'data_table'|'graph';practical:boolean};
const groupsFor=(unit:WjecBiologyUnit,higher:boolean):Group[]=>unit==='unit_1'?[
  {topic:'1.1',refs:[['1.1a-b'],['1.1c-d'],['1.1e-g'],higher?['1.1h-HT']:['1.1e-g']],resource:'data_table',practical:true},
  {topic:'1.2',refs:[['1.2a-b'],['1.2c-h'],['1.2c-h'],higher?['1.2a-b-HT']:['1.2a-b']],resource:'graph',practical:false},
  {topic:'1.3',refs:[['1.3a-d'],['1.3e-j'],['1.3a-d'],['1.3k-m']],resource:'data_table',practical:true},
  {topic:'1.4',refs:[['1.4a-b'],['1.4c-j'],['1.4c-j'],['1.4c-j']],resource:'data_table',practical:false},
  {topic:'1.5',refs:[['1.5a-d'],['1.5e-g,i-k'],['1.5e-g,i-k'],['1.5e-g,i-k']],resource:'graph',practical:true},
  {topic:'1.6',refs:[['1.6a-c,e-g'],['1.6a-c,e-g'],['1.6a-c,e-g'],higher?['1.6d,h-HT']:['1.6a-c,e-g']],resource:'data_table',practical:false},
  {topic:'1.1',refs:[['1.1i,k-l'],['1.1i,k-l'],['1.1i,k-l'],higher?['1.1j-k-HT']:['1.1i,k-l']],resource:'graph',practical:true},
  {topic:'1.6',refs:[['1.6i-m'],['1.6i-m'],['1.6i-m'],['1.6i-m']],resource:'data_table',practical:true},
]:[
  {topic:'2.1',refs:[['2.1a-e'],['2.1f-g'],['2.1f-g'],higher?['2.1h-HT']:['2.1a-e']],resource:'data_table',practical:true},
  {topic:'2.2',refs:[['2.2a-d'],['2.2e-f'],['2.2a-d'],['2.2e-f']],resource:'data_table',practical:false},
  {topic:'2.3',refs:[['2.3a-b'],['2.3f-j'],['2.3f-j'],higher?['2.3a-b-HT','2.3c-e']:['2.3c-e','2.3f-j']],resource:'data_table',practical:false},
  {topic:'2.4',refs:[['2.4a-g'],['2.4h'],['2.4h'],higher?['2.4a-HT']:['2.4a-g']],resource:'graph',practical:true},
  {topic:'2.5',refs:[['2.5a-c,e-g'],['2.5h-k'],['2.5a-c,e-g'],higher?['2.5d-HT','2.5l-HT']:['2.5h-k']],resource:'graph',practical:true},
  {topic:'2.6',refs:[['2.6a-c,f-g'],['2.6h-j'],['2.6a-c,f-g'],higher?['2.6d-e,g-HT']:['2.6a-c,f-g']],resource:'data_table',practical:true},
  {topic:'2.7',refs:[['2.7a-c'],['2.7d'],['2.7a-c'],['2.7d']],resource:'data_table',practical:true},
  {topic:'2.8',refs:[['2.8a-g,j-n'],['2.8a-g,j-n'],['2.8a-g,j-n'],higher?['2.8h-i-HT','2.8o-p-HT']:['2.8a-g,j-n']],resource:'data_table',practical:false},
];
function part(unit:WjecBiologyUnit,n:number,slot:number,g:Group,marks:number,refs:string[],demand:PlannedPart['demand'],resource:PlannedPart['resource'],mcq=false):PlannedPart {
  const id=`wjec_${unit}_${n}${'abcd'[slot]}`;
  return {partId:id,parentId:`q${n}`,questionNumber:`${n}(${'abcd'[slot]})`,topic:WJEC_TOPICS[g.topic],responseType:mcq?'mcq_single':marks===6?'long_form':'short_answer',
    marks,demand,resource,...(resource==='none'?{}:{resourceId:`r_${id}`}),specRefs:refs,mathsMarks:resource==='none'?0:2,
    practicalMarks:g.practical&&(resource!=='none'||marks===6)?Math.min(3,marks):0};
}
export function buildWjecBiologyPlan(unit:WjecBiologyUnit,mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
  if(!isWjecWrittenUnit(unit))throw new Error('Select WJEC Biology Unit 1 or Unit 2.');
  if(mode==='custom')return null;
  if(mode!=='full_mock'&&mode!=='short_practice')throw new Error('Unknown WJEC paper mode.');
  if(tier!=='foundation'&&tier!=='higher')throw new Error('Choose Foundation or Higher for the WJEC written unit.');
  const groups=groupsFor(unit,tier==='higher'),parts:PlannedPart[]=[];
  if(mode==='full_mock')groups.forEach((g,i)=>{
    const n=i+1,qer=n===3||n===5;
    (qer?[1,1,2,6]:[1,2,3,4]).forEach((marks,j)=>{
      // Whole-mark AO targets are design annotations, not proof of model demand.
      const demand:PlannedPart['demand']=j<2?'AO1':j===2?(n===3?'AO1':'AO2'):qer||n===8?'AO3':[1,4].includes(n)?'AO1':'AO2';
      parts.push(part(unit,n,j,g,marks,g.refs[j],demand,j===2?g.resource:'none',j===0&&[1,2,4,7].includes(n)));
    });
  });
  else (unit==='unit_1'?[0,2,4,5]:[0,2,4,7]).forEach((index,i)=>{
    const g=groups[index],qer=i===2;
    parts.push(part(unit,i+1,0,g,1,g.refs[0],'AO1','none',i===0||i===3));
    parts.push(part(unit,i+1,1,g,2,g.refs[2],'AO2',g.resource));
    parts.push(part(unit,i+1,2,g,qer?6:3,g.refs[3],qer?'AO3':'AO2','none'));
  });
  const totalMarks=parts.reduce((n,p)=>n+p.marks,0);
  const plan:PaperPlan={courseId:WJEC_BIOLOGY_ID,paperId:unit,contractVersion:1,specificationVersion:WJEC_BIOLOGY_SPECIFICATION,tier,mode,
    componentCode:wjecBiologyComponent(unit,tier)!,parts,partCount:parts.length,parentCount:new Set(parts.map(p=>p.parentId)).size,totalMarks,
    durationMinutes:mode==='full_mock'?105:Math.round(totalMarks*105/80),label:`WJEC Wales Biology Unit ${unit==='unit_1'?'1':'2'} ${mode==='full_mock'?'full mock':'short practice'}`};
  assertWjecBiologyPlan(plan);return plan;
}
export function assertWjecBiologyPlan(plan:PaperPlan):void {
  if(plan.courseId!==WJEC_BIOLOGY_ID||!isWjecWrittenUnit(plan.paperId)||!['foundation','higher'].includes(plan.tier??'')||plan.contractVersion!==1||plan.specificationVersion!==WJEC_BIOLOGY_SPECIFICATION)throw new Error('Invalid WJEC unit/tier/specification version.');
  for(const p of plan.parts){
    if(!p.specRefs?.length||p.specRefs.some(ref=>!wjecOutcomeAllowed(ref,plan.paperId as WjecBiologyUnit,plan.tier)||WJEC_TOPICS[WJEC_OUTCOMES[ref].topic]!==p.topic))throw new Error(`WJEC Q${p.questionNumber}: outcome does not match the unit or tier.`);
    if(p.section)throw new Error('WJEC templates have no OCR Section A.');
    if([p.mathsMarks,p.practicalMarks].some(n=>n!==undefined&&(!Number.isInteger(n)||n<0||n>p.marks)))throw new Error('Invalid WJEC skill annotation.');
  }
  if(plan.parts.filter(p=>p.marks===6&&p.responseType==='long_form').length!==(plan.mode==='full_mock'?2:1))throw new Error('WJEC template has lost its QER responses.');
  if(plan.mode==='full_mock'){
    const ao=['AO1','AO2','AO3'].map(a=>plan.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0));
    if(plan.totalMarks!==80||plan.durationMinutes!==105||ao.join('/')!=='32/32/16'||new Set(plan.parts.map(p=>p.topic)).size!==(plan.paperId==='unit_1'?6:8)||
      plan.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)<8||plan.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)<12)throw new Error('Invalid WJEC written-unit totals, coverage or skill targets.');
  }
}
export function wjecPartInstruction(p:PlannedPart,includeOptions=true):string {
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.responseType} | ${p.demand} | topic_tag="${p.topic}" | `+
    (p.specRefs??[]).map(ref=>`${ref}: ${WJEC_OUTCOMES[ref].text}`).join('; ')+
    (p.responseType==='mcq_single'?(includeOptions?' | question_type="mcq"; four distinct options and a private correct_answer matching one.':' | Preserve four MCQ options and their matching key.'):' | question_type="written".')+
    (p.resource==='none'?' | Complete self-contained task; no decorative or answer-revealing image.':` | REQUIRED ${p.resource} in chart_data with real measurements, units and neutral labels; use exactly those values in the task and private working.`)+
    (p.mathsMarks?` | Target ${p.mathsMarks} mathematical marks; supply inputs and a calculation or quantitative interpretation; scaffold Foundation steps.`:'')+
    (p.practicalMarks?` | Target ${p.practicalMarks} scientific-enquiry marks through methods, sampling, controls, evidence or improvements.`:'')+
    (p.marks===6?' | QER: private Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) descriptors with task-specific science AND communication criteria, indicative content and zero for no relevant response. Use holistic best fit, not six facts. Keep the scheme private.':'');
}
export function wjecBiologyInstructions(plan:PaperPlan):string {
  return `${wjecBiologyRules(plan.paperId as WjecBiologyUnit)}\nSAVED TIER ${plan.tier}; component ${plan.componentCode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes.
${plan.mode==='full_mock'?'Full written-unit mock using Examly template v1.':'Short practice samples four unit topics, not the whole official paper.'}
Return only planned rows, in order. Each needs question_number, root_question_number, parent_question_number, context, task, question_text, question_type, marks, topic_tag and private correct_answer. Root/parent numbers are the leading integer as a string. Each scored row needs a complete assessed instruction. Never renumber or invent rows.
${plan.parts.map(p=>wjecPartInstruction(p)).join('\n')}`;
}
