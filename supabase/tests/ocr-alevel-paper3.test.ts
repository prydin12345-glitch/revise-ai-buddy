// @vitest-environment node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {expect,it} from 'vitest';
import baseline from './fixtures/biology-pre-ocr-paper3-baseline.json';
import {biologyPaperOptions,getBiologyPaperPack,biologyPlanInstructions,biologyBatchInstructions,assertBiologyPlanIntegrity} from '../functions/_shared/biology-course-packs';
import {buildOcrAlevelPaper3Plan,type UnifiedPart} from '../functions/_shared/ocr-alevel-biology-paper3-contract';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyScopeFromContext,biologyContentIssue} from '../functions/_shared/gcse-biology-scope';
import {biologyPracticeCacheVersion,biologyPracticeInstructions,assertBiologyPractice} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions,biologyQuestionResourceContext} from '../functions/_shared/biology-marking';
import {ocrPaper3Fixture,ocrPaper3Snapshot} from './ocr-alevel-paper3-fixtures';
import {ocrAlevelSnapshot} from './ocr-alevel-fixtures';
import {ocrPaper2Snapshot} from './ocr-alevel-paper2-fixtures';
import {ocrPaper2V2Snapshot} from './ocr-alevel-paper2-v2-fixtures';
const course='ocr_alevel_biology_a_h420',lookup={subject:'Biology',examBoard:'OCR',educationalTier:'level3'};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
it('preserves all 48 pre-Paper-3 plans, definitions and generation prompt fingerprints',()=>{
  expect(baseline.baseCommit).toBe('2ee58678eb0f9d70082a5cb7b97a0429e9991330');expect(baseline.cases).toHaveLength(48);
  for(const row of baseline.cases){const pack=getBiologyPaperPack(row.courseId,row.paperId,row.contractVersion)!;
    const plan=pack.build(row.mode as any,row.tier as any)!;
    expect(hash(plan)).toBe(row.planHash);expect(hash(pack.definition(row.tier as any))).toBe(row.definitionHash);expect(hash(biologyPlanInstructions(plan))).toBe(row.promptHash);
  }
});
it('recognises only explicit H420/03 with reviewed untiered course identity',()=>{
  const c=ocrPaper3Snapshot(),selection=resolvePaperSelection(lookup,'not_tiered',{paperContract:c.paper_contract});
  expect(selection.componentCode).toBe('H420/03');expect(selection.paperContract).toEqual(c.paper_contract);
  expect(biologyPaperOptions(course).map(p=>p.paperId)).toEqual(['paper_1','paper_2','paper_3']);
  expect(getBiologyPaperPack(course)).toBeNull();expect(getBiologyPaperPack(course,'paper_3',2)).toBeNull();
  for(const blueprint of [{},{courseSelection:{courseId:course}},{paperContract:{...c.paper_contract,contractVersion:999}},{paperContract:c.paper_contract,courseSelection:{courseId:course,paperId:'paper_2'}}])expect(()=>resolvePaperSelection(lookup,'not_tiered',blueprint)).toThrow();
  expect(()=>resolvePaperSelection({...lookup,examBoard:'AQA'},'not_tiered',{paperContract:c.paper_contract})).toThrow();
  expect(getBiologyPaperPack('ocr_alevel_biology_b_h422','paper_3')).toBeNull();
});
it.each(['foundation','higher',null] as const)('rejects tier %s before generation',tier=>expect(()=>buildOcrAlevelPaper3Plan('full_mock',tier)).toThrow(/untiered/));
it.each(['full_mock','short_practice'] as const)('locks %s totals, cross-module contexts, practical/statistical/plotting/extended demand',mode=>{
  const {plan,rows,snapshot}=ocrPaper3Fixture(mode);assertBiologyPlanIntegrity(plan);
  expect([plan.componentCode,plan.tier,plan.totalMarks,plan.durationMinutes,plan.parentCount,plan.partCount]).toEqual(['H420/03','not_tiered',mode==='full_mock'?70:20,mode==='full_mock'?90:26,mode==='full_mock'?6:2,mode==='full_mock'?24:6]);
  expect(plan.label).toContain(mode==='full_mock'?'Examly template':'Examly development template');
  expect(new Set(plan.parts.flatMap(p=>p.specRefs!).map(r=>r[0]))).toEqual(new Set(['1','2','3','4','5','6']));
  const parts=plan.parts as UnifiedPart[];
  for(const id of new Set(parts.map(p=>p.parentId))){const group=parts.filter(p=>p.parentId===id);
    expect(new Set(group.flatMap(p=>p.specRefs!).filter(r=>!r.startsWith('1.')).map(r=>r[0])).size).toBeGreaterThanOrEqual(2);
    expect(new Set(group.map(p=>p.unifiedContext)).size).toBe(1);
  }
  expect(parts.every(p=>!p.section&&p.responseType!=='mcq_single'&&!p.mcqStyle)).toBe(true);
  expect(parts.some(p=>p.unifiedSkill==='plotting'&&p.resource==='data_table')).toBe(true);
  expect(parts.some(p=>p.unifiedSkill==='statistical_analysis'&&p.resource==='data_table')).toBe(true);
  expect(parts.filter(p=>p.marks===6)).toHaveLength(mode==='full_mock'?2:1);
  expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
  expect(biologyBatchInstructions(plan,parts.filter(p=>p.parentId==='q1'))).toContain('ONE shared investigation');
});
it('refuses disconnected recall, missing modules, MCQ sections and incorrect marks/time',()=>{
  const {plan}=ocrPaper3Fixture();
  const patches=[{totalMarks:100},{durationMinutes:135},{componentCode:'H420/02'},
    {parts:plan.parts.map(p=>({...p,section:'A'}))},
    {parts:plan.parts.map(p=>({...p,specRefs:['2.1.4']}))},
    {parts:plan.parts.map((p,i)=>i? p:{...p,responseType:'mcq_single'})}];
  for(const patch of patches)expect(()=>assertBiologyPlanIntegrity({...plan,...patch} as any)).toThrow();
});
it('freezes protected snapshots on retry and retains explicit Custom identity',()=>{
  const c=ocrPaper3Snapshot();expect(paperPlanForAttempt(c,{paperContract:ocrPaper2Snapshot().paper_contract})?.paperId).toBe('paper_3');
  for(const patch of [{paper_id:'paper_2'},{component_code:'H420/02'},{assessment_tier:'higher'},{context_version:1},{specification_version:'old'},{paper_contract:{...c.paper_contract,paperId:'paper_2'}}])expect(()=>paperPlanForAttempt({...c,...patch})).toThrow();
  expect(buildOcrAlevelPaper3Plan('custom','not_tiered')).toBeNull();
  expect(resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:course,paperId:'paper_3'}}).componentCode).toBe('H420/03');
  expect(paperPlanForAttempt(ocrPaper3Snapshot('custom'))).toBeNull();
});
it.each(['Explain the Calvin cycle.','Explain the lac operon.','Describe antibody production by B lymphocytes.','Explain action potentials.','Calculate a Hardy-Weinberg allele frequency.'])('permits legitimate whole-course H420 content: %s',question_text=>{
  expect(biologyContentIssue({question_text},biologyScopeFromContext(ocrPaper3Snapshot()))).toBeNull();
});
it.each(['context','missing_table','bad_row','wrong_key','missing_threshold','non_numeric_threshold','private_field','string_private','shared_values','completed_plot','wrong_topic','blank_measurement','negative_expected','wrong_total','wrong_df','wrong_threshold'] as const)('blocks %s without bypassing the shared gate',fault=>{
  const f=ocrPaper3Fixture(),rows=structuredClone(f.rows);const s=rows.find(q=>q.question_number==='3(c)')!,plot=rows[1];
  if(fault==='context')rows[0].question_text='The respiratory enzyme is active in this organism.';
  if(fault==='missing_table')s.diagram_config=null;
  if(fault==='bad_row')s.diagram_config.rows[0].pop();
  if(fault==='wrong_key')s.correct_answer=s.correct_answer.replace('Final statistic: 0.2','Final statistic: 2.0');
  if(fault==='missing_threshold')s.question_text=s.question_text.replace('critical value 3.84','');
  if(fault==='non_numeric_threshold')s.question_text=s.question_text.replace('critical value 3.84','critical value unavailable; an unrelated number is 3.84');
  if(fault==='private_field')plot.diagram_config.extra={solution:'PRIVATE'};
  if(fault==='string_private')plot.diagram_config=JSON.stringify({...plot.diagram_config,extra:{solution:'PRIVATE'}});
  if(fault==='shared_values')rows[2].diagram_config.rows[0][1]=10;
  if(fault==='completed_plot')plot.diagram_config={type:'line_chart',xAxisLabel:'Temperature (°C)',yAxisLabel:'Activity',datasets:[{label:'Completed answer',data:[{x:10,y:2},{x:20,y:5},{x:30,y:8}]}]};
  if(fault==='wrong_topic')rows[0].topic_tag='Unplanned topic';
  if(fault==='blank_measurement')plot.diagram_config.rows[0][1]='';
  if(fault==='negative_expected')s.diagram_config.rows[0][2]=-5;
  if(fault==='wrong_total')s.diagram_config.rows[0][1]=41;
  if(fault==='wrong_df')s.question_text=s.question_text.replace('degrees of freedom 1','degrees of freedom 2');
  if(fault==='wrong_threshold')s.question_text=s.question_text.replace('critical value 3.84','critical value 1.0');
  expect(validateQuestionCandidates(rows,{plan:f.plan,scope:biologyScopeFromContext(f.snapshot)}).ok).toBe(false);
});
it('keeps whole-course quizzes and caches separate from both frozen papers',()=>{
  const c=ocrPaper3Snapshot('short_practice'),identities=[c,ocrAlevelSnapshot(),ocrPaper2Snapshot(),ocrPaper2V2Snapshot()].map(biologyPracticeCacheVersion);
  expect(new Set(identities).size).toBe(4);expect(identities[0]).toContain('paper-3');
  const prompt=biologyPracticeInstructions(c);expect(prompt).toContain('H420/03');expect(prompt).toContain('retain requested topics, count and format');
  const q=ocrPaper3Fixture('short_practice').rows[0];expect(()=>assertBiologyPractice([q],c)).not.toThrow();
  expect(()=>assertBiologyPractice([{...q,question_text:'The experiment measures temperature.'}],c)).toThrow(/missing_task/);
  expect(biologyMarkingInstructions(c)).toContain('H420/03 Unified biology');expect(biologyMarkingInstructions(c)).toContain('method marks');
  expect(biologyQuestionResourceContext(c,ocrPaper3Fixture('short_practice').rows[1])).toContain('Temperature');
  expect(()=>biologyQuestionResourceContext(c,{...ocrPaper3Fixture('short_practice').rows[1],diagram_config:null})).toThrow(/missing/);
});
it('runs the targeted offline audit without a backend or paid model',()=>{
  const output=execFileSync(process.execPath,['scripts/audit-ocr-alevel-paper3.mjs'],{encoding:'utf8'});
  expect(output).toContain('synoptic plan audit passed');expect(output).toContain('No paper generated');
});
