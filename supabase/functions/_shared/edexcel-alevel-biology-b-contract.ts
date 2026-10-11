import { EDEXCEL_ALEVEL_BIOLOGY_B_ID } from './assessment-tier.ts';
import { EDEXCEL_B_SPECIFICATION, EDEXCEL_B_P1_TOPICS, EDEXCEL_B_P1_OUTCOMES, EDEXCEL_B_P1_RULES } from './edexcel-alevel-biology-b-scope.ts';
import type { PaperMode, PaperPlan, PlannedPart } from './paper-contract-types.ts';
import { questionResourceInstructions } from './question-resource-instructions.ts';

export const EDEXCEL_B_P1 = {courseId: EDEXCEL_ALEVEL_BIOLOGY_B_ID, paperId: '9bi0_01', contractVersion: 1,
  specificationVersion: EDEXCEL_B_SPECIFICATION, componentCode: '9BI0/01',
  displayName: 'Paper 1 — Advanced Biochemistry, Microbiology and Genetics (9BI0/01)',
  topics: EDEXCEL_B_P1_TOPICS, fullMockMarks: 90, fullMockMinutes: 105} as const;
export type EdexcelBSkill = 'terminology' | 'application' | 'calculation' | 'plotting' | 'interpretation' | 'practical' | 'evaluation' | 'extended_response';
// Both existing heart and plant-cell renderers have eleven stable target slots.
export const EDEXCEL_B_DIAGRAM_LETTERS=Object.freeze('ABCDEFGHIJK'.split(''));
export interface EdexcelBPart extends PlannedPart { pearsonSkill: EdexcelBSkill; investigation: string; }
type Slot = [number, string, EdexcelBSkill, PlannedPart['resource'], PlannedPart['demand']];
interface Group { context: string; slots: Slot[]; mcqs?: number[]; }
/** Original Examly v1 layout; neither question counts nor these allocations are
 * Pearson rules. Nine parent groups follow the observed mixed progression. */
