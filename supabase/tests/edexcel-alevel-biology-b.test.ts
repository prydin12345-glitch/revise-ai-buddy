// @vitest-environment node
import {expect,it} from 'vitest';
import {createHash} from 'node:crypto';
import baseline from './fixtures/biology-pre-visual-assets-baseline.json';
import {EDEXCEL_ALEVEL_BIOLOGY_B_ID as B,EDEXCEL_ALEVEL_BIOLOGY_A_ID as A,getCourseCapability,getCourseOptions,getAssessmentTierOptions} from '../functions/_shared/assessment-tier';
import {buildEdexcelBiologyBPlan,type EdexcelBPart} from '../functions/_shared/edexcel-alevel-biology-b-contract';
import {EDEXCEL_B_P1_TOPICS,edexcelBiologyBContentIssue,pearsonAdditionalAssessedTask} from '../functions/_shared/edexcel-alevel-biology-b-scope';
import {getBiologyPaperPack,biologyBatchInstructions,biologyRepairInstructions,assertBiologyPlanIntegrity,biologyPlanInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {validateQuestionCandidates,hasAssessedTask} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {biologyPracticeCacheVersion,assertBiologyPractice,checkBiologyPracticeCourse,normalizeBiologyPracticePayload} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {pearsonBiologyLevelsIssue} from '../functions/_shared/edexcel-alevel-biology-b-validation';
import {edexcelBFixture,edexcelBSnapshot,pearsonLevels} from './edexcel-alevel-biology-b-fixtures';
const lookup={subject:'Biology',examBoard:'Pearson Edexcel',educationalTier:'level3'};
const bp=(mode='full_mock')=>({paperContract:edexcelBSnapshot(mode).paper_contract});
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
it('preserves all fifty baseline plan, definition and prompt fingerprints (including H420/01–03)',()=>{
  expect(baseline.cases).toHaveLength(50);
  for(const row of baseline.cases){const pack=getBiologyPaperPack(row.courseId,row.paperId,row.contractVersion)!;const plan=pack.build(row.mode as any,row.tier as any)!;
    expect(hash(plan)).toBe(row.planHash);expect(hash(pack.definition(row.tier as any))).toBe(row.definitionHash);expect(hash(biologyPlanInstructions(plan))).toBe(row.promptHash);}
});
it('requires explicit selection for generic Edexcel Biology and separates A from B',()=>{
  expect(getCourseOptions(lookup).map(c=>c.id)).toEqual([B,A]);expect(getCourseCapability(lookup)).toBeNull();
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{})).toThrow(/explicitly/);
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:A,paperId:'9bi0_01'}})).toThrow(/not available/);
  expect(getBiologyPaperPack(A,'9bi0_01')).toBeNull();expect(getBiologyPaperPack(B)).toBeNull();
  expect(getCourseCapability({...lookup,subject:'Pearson Edexcel A Level Biology B (9BI0)'}).id).toBe(B);
  expect(getCourseCapability({...lookup,subject:'Biology A (Salters-Nuffield)'}).id).toBe(A);
  expect(getAssessmentTierOptions({...lookup,courseId:B})).toEqual([]);
  expect(resolvePaperSelection(lookup,'not_tiered',bp()).componentCode).toBe('9BI0/01');
});
it.each(['foundation','higher',null] as const)('rejects unsupported tier %s',tier=>expect(()=>buildEdexcelBiologyBPlan('full_mock',tier)).toThrow(/untiered/));
it.each(['full_mock','short_practice'] as const)('validates exact %s plan, authored resources and private keys',mode=>{
  const f=edexcelBFixture(mode);assertBiologyPlanIntegrity(f.plan);
  expect([f.plan.totalMarks,f.plan.durationMinutes,f.plan.parentCount,f.plan.partCount]).toEqual(mode==='full_mock'?[90,105,9,36]:[25,29,3,9]);
  expect(validateQuestionCandidates(f.rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)}).defects).toEqual([]);
  expect(f.plan.parts.every(p=>!p.section&&p.specRefs?.every(r=>Number(r[0])<=7))).toBe(true);
  expect(f.plan.parts.filter(p=>p.responseType==='mcq_single')).toHaveLength(mode==='full_mock'?10:2);
  expect(f.plan.label).toContain('Examly');
  if(mode==='full_mock')expect(new Set(f.plan.parts.map(p=>p.topic))).toEqual(new Set(EDEXCEL_B_P1_TOPICS));
  expect((f.plan.parts as EdexcelBPart[]).some(p=>p.pearsonSkill==='plotting')).toBe(true);
  expect(f.plan.parts.reduce((s,p)=>s+(p.mathsMarks??0),0)).toBeGreaterThan(2);
});
it.each([{totalMarks:91},{durationMinutes:120},{componentCode:'9BN0/01'},{tier:'higher'},{contractVersion:999},{partCount:15},{parentCount:15}])('rejects altered deterministic contract %j',patch=>expect(()=>assertBiologyPlanIntegrity({...edexcelBFixture().plan,...patch} as any)).toThrow());
it('rejects changed planned outcomes, numbers and response formats',()=>{
  const p=edexcelBFixture().plan;
  for(const patch of [{specRefs:['8.2']},{questionNumber:'10(a)'},{section:'A'},{marks:2},{pearsonSkill:'statistical_analysis'},{resourceId:'another_image'},{mathsMarks:1},{practicalMarks:1},{assessmentRole:'extended_response'}])expect(()=>assertBiologyPlanIntegrity({...p,parts:p.parts.map((v,i)=>i?v:{...v,...patch})} as any)).toThrow();
});
it('freezes server identity for retry and retains explicit Custom without inventing a plan',()=>{
  const c=edexcelBSnapshot();expect(paperPlanForAttempt(c,{paperContract:{...c.paper_contract,paperId:'paper_3'}})?.paperId).toBe('9bi0_01');
  for(const patch of [{context_version:1},{specification_version:'old'},{paper_id:'paper_2'},{component_code:'9BN0/01'},{assessment_tier:'higher'},{paper_contract:{...c.paper_contract,courseId:A}}])expect(()=>paperPlanForAttempt({...c,...patch})).toThrow();
  expect(paperPlanForAttempt({...c,resolved_by:'client'})).toBeNull();
  expect(buildEdexcelBiologyBPlan('custom','not_tiered')).toBeNull();expect(paperPlanForAttempt(edexcelBSnapshot('custom'))).toBeNull();
});
it.each(['Hardy–Weinberg','Construct a genetic cross using a Punnett square.','dihybrid inheritance','sex linkage','genetic drift','allele frequencies','action potential','synaptic transmission','negative feedback','osmoregulation','insulin','gibberellin','nitrogen cycle','succession','food webs','quadrats','Topic 8: Origins of Genetic Variation','Topic 9: Control Systems','Topic 10: Ecosystems'])('blocks later-paper boundary: %s',text=>{
  expect(edexcelBiologyBContentIssue(text)).toContain('excludes');expect(biologyContentIssue({question_text:text},biologyScopeFromContext(edexcelBSnapshot()))).toContain('excludes');
});
it.each(['Meiosis, crossing over and independent assortment','natural selection and speciation','genetic biodiversity and conservation','SAN, AVN and bundle of His','antibiotic resistance','PCR and epigenetic modification','Calvin cycle and chemiosmosis','Stem-cell induced pluripotency'])('allows legitimate Paper 1 overlap: %s',text=>expect(edexcelBiologyBContentIssue(text)).toBeNull());
it.each(['missing_task','missing_table','bad_row','missing_graph','categorical_graph','missing_diagram','wrong_diagram','named_diagram','missing_letter_labels','partial_letter_labels','answer_letter_labels','intrinsic_labels','private_resource','wrong_topic','duplicate_options','wrong_mcq_key','three_options','wrong_mark','later_topic_key','bad_plot','model_only'])('fails closed for %s',fault=>{
  const f=edexcelBFixture(),rows=structuredClone(f.rows);const table=rows.find(q=>q.question_number==='3(c)')!,diagram=rows.find(q=>q.question_number==='4(b)')!,graph=rows.find(q=>q.question_number==='1(c)')!;
  if(fault==='missing_task')rows[0].question_text='A peptide contains amino acids.';
  if(fault==='missing_table')table.diagram_config=null;
  if(fault==='bad_row')table.diagram_config.rows[0].pop();
  if(fault==='missing_graph')graph.diagram_config=null;
  if(fault==='categorical_graph')graph.diagram_config.datasets[0].data[0].x='Treatment A';
  if(fault==='missing_diagram')diagram.diagram_config=null;
  if(fault==='wrong_diagram')diagram.diagram_config.type='neuron';
  if(fault==='named_diagram')diagram.diagram_config.labelMode='visible';
  if(fault==='missing_letter_labels')delete diagram.diagram_config.letterLabels;
  if(fault==='partial_letter_labels')diagram.diagram_config.letterLabels.pop();
  if(fault==='answer_letter_labels')diagram.diagram_config.letterLabels[0]='Left atrium';
  if(fault==='intrinsic_labels')diagram.diagram_config.hideIntrinsicLabels=false;
  if(fault==='private_resource')table.diagram_config.answer_key='secret';
  if(fault==='wrong_topic')rows[0].topic_tag='Control Systems';
  if(fault==='duplicate_options')rows[0].options![1]=rows[0].options![0];
  if(fault==='wrong_mcq_key')rows[0].correct_answer='E';
  if(fault==='three_options')rows[0].options!.pop();
  if(fault==='wrong_mark')rows[0].marks=2;
  if(fault==='later_topic_key')rows[2].correct_answer='Use Hardy-Weinberg.';
  if(fault==='bad_plot')rows.find(q=>q.question_number==='5(c)')!.diagram_config.rows.forEach((r:any)=>r[0]=0);
  if(fault==='model_only')rows.at(-1)!.correct_answer='A useful treatment has some benefits.';
  expect(validateQuestionCandidates(rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)}).ok).toBe(false);
});
it('recognises Pearson additional imperatives only in the new scope, retaining context-only failures',()=>{
  for(const verb of ['Assess','Devise','Criticise']){
    const row={...edexcelBFixture().rows[2],question_text:`${verb} the experimental proposal.`};
    expect(hasAssessedTask(row.question_text)).toBe(false);expect(pearsonAdditionalAssessedTask(row.question_text)).toBe(true);
    expect(validateQuestionCandidates([row],{scope:biologyScopeFromContext(edexcelBSnapshot())}).ok).toBe(true);
    expect(validateQuestionCandidates([{...row,question_text:`Researchers ${verb.toLowerCase()} the experimental proposal.`}],{scope:biologyScopeFromContext(edexcelBSnapshot())}).ok).toBe(false);
  }
});
it('normalizes Pearson levels and rejects missing bands/ranges/content without using AQA essay scores',()=>{
  const key=pearsonLevels('Antigen-specific responses, memory and medical risks.');expect(pearsonBiologyLevelsIssue(key)).toBeNull();
  for(const text of ['model answer',key.replace('Level 3 (5–6)','Top level'),key.replace('Indicative biological content:','Model answer:'),key.replace('Level 0 (0):','Empty:')])expect(pearsonBiologyLevelsIssue(text)).toBeTruthy();
  const normalized=normalizeBiologyPracticePayload({questions:[{...edexcelBFixture().rows.at(-1)!,correct_answer:{answer:'Accepted alternatives',marking_scheme:key}}]},edexcelBSnapshot()) as any;
  expect(pearsonBiologyLevelsIssue(normalized.questions[0].correct_answer)).toBeNull();
});
it('preserves structured Pearson numeric ranges through the shared normalized private-key envelope',()=>{
  const key={levels:[{level:0,marks:0,descriptor:'No relevant biological content.'},
    {level:1,minMarks:1,maxMarks:2,descriptor:'Limited isolated biological knowledge with little application.'},
    {level:2,minMarks:3,maxMarks:4,descriptor:'Relevant knowledge with some contextual links and reasoning.'},
    {level:3,minMarks:5,maxMarks:6,descriptor:'Accurate comprehensive contextual application with sustained coherent reasoning.'}],
    indicative_content:['Antigen-specific responses and immunological memory.','Medical risks and evidence-informed benefits.']};
  expect(pearsonBiologyLevelsIssue(key)).toBeNull();
  const normalized=normalizeBiologyPracticePayload({questions:[{...edexcelBFixture().rows.at(-1)!,correct_answer:key}]},edexcelBSnapshot()) as any;
  expect(pearsonBiologyLevelsIssue(normalized.questions[0].correct_answer)).toBeNull();
  const bad=structuredClone(key);bad.levels[1].minMarks=3;bad.levels[2].minMarks=1;
  expect(pearsonBiologyLevelsIssue(bad)).toBeTruthy();
});
it('separates modes/format/topics/count/variation in the existing cache and preserves practice scope',async()=>{
  const context=edexcelBSnapshot('short_practice'),params={subject:'Biology',examBoard:'Pearson Edexcel',educationalLevel:'level3',assessmentTier:'not_tiered',courseId:B,paperId:'9bi0_01',presetVersion:1,resourceVersion:biologyPracticeCacheVersion(context),topics:['Modern Genetics'],difficulty:'mixed',questionFormat:'mixed',questionCount:9,variationSlot:0};
  const keys=await Promise.all([params,{...params,resourceVersion:biologyPracticeCacheVersion(edexcelBSnapshot())},{...params,questionCount:8},{...params,questionFormat:'written_only'},{...params,topics:['Exchange and Transport']},{...params,variationSlot:1},{...params,courseId:A}].map(buildCacheKey));
  expect(new Set(keys).size).toBe(7);expect(biologyPracticeCacheVersion(context)).toContain('9bi0');
  expect(()=>checkBiologyPracticeCourse({...context,resolved_by:'client'})).toThrow();
  expect(()=>assertBiologyPractice(edexcelBFixture('short_practice').rows,context)).not.toThrow();
});
it('gives generation and group repair exact parts/resources/points/levels without a fixed Pearson claim',()=>{
  const f=edexcelBFixture(),batch=f.plan.parts.filter(p=>p.parentId==='q1'),prompt=biologyBatchInstructions(f.plan,batch);
  expect(prompt).toContain('1(a), 1(b), 1(c), 1(d)');expect(prompt).toContain('Pearson');expect(prompt).not.toContain('Q2(a) |');
  const repair=biologyRepairInstructions(f.plan,new Set(['9(d)']),true);expect(repair).toContain('Level 3 (5–6)');expect(repair).toContain('indicative biological content');
  expect(biologyMarkingInstructions(f.snapshot)).toContain('method marks');expect(biologyMarkingInstructions(f.snapshot)).toContain('Pearson best-fit');
  expect(biologyQuestionResourceContext(f.snapshot,f.rows.find(q=>q.question_number==='3(c)'))).toContain('Species R');
  expect(()=>biologyQuestionResourceContext(f.snapshot,{...f.rows.find(q=>q.question_number==='4(b)'),diagram_config:null})).toThrow(/missing/);
});
