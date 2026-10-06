import {OCR_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {OCR_ALEVEL_BIOLOGY_SPECIFICATION} from './ocr-alevel-biology-scope.ts';
import {OCR_ALEVEL_P3_TOPICS,OCR_ALEVEL_P3_OUTCOMES,OCR_ALEVEL_P3_RULES} from './ocr-alevel-biology-paper3-scope.ts';
import type {PaperMode,PaperPlan,PlannedPart} from './paper-contract-types.ts';
import {questionResourceInstructions} from './question-resource-instructions.ts';

export const OCR_ALEVEL_P3 = {courseId:OCR_ALEVEL_BIOLOGY_ID,paperId:'paper_3',contractVersion:1,
  specificationVersion:OCR_ALEVEL_BIOLOGY_SPECIFICATION,componentCode:'H420/03',
  displayName:'OCR A-level Biology A Paper 3 — Unified biology',topics:OCR_ALEVEL_P3_TOPICS,fullMockMarks:70,fullMockMinutes:90} as const;
export type UnifiedSkill = 'application'|'plotting'|'calculation'|'statistical_analysis'|'test_selection'|'evaluation'|'extended_response';
export interface UnifiedPart extends PlannedPart {unifiedContext:string; unifiedSkill:UnifiedSkill; sharedDataset?:string;}
interface Group {context:string; refs:string[]; marks:number[]; demands:PlannedPart['demand'][];
  skills:UnifiedSkill[]; resources:PlannedPart['resource'][];}
const FULL:Group[] = [
  {context:'Respiratory enzyme activity, microbial decomposition and environmental temperature',refs:['2.1.4','5.2.2','6.3.1','1.1.3','1.1.4'],marks:[2,3,3,4],demands:['AO1','AO2','AO2','AO3'],skills:['application','plotting','calculation','evaluation'],resources:['none','data_table','data_table','none']},
  {context:'Plant water transport, photosynthesis and ecological competition under water stress',refs:['3.1.3','5.2.1','6.3.2','1.1.3','1.1.4'],marks:[2,2,2,6],demands:['AO1','AO2','AO2','AO2'],skills:['application','calculation','calculation','extended_response'],resources:['none','graph','none','none']},
  {context:'Inherited protein variation, disease resistance and population evidence',refs:['2.1.3','4.1.1','6.1.2','1.1.3','1.1.4'],marks:[2,3,3,4],demands:['AO1','AO3','AO2','AO3'],skills:['application','evaluation','statistical_analysis','evaluation'],resources:['none','none','data_table','none']},
  {context:'Biotechnology enzyme measurements and metabolic regulation',refs:['2.1.4','5.1.4','6.2.1','1.1.1','1.1.4'],marks:[2,3,3,4],demands:['AO1','AO3','AO2','AO3'],skills:['application','evaluation','calculation','evaluation'],resources:['none','data_table','data_table','none']},
  {context:'Gas exchange and circulation during infection and immune responses',refs:['3.1.1','3.1.2','4.1.1','2.1.6','1.1.3','1.1.4'],marks:[2,2,2,6],demands:['AO1','AO2','AO2','AO3'],skills:['application','calculation','calculation','extended_response'],resources:['none','graph','none','none']},
  {context:'Population sampling, selection and ecosystem responses to environmental change',refs:['4.2.1','6.3.1','6.1.2','5.2.1','1.1.1','1.1.3','1.1.4'],marks:[2,2,3,3],demands:['AO1','AO2','AO3','AO3'],skills:['application','application','calculation','test_selection'],resources:['none','data_table','data_table','none']},
];
const SHORT:Group[] = [
  {context:'Plant water transport, photosynthesis and enzyme investigations',refs:['3.1.3','5.2.1','2.1.4','1.1.3','1.1.4'],marks:[2,3,5],demands:['AO1','AO2','AO3'],skills:['application','plotting','evaluation'],resources:['none','data_table','none']},
  {context:'Inherited variation, infection resistance and population data',refs:['4.1.1','6.1.2','2.1.3','1.1.3','1.1.4'],marks:[2,2,6],demands:['AO1','AO2','AO3'],skills:['application','statistical_analysis','extended_response'],resources:['none','data_table','none']},
];

export function buildOcrAlevelPaper3Plan(mode:PaperMode,tier:PaperPlan['tier']):PaperPlan|null {
  if(tier!=='not_tiered')throw new Error('OCR A-level Biology A is untiered.');
  if(mode==='custom')return null;
  if(mode!=='full_mock'&&mode!=='short_practice')throw new Error('Unknown H420/03 mode.');
  const parts:UnifiedPart[]=[];
  (mode==='full_mock'?FULL:SHORT).forEach((g,i)=>g.marks.forEach((marks,j)=>{
    const n=i+1,letter='abcd'[j],id=`ocr_h420_p3_${n}${letter}`,skill=g.skills[j],resource=g.resources[j];
    parts.push({partId:id,parentId:`q${n}`,questionNumber:`${n}(${letter})`,topic:OCR_ALEVEL_P3_TOPICS[OCR_ALEVEL_P3_OUTCOMES[g.refs[0]].topic],
      specRefs:[...g.refs],marks,demand:g.demands[j],responseType:marks>=5?'long_form':'short_answer',resource,
      ...(resource==='none'?{}:{resourceId:`r_${id}`}),unifiedContext:g.context,unifiedSkill:skill,
      ...(resource==='data_table'&&g.resources.filter(r=>r==='data_table').length>1?{sharedDataset:`experiment_${n}`} : {}),
      mathsMarks:['plotting','calculation','statistical_analysis'].includes(skill)?Math.min(marks,2):0,
      practicalMarks:['plotting','statistical_analysis','test_selection','evaluation'].includes(skill)?Math.min(marks,2):0,
      assessmentRole:marks===6?'extended_response':'structured',
      ...(marks===6?{aoMarks:{AO1:1,AO2:3,AO3:2}}:{}),
      ...(mode==='full_mock'&&n===4&&j===1?{aoMarks:{AO1:1,AO3:2}}:{}),
      ...(mode==='full_mock'&&n===6&&j===3?{aoMarks:{AO2:1,AO3:2}}:{})});
  }));
  const plan:PaperPlan={...OCR_ALEVEL_P3,mode,tier,parts,parentCount:mode==='full_mock'?6:2,partCount:parts.length,
    totalMarks:parts.reduce((s,p)=>s+p.marks,0),durationMinutes:mode==='full_mock'?90:26,
    label:`OCR A-level Biology A Paper 3 ${mode==='full_mock'?'full mock (Examly template)':'short practice (Examly development template)'}`};
  assertOcrAlevelPaper3Plan(plan);return plan;
}
export function assertOcrAlevelPaper3Plan(plan:PaperPlan):void {
  const full=plan.mode==='full_mock',parts=plan.parts as UnifiedPart[];
  if(plan.courseId!==OCR_ALEVEL_BIOLOGY_ID||plan.paperId!=='paper_3'||plan.componentCode!=='H420/03'||plan.specificationVersion!==OCR_ALEVEL_BIOLOGY_SPECIFICATION||plan.contractVersion!==1||plan.tier!=='not_tiered'||!['full_mock','short_practice'].includes(plan.mode))throw new Error('Invalid Unified biology identity.');
  if(plan.totalMarks!==(full?70:20)||parts.reduce((s,p)=>s+p.marks,0)!==plan.totalMarks||plan.durationMinutes!==(full?90:26)||plan.parentCount!==(full?6:2)||plan.partCount!==(full?24:6)||parts.length!==plan.partCount)throw new Error('Invalid Unified biology totals/distribution.');
  const modules=new Set(parts.flatMap(p=>p.specRefs??[]).map(r=>r[0]));
  if([1,2,3,4,5,6].some(m=>!modules.has(String(m))))throw new Error('Unified biology must cover Modules 1–6.');
  for(const p of parts){
    if(p.section||p.mcqStyle||p.responseType==='mcq_single'||!p.unifiedContext||!p.unifiedSkill||!p.specRefs?.length||p.specRefs.some(r=>!OCR_ALEVEL_P3_OUTCOMES[r])||p.topic!==OCR_ALEVEL_P3_TOPICS[OCR_ALEVEL_P3_OUTCOMES[p.specRefs[0]].topic])throw new Error('Invalid Unified biology outcome/response plan.');
    if([p.mathsMarks,p.practicalMarks].some(n=>n===undefined||!Number.isInteger(n)||n<0||n>p.marks)||p.aoMarks&&Object.values(p.aoMarks).reduce((s,n)=>s+(n??0),0)!==p.marks)throw new Error('Invalid Unified biology skill/AO annotations.');
  }
  for(const parent of new Set(parts.map(p=>p.parentId))){
    const group=parts.filter(p=>p.parentId===parent),contentModules=new Set(group.flatMap(p=>p.specRefs??[]).filter(r=>!r.startsWith('1.')).map(r=>r[0]));
    if(contentModules.size<2||new Set(group.map(p=>p.unifiedContext)).size!==1||!group.some(p=>p.demand==='AO3'||(p.aoMarks?.AO3??0)>0))throw new Error('Unified parents must connect content modules in one evaluated context.');
  }
  if(!parts.some(p=>p.unifiedSkill==='plotting')||!parts.some(p=>p.unifiedSkill==='statistical_analysis')||parts.reduce((s,p)=>s+(p.mathsMarks??0),0)<(full?7:2)||parts.reduce((s,p)=>s+(p.practicalMarks??0),0)<(full?11:4)||parts.filter(p=>p.marks===6).length!==(full?2:1))throw new Error('Unified biology needs practical/mathematical, plotting/statistical and extended demand.');
  if(full){const ao=['AO1','AO2','AO3'].map(a=>parts.reduce((s,p)=>s+(p.aoMarks?.[a as PlannedPart['demand']]??(p.demand===a?p.marks:0)),0));if(ao.join('/')!=='15/29/26')throw new Error('Invalid Unified biology AO targets.');}
}
export function ocrAlevelPaper3PartInstruction(part:PlannedPart):string {
  const p=part as UnifiedPart;
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.demand} | topic_tag="${p.topic}" | question_type="${p.responseType==='long_form'?'written':'short_answer'}". `+
    `Unified parent ${p.parentId}: ${p.unifiedContext}. Preserve this ONE shared investigation and link these outcomes: `+
    (p.specRefs??[]).map(r=>`${r}: ${OCR_ALEVEL_P3_OUTCOMES[r].text}`).join('; ')+'. '+
    `Assessed focus: ${p.unifiedSkill}. At least one application/evaluation sibling must require linked mechanisms from two content modules with matching private credit, not isolated recall. `+
    (p.resource==='none'?'Self-contained visible givens; no dependency on another part/hidden graph. ':`REQUIRED canonical chart_data ${p.resource}, id ${p.resourceId}. ${p.sharedDataset?`Shared observations ${p.sharedDataset}: repeat the SAME given headers, rows, units and caption on each dependent sibling, never a second copy within one part. `:''}${questionResourceInstructions('chart_data')} `)+
    (p.unifiedSkill==='plotting'?'Ask the student to plot a graph from the supplied two-column numerical table and represent at least three distinct x observations. The existing response grid supplies axes and an initial scale derived from those PUBLIC givens, not answers. Assess accurate plotting and appropriate line/curve, not editable axis-label controls that are unavailable. Do not return a completed plotted answer; retain drawing/written method marks. ':p.unifiedSkill==='statistical_analysis'?'Provide observed/expected count columns for a fixed-model goodness-of-fit chi-squared calculation and evidence-based conclusion (2–11 categories, no model parameters estimated from this sample). Give χ² = Σ((O − E)²/E), define O/E, state the null hypothesis, significance level 5%, degrees of freedom = categories minus one and matching numeric critical value in context/caption. Observed and expected totals must agree; all expected counts at least five. Private key must include working and "Final statistic: <number>" matching the table, comparison and appropriate conclusion. ':'')+
    (p.unifiedSkill==='test_selection'?'State the measured variables, pairing/independence and sampling context. Ask for an appropriate statistical test and justified selection; do not give its name as the answer in the public context. ':'')+
    `Target ${p.mathsMarks} mathematical and ${p.practicalMarks} practical marks. Return separate context and explicit task. `+
    (p.marks===6?'Private key: task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), indicative science and zero; science sets level, communication sets mark within level. ':`Private key: independently creditable points, working, units, alternatives and caps totalling ${p.marks}. `)+
    'Never include private marking or calculated answers in student text/resources. Do not change the numbered part or its demand.';
}
export function ocrAlevelPaper3Instructions(plan:PaperPlan):string {
  return `${OCR_ALEVEL_P3_RULES}\nSAVED H420/03; ${plan.mode}; ${plan.totalMarks} marks, ${plan.durationMinutes} minutes. Return exactly the immutable planned parts, with separate context/task and private correct_answer.\n`+plan.parts.map(ocrAlevelPaper3PartInstruction).join('\n');
}
