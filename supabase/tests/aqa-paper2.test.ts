// @vitest-environment node
import {describe, expect, it} from 'vitest';
import {AQA_BIOLOGY_P2, AQA_P2_OUTCOMES, aqaPaper2Instructions} from '../functions/_shared/aqa-biology-paper2';
import {getBiologyPaperPack, biologyPaperOptions, assertBiologyPlanIntegrity} from '../functions/_shared/biology-course-packs';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {profilePaperId, resolvePaperSelection, paperPlanForAttempt} from '../functions/_shared/course-selection';
import {biologyScopeFromContext, biologyScopeInstructions, gcseBiologyIssue} from '../functions/_shared/gcse-biology-scope';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {checkBiologyPracticeCourse, biologyPracticeInstructions, assertBiologyPractice, biologyPracticeCacheVersion, biologyCachedRows, normalizeBiologyPracticePayload} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {gatewayMarkingInstructions} from '../functions/_shared/ocr-biology-scope';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {paper2Fixture, paper2Snapshot, fixtureScheme} from './aqa-paper2-fixtures';

const lookup = {subject: 'Biology Higher', examBoard: 'AQA', educationalTier: 'GCSE'};
const scope = (tier: 'foundation'|'higher') => biologyScopeFromContext(paper2Snapshot(tier));

describe.each(['foundation','higher'] as const)('AQA Paper 2 %s', tier => {
  it.each(['full_mock','short_practice'] as const)('routes %s through the saved paper and component', mode => {
    const {plan, rows, snapshot} = paper2Fixture(tier, mode);
    const selection = resolvePaperSelection(lookup, tier, {paperContract: snapshot.paper_contract});
    expect(selection.paperId).toBe('paper_2');
    expect(selection.componentCode).toBe(tier === 'foundation' ? '8461/2F' : '8461/2H');
    expect(paperPlanForAttempt(snapshot, {paperContract: {paperId:'paper_1'}})).toEqual(plan);
    expect(() => assertBiologyPlanIntegrity(plan)).not.toThrow();
    expect(validateQuestionCandidates(rows, {plan, scope: scope(tier), expectedTotalMarks: plan.totalMarks, expectedPartCount: plan.partCount}).defects).toEqual([]);
    expect(plan.totalMarks).toBe(mode === 'full_mock' ? 100 : 20);
    expect(plan.durationMinutes).toBe(mode === 'full_mock' ? 105 : 21);
    expect(plan.partCount).toBe(mode === 'full_mock' ? 36 : 8);
    for (const p of plan.parts) for (const ref of p.specRefs ?? []) {
      expect(AQA_P2_OUTCOMES[ref]).toBeTruthy();
      if (tier === 'foundation') expect(ref.endsWith('-HT')).toBe(false);
    }
  });
  it('keeps explicit maths/practical and AO targets separate from official facts', () => {
    const {plan} = paper2Fixture(tier);
    expect(['AO1','AO2','AO3'].map(ao => plan.parts.filter(p=>p.demand===ao).reduce((n,p)=>n+p.marks,0))).toEqual([40,40,20]);
    expect(plan.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)).toBe(18);
    expect(plan.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)).toBe(25);
    expect(plan.parts.filter(p=>p.marks===6)).toHaveLength(4);
    expect(aqaPaper2Instructions(plan)).toContain('not an official fixed AQA blueprint');
    expect(new Set(plan.parts.map(p=>p.topic))).toEqual(new Set(AQA_BIOLOGY_P2.topics));
  });
  it('blocks missing tasks, wrong counts, lost MCQs, resources and schemes', () => {
    const {plan, rows} = paper2Fixture(tier);
    rows[0].question_text = 'A student measured these results.'; rows[0].options = null;
    rows.find(r=>r.marks===6).correct_answer='Only a model answer.';
    rows.find(r=>r.diagram_config).diagram_config=null;
    const result=validateQuestionCandidates(rows.slice(0,-1), {plan, scope:scope(tier)});
    for(const code of ['missing_task','invalid_options','missing_answer','missing_required_resource','plan_mismatch'])
      expect(result.defects.some(d=>d.code===code)).toBe(true);
  });
  it('uses the same course in practice and marking without applying full-paper counts', () => {
    const context=paper2Snapshot(tier);
    expect(()=>checkBiologyPracticeCourse(context)).not.toThrow();
    const prompt=biologyPracticeInstructions(context);
    expect(prompt).toContain(context.component_code); expect(prompt).toContain('requested question count');
    expect(prompt).not.toContain('Section A: questions 1–15');
    expect(biologyMarkingInstructions(context)).toContain(context.component_code);
    expect(biologyMarkingInstructions(context)).toContain('never a penalty');
    expect(()=>assertBiologyPractice([{question_text:'Describe how insulin controls blood glucose.',correct_answer:'Insulin causes glucose to be converted to glycogen.',marks:3}],context)).not.toThrow();
    expect(()=>assertBiologyPractice([{question_text:'The investigation used ten seedlings.',correct_answer:'Mean',marks:2}],context)).toThrow(/missing_task/);
    expect(()=>assertBiologyPractice([{question_text:'Explain the evidence.',correct_answer:'A model answer.',marks:6}],context)).toThrow(/three-level/);
  });
});