const FULL: Group[] = [
  {context: 'Protein structure and an enzyme investigation', mcqs: [0,1], slots: [[1,'1.3','terminology','none','AO1'],[1,'1.5','application','none','AO2'],[2,'1.5','interpretation','graph','AO2'],[2,'1.3','application','none','AO1']]},
  {context: 'Cell ultrastructure, microscopy and division', mcqs: [0,1], slots: [[1,'2.1','terminology','none','AO1'],[1,'2.3','application','none','AO2'],[2,'2.1','calculation','none','AO2'],[3,'2.3','practical','none','AO3']]},
  {context: 'Molecular classification, biodiversity and conservation', mcqs: [0], slots: [[1,'3.1','terminology','none','AO1'],[2,'3.1','interpretation','data_table','AO2'],[2,'3.3','calculation','data_table','AO2'],[3,'3.3','evaluation','none','AO3']]},
  {context: 'Gas exchange and transport structures', mcqs: [0], slots: [[1,'4.3','application','none','AO2'],[2,'4.4','application','diagram','AO1'],[3,'4.5','interpretation','graph','AO2'],[3,'4.7','practical','none','AO3']]},
  {context: 'Photosynthetic pigment and energy-transfer investigations', mcqs: [0], slots: [[1,'5.4','application','none','AO1'],[2,'5.6','calculation','none','AO2'],[3,'5.7','plotting','data_table','AO2'],[4,'5.7','evaluation','none','AO3']]},
  {context: 'Aseptic bacterial culture and antibiotic effects', mcqs: [0], slots: [[1,'6.3','terminology','none','AO1'],[2,'6.1','calculation','data_table','AO2'],[4,'6.1','practical','none','AO3'],[4,'6.4','application','none','AO2']]},
  {context: 'DNA amplification, gene expression and genetic technology', mcqs: [0], slots: [[1,'7.2','terminology','none','AO1'],[2,'7.1','calculation','none','AO2'],[4,'7.2','application','none','AO2'],[5,'7.4','evaluation','none','AO3']]},
  {context: 'Plant transport and photosynthesis under controlled conditions', mcqs: [0], slots: [[1,'4.2','application','none','AO2'],[2,'4.7','interpretation','graph','AO2'],[4,'5.7','practical','none','AO3'],[6,'5.7','extended_response','none','AO3']]},
  {context: 'Medical genetic technologies and infection prevention', slots: [[2,'6.7','application','none','AO1'],[3,'7.3','interpretation','data_table','AO2'],[3,'6.7','evaluation','none','AO3'],[6,'7.3','extended_response','none','AO3']]},
];
const SHORT: Group[] = [
  {context: 'Enzyme activity and controlled rate measurements', mcqs: [0], slots: [[1,'1.5','application','none','AO1'],[2,'1.5','plotting','data_table','AO2'],[3,'1.5','calculation','none','AO2']]},
  {context: 'Microscopy and plant exchange surfaces', mcqs: [0], slots: [[1,'2.1','terminology','none','AO1'],[2,'2.1','calculation','none','AO2'],[4,'4.2','practical','diagram','AO3']]},
  {context: 'Molecular evidence and genetic medicine', slots: [[2,'3.1','interpretation','data_table','AO2'],[4,'6.7','application','none','AO2'],[6,'7.3','extended_response','none','AO3']]},
];
const slots = (mode: PaperMode) => mode === 'full_mock' ? FULL : SHORT;
export function buildEdexcelBiologyBPlan(mode: PaperMode, tier: PaperPlan['tier']): PaperPlan | null {
  if(tier !== 'not_tiered') throw new Error('Pearson Edexcel A Level Biology B is untiered.');
  if(mode === 'custom') return null;
  if(!['full_mock','short_practice'].includes(mode)) throw new Error('Unknown 9BI0/01 mode.');
  const parts: EdexcelBPart[] = [];
  slots(mode).forEach((group,i) => group.slots.forEach(([marks,ref,skill,resource,demand],j) => {
    const n=i+1,letter='abcd'[j],id=`edexcel_9bi0_01_${n}${letter}`,mcq=group.mcqs?.includes(j);
    parts.push({partId:id,parentId:`q${n}`,questionNumber:`${n}(${letter})`,topic:EDEXCEL_B_P1_TOPICS[EDEXCEL_B_P1_OUTCOMES[ref].topic],
      specRefs:[ref],marks,demand,resource,...(resource==='none'?{}:{resourceId:`r_${id}`}),
      responseType:mcq?'mcq_single':marks>=5?'long_form':'short_answer',...(mcq?{mcqStyle:skill==='terminology'?'recall' as const:'practical' as const}:{}),
      assessmentRole:skill==='extended_response'?'extended_response':'structured',pearsonSkill:skill,investigation:group.context,
      mathsMarks:['calculation','plotting'].includes(skill)?marks:0,
      practicalMarks:['plotting','practical','evaluation'].includes(skill)?Math.min(marks,3):0});
  }));
  const totalMarks=parts.reduce((sum,p)=>sum+p.marks,0);
  const plan:PaperPlan={...EDEXCEL_B_P1,mode,tier,parts,totalMarks,parentCount:slots(mode).length,partCount:parts.length,
    durationMinutes:mode==='full_mock'?105:Math.round(totalMarks*105/90),
    label:`Pearson Edexcel A Level Biology B Paper 1 ${mode==='full_mock'?'full mock (Examly development template)':'short practice (Examly practice template)'}`};
  assertEdexcelBiologyBPlan(plan);return plan;
}
export function assertEdexcelBiologyBPlan(plan: PaperPlan): void {
  const full=plan.mode==='full_mock',parts=plan.parts as EdexcelBPart[];
  if(plan.courseId!==EDEXCEL_B_P1.courseId||plan.paperId!==EDEXCEL_B_P1.paperId||plan.componentCode!=='9BI0/01'||plan.specificationVersion!==EDEXCEL_B_SPECIFICATION||plan.contractVersion!==1||plan.tier!=='not_tiered'||!['full_mock','short_practice'].includes(plan.mode))throw new Error('Invalid Biology B Paper 1 identity.');
  if(plan.totalMarks!==(full?90:25)||plan.durationMinutes!==(full?105:29)||parts.reduce((s,p)=>s+p.marks,0)!==plan.totalMarks||plan.partCount!==(full?36:9)||parts.length!==plan.partCount||plan.parentCount!==(full?9:3))throw new Error('Invalid Biology B Paper 1 totals.');
  const expected=slots(plan.mode).flatMap((g,i)=>g.slots.map(([marks,ref,skill,resource,demand],j)=>({number:`${i+1}(${'abcd'[j]})`,parent:`q${i+1}`,marks,ref,skill,resource,demand,context:g.context,mcq:!!g.mcqs?.includes(j)})));
  parts.forEach((p,i)=>{
    const e=expected[i];
    if(!e||p.questionNumber!==e.number||p.parentId!==e.parent||p.partId!==`edexcel_9bi0_01_${e.number.replace(/[()]/g,'')}`||p.marks!==e.marks||p.demand!==e.demand||p.resource!==e.resource||p.pearsonSkill!==e.skill||p.investigation!==e.context||p.specRefs?.join()!==e.ref||p.topic!==EDEXCEL_B_P1_TOPICS[EDEXCEL_B_P1_OUTCOMES[e.ref].topic]||p.section||p.responseType!==(e.mcq?'mcq_single':e.marks>=5?'long_form':'short_answer'))throw new Error('Biology B immutable planned part mismatch.');
    if(p.resourceId!==(e.resource==='none'?undefined:`r_${p.partId}`)||
      p.assessmentRole!==(e.skill==='extended_response'?'extended_response':'structured')||
      p.mathsMarks!==(['calculation','plotting'].includes(e.skill)?e.marks:0)||
      p.practicalMarks!==(['plotting','practical','evaluation'].includes(e.skill)?Math.min(e.marks,3):0))throw new Error('Invalid Biology B immutable resources/skill annotations.');
  });
  if(full&&EDEXCEL_B_P1_TOPICS.some(t=>!parts.some(p=>p.topic===t)))throw new Error('Full Biology B must cover Topics 1–7.');
  if(parts.filter(p=>p.responseType==='mcq_single').length!==(full?10:2)||parts.filter(p=>p.assessmentRole==='extended_response').length!==(full?2:1)||!parts.some(p=>p.pearsonSkill==='plotting')||!parts.some(p=>p.pearsonSkill==='practical'))throw new Error('Invalid Biology B format/skills mix.');
}
export function edexcelBiologyBPartInstruction(part: PlannedPart): string {
  const p=part as EdexcelBPart;
  return `Q${p.questionNumber} | ${p.marks} marks | ${p.demand} | topic_tag="${p.topic}" | question_type="${p.responseType==='mcq_single'?'mcq':p.responseType==='long_form'?'written':'short_answer'}". Parent context: ${p.investigation}. `+
    (p.specRefs??[]).map(r=>`${r}: ${EDEXCEL_B_P1_OUTCOMES[r].text}`).join('; ')+`. Assessed skill ${p.pearsonSkill}. `+
    (p.resource==='none'?'Supply all needed givens in this part. Do not refer to absent resources. ':`Required ${p.resource}, id ${p.resourceId}. ${questionResourceInstructions('chart_data')} `)+
    (p.resource==='diagram'?`Use diagram_config type ${p.specRefs?.includes('4.4')?'heart':'plant_cell'}, showLabels:true, labelMode:"anonymous", letterLabels:${JSON.stringify(EDEXCEL_B_DIAGRAM_LETTERS)}, hideIntrinsicLabels:true, using existing deterministic geometry and these exact stable letter targets; no biological answer labels, photographs or arbitrary external URLs. Do not provide labels/revealedLabels overrides. The diagram must be needed by this task. `:'')+
    (p.pearsonSkill==='plotting'?'Give a complete two-column table, finite observations at three or more distinct x values, headers and units. Ask the student to plot from these givens; the shared response grid supplies blank axes. Do not supply the completed graph. Retain accurate plotting/line and working credit. ':'')+
    (p.pearsonSkill==='calculation'?'Use the specified Topic 1–7 mathematics and visible numeric givens. State working, units and precision instructions where assessed. Private scheme needs method marks, final answer with units, tolerance/precision and any error-carried-forward rule. Do not introduce inheritance crosses or Hardy–Weinberg. ':'')+
    (p.pearsonSkill==='practical'?'Assess relevant core-practical 1–13 methods in this biological context: controls/variables, apparatus, safety, measurement, validity, uncertainty, processing or improvements with justified purposes. ':'')+
    (p.responseType==='mcq_single'?'Four distinct descriptive options, exactly one private correct choice, one mark; use an explicit assessed selection task. Never reveal the key. ':p.assessmentRole==='extended_response'?'Private Pearson levels scheme: Level 0 (0), Level 1 (1–2) limited isolated knowledge/application, Level 2 (3–4) relevant knowledge and some contextual links/reasoning, Level 3 (5–6) comprehensive accurate contextual application and sustained coherent scientific reasoning. Adapt descriptors to this task and include indicative biological content, not just a model answer. ':'Private task-specific independently creditable points, acceptable alternatives, terminology/rejections where justified and a total cap matching this part. ')+
    'Return separately stated context and task; use the Pearson command matching the planned demand. Preserve exact saved numbering/resources and private marking content during repairs.';
}
export const edexcelBiologyBInstructions = (plan: PaperPlan) => `${EDEXCEL_B_P1_RULES}\nSaved 9BI0/01 ${plan.mode}, ${plan.totalMarks} marks/${plan.durationMinutes} minutes. The ${plan.parentCount}-group layout is an Examly development template, not a fixed Pearson rule.\n${plan.parts.map(edexcelBiologyBPartInstruction).join('\n')}`;