describe('paper selection compatibility', () => {
  it('retains implicit legacy Paper 1 and requires explicit Paper 2 identity', () => {
    expect(getBiologyPaperPack('aqa_gcse_biology')?.paperId).toBe('paper_1');
    expect(biologyPaperOptions('aqa_gcse_biology').map(p=>p.paperId)).toEqual(['paper_1','paper_2']);
    expect(profilePaperId({courseSelection:{paperId:'paper_2'}})).toBe('paper_2');
    expect(buildPaperPlan('full_mock','foundation')?.paperId).toBe('paper_1');
    expect(()=>buildPaperPlan('full_mock',null,'aqa_gcse_biology','paper_2')).toThrow(/Foundation or Higher/);
    expect(()=>resolvePaperSelection(lookup,null,{courseSelection:{courseId:'aqa_gcse_biology',paperId:'paper_2'}})).toThrow(/Foundation or Higher/);
    expect(()=>paperPlanForAttempt({...paper2Snapshot(),component_code:'8461/2H'})).toThrow(/component/);
    expect(()=>paperPlanForAttempt({...paper2Snapshot(),context_version:1},{paperContract:paper2Snapshot().paper_contract})).toThrow(/fresh attempt/);
    expect(()=>checkBiologyPracticeCourse({...paper2Snapshot(),component_code:'8461/2H',paper_contract:null})).toThrow(/component/);
    expect(()=>resolvePaperSelection({...lookup,examBoard:'OCR'},'higher',{paperContract:paper2Snapshot().paper_contract})).toThrow();
  });
  it('does not change OCR marking text or add Paper 2 instructions to legacy AQA practice', () => {
    const context={resolved_by:'server',context_version:2,course_id:'ocr_gcse_biology_a_j247',component_code:'J247/01',assessment_tier:'foundation'};
    expect(biologyMarkingInstructions(context)).toBe(gatewayMarkingInstructions(context));
    expect(biologyPracticeInstructions({...paper2Snapshot(),paper_id:'paper_1'})).toBe('');
    expect(biologyPracticeCacheVersion({...paper2Snapshot(),paper_id:'paper_1'})).toBeNull();
    expect(biologyScopeInstructions(scope('foundation'))).not.toContain('AQA Paper 1:');
  });
});

describe('AQA tier boundaries are not copied from OCR', () => {
  it.each(['glucagon','ADH','deamination','thyroxine','IVF','gibberellins','ethene','transcription','translation'])('blocks Foundation %s in the stem or private key, but allows Higher', word => {
    expect(gcseBiologyIssue({question_text:'Explain the response.',correct_answer:word},scope('foundation'))).toContain('Higher-only');
    expect(gcseBiologyIssue({question_text:`Explain ${word}.`},scope('higher'))).toBeNull();
  });
  it.each(['FSH','LH','auxin','insulin','triplet code','cloning','biomass transfer efficiency','XX and XY','eye accommodation'])('allows legitimate Foundation content: %s', word => {
    expect(gcseBiologyIssue({question_text:`Describe ${word}.`},scope('foundation'))).toBeNull();
  });
  it.each(['Calvin cycle','Hardy-Weinberg','chi-squared','loop of Henle','nitrogen cycle','mRNA'])('blocks advanced/unrequired detail at both tiers: %s', word => {
    for(const tier of ['foundation','higher'] as const) expect(gcseBiologyIssue({question_text:`Explain ${word}.`},scope(tier))).not.toBeNull();
  });
  it('uses different Higher slot outcomes, not only a harder-language instruction', () => {
    const f=paper2Fixture().plan.parts, h=paper2Fixture('higher').plan.parts;
    expect(f.find(p=>p.questionNumber==='2(d)')?.specRefs).toEqual(['4.5.3.3']);
    expect(h.find(p=>p.questionNumber==='2(d)')?.specRefs).toEqual(['4.5.3.3-HT']);
  });
});

describe('practice identity and retained answer keys', () => {
  it('keeps structured schemes and common MCQ aliases before the quiz schema strips any fields', () => {
    const payload={questions:[{question_text:'Describe the investigation.',marks:6,question_type:'extended',expected_answer:'Repeat measurements.',mark_scheme:fixtureScheme},
      {context:'A hormone affects blood glucose.',task:'Which hormone lowers blood glucose?',marks:1,question_type:'mcq_single',choices:{A:'Insulin',B:'FSH',C:'LH',D:'Oestrogen'},expected_answer:'A'}]};
    const result=normalizeBiologyPracticePayload(payload,paper2Snapshot()) as typeof payload;
    expect((result.questions[0] as any).correct_answer).toContain('Level 3');
    expect((result.questions[1] as any).correct_answer).toBe('Insulin');
    expect((result.questions[1] as any).options).toEqual(['Insulin','FSH','LH','Oestrogen']);
    expect(()=>assertBiologyPractice(result.questions,paper2Snapshot())).not.toThrow();
    expect(normalizeBiologyPracticePayload(payload,{...paper2Snapshot(),paper_id:'paper_1'})).toBe(payload);
  });
  it('isolates paper/tier cache entries and preserves MCQ ordering on a cache hit', async () => {
    const params={subject:'Biology',examBoard:'AQA',educationalLevel:'GCSE',topics:['Ecology'],questionCount:8,difficulty:'mixed',questionFormat:'mixed',courseId:'aqa_gcse_biology',assessmentTier:'foundation',paperId:'paper_2',presetVersion:1,resourceVersion:biologyPracticeCacheVersion(paper2Snapshot())};
    const keys=await Promise.all([params,{...params,paperId:'paper_1'},{...params,assessmentTier:'higher'}].map(p=>buildCacheKey(p)));
    expect(new Set(keys).size).toBe(3);
    const row={id:'old',set_id:'old-set',question_number:'1',options:['One','Two','Three','Four'],correct_answer:'B'};
    const copied=biologyCachedRows([row],'new-set','profile')[0];
    expect(copied.options).toEqual(row.options); expect(copied.correct_answer).toBe('B');
    expect(copied.set_id).toBe('new-set'); expect(copied).not.toHaveProperty('id');
  });
});
