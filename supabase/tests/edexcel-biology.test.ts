// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {getCourseCapability,EDEXCEL_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {assertBiologyPlanIntegrity,biologyPaperOptions,getBiologyPaperPack,biologyBatchInstructions,biologyRepairInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {biologyScopeFromContext,biologyScopeInstructions,gcseBiologyIssue} from '../functions/_shared/gcse-biology-scope';
import {EDEXCEL_BIOLOGY_TOPICS,EDEXCEL_HIGHER_ONLY,edexcelTopicNumbers,edexcelOutcomeAllowed} from '../functions/_shared/edexcel-biology-scope';
import {edexcelBiologyInstructions} from '../functions/_shared/edexcel-biology-contract';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyPracticeInstructions,checkBiologyPracticeCourse,assertBiologyPractice,normalizeBiologyPracticePayload,biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {edexcelFixture,edexcelSnapshot} from './edexcel-biology-fixtures';
import {fixtureScheme} from './aqa-paper2-fixtures';
import {resolveProfileContext,toStoredGenerationContext,establishGenerationContext} from '../functions/_shared/profile-context';

const lookup={subject:'Biology Higher',examBoard:'Edexcel',educationalTier:'GCSE'};
describe('Edexcel catalogue and explicit selection',()=>{
  it('supports recognisable custom names but does not conflate qualifications',()=>{
    for(const subject of ['Biology','Biology Higher','Pearson Edexcel GCSE Biology Paper 2','GCSE Biology (1BI0) Foundation']) {
      expect(getCourseCapability({...lookup,subject})?.id).toBe(EDEXCEL_BIOLOGY_ID);
    }
    for(const subject of ['Combined Science Biology','Marine Biology','Human Biology','Microbiology']) expect(getCourseCapability({...lookup,subject})).toBeNull();
    expect(getCourseCapability({...lookup,examBoard:'Pearson Edexcel'})?.id).toBe(EDEXCEL_BIOLOGY_ID);
    for(const educationalTier of ['igcse','level3_a_level','university']) expect(getCourseCapability({...lookup,educationalTier})).toBeNull();
  });
  it('requires a saved paper and tier even in Custom, without using words in the name',()=>{
    expect(biologyPaperOptions(EDEXCEL_BIOLOGY_ID).map(p=>p.paperId)).toEqual(['paper_1','paper_2']);
    expect(getBiologyPaperPack(EDEXCEL_BIOLOGY_ID)).toBeNull();
    expect(()=>resolvePaperSelection(lookup,'higher',{})).toThrow(/Paper 1 or Paper 2/);
    expect(()=>resolvePaperSelection(lookup,null,{courseSelection:{courseId:EDEXCEL_BIOLOGY_ID,paperId:'paper_2'}})).toThrow(/Foundation or Higher/);
    expect(()=>resolvePaperSelection({...lookup,examBoard:'AQA'},'higher',{paperContract:edexcelSnapshot().paper_contract})).toThrow(/does not match/);
    expect(()=>resolvePaperSelection(lookup,'foundation',{paperContract:{...edexcelSnapshot().paper_contract,paperId:'paper_3'}})).toThrow();
    expect(()=>resolvePaperSelection(lookup,'foundation',{paperContract:{...edexcelSnapshot().paper_contract,contractVersion:999}})).toThrow(/Reapply/);
    expect(resolvePaperSelection(lookup,'foundation',{courseSelection:{courseId:EDEXCEL_BIOLOGY_ID,paperId:'paper_2'}}).componentCode).toBe('1BI0/2F');
  });
  it('refuses stale/contradictory saved context instead of trusting a caller override',()=>{
    const snapshot=edexcelSnapshot();
    expect(paperPlanForAttempt(snapshot,{paperContract:{...snapshot.paper_contract,paperId:'paper_2'}})?.paperId).toBe('paper_1');
    expect(()=>paperPlanForAttempt({...snapshot,component_code:'1BI0/1H'})).toThrow(/component/);
    expect(()=>paperPlanForAttempt({...snapshot,context_version:1},{paperContract:snapshot.paper_contract})).toThrow(/fresh attempt/);
    expect(()=>checkBiologyPracticeCourse({...snapshot,paper_contract:null,component_code:'1BI0/2F'})).toThrow(/component/);
    expect(()=>biologyMarkingInstructions({...snapshot,component_code:'1BI0/2F'})).toThrow(/component/);
  });
  it('resolves an owned profile and freezes its paper/tier across a retry',async()=>{
    const blueprint={courseSelection:{courseId:EDEXCEL_BIOLOGY_ID,paperId:'paper_2'},paperContract:edexcelSnapshot('paper_2').paper_contract};
    const profile={id:'p1',user_id:'owner',subject_name:'Biology Higher',exam_board:'Edexcel',educational_tier:'GCSE',assessment_tier:'foundation',paper_blueprint:blueprint};
    const filters:Record<string,unknown>={};
    const client={from:()=>{const q:any={select:()=>q,eq:(key:string,value:unknown)=>{filters[key]=value;return q;},maybeSingle:async()=>({data:filters.user_id==='owner'?profile:null,error:null})};return q;}};
    const resolved=await resolveProfileContext(client,{userId:'owner',subjectName:'Biology',profileId:'p1',examBoard:'AQA',assessmentTier:'higher'});
    const saved=toStoredGenerationContext(resolved);
    expect(saved.component_code).toBe('1BI0/2F');expect(saved.paper_contract).toEqual(blueprint.paperContract);
    profile.assessment_tier='higher';blueprint.courseSelection.paperId='paper_1';
    const retry=await establishGenerationContext({from:()=>{throw new Error('Do not reread an edited profile');}},'set','owner',{profile_id:'p1',generation_context:saved});
    expect(retry.component_code).toBe('1BI0/2F');
    await expect(resolveProfileContext(client,{userId:'stranger',subjectName:'Biology',profileId:'p1'})).rejects.toThrow(/not found/);
  });
});

describe.each(['paper_1','paper_2'] as const)('Edexcel %s contracts',paper=>{
  it.each(['foundation','higher'] as const)('builds and validates both %s modes with board-specific resources and counts',tier=>{
    for(const mode of ['short_practice','full_mock'] as const) {
      const {plan,rows,snapshot}=edexcelFixture(paper,tier,mode);
      expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();
      expect(paperPlanForAttempt(snapshot)).toEqual(plan);
      expect(plan.totalMarks).toBe(mode==='full_mock'?100:25);
      expect(plan.partCount).toBe(mode==='full_mock'?40:10);
      expect(plan.parentCount).toBe(mode==='full_mock'?10:5);
      expect(plan.durationMinutes).toBe(mode==='full_mock'?105:26);
      expect(new Set(plan.parts.map(p=>p.topic))).toEqual(new Set(edexcelTopicNumbers(paper).map(n=>EDEXCEL_BIOLOGY_TOPICS[n])));
      expect(plan.parts.filter(p=>p.responseType==='mcq_single')).toHaveLength(mode==='full_mock'?8:5);
      expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
      const prompt=edexcelBiologyInstructions(plan);
      expect(prompt).toContain(plan.componentCode); expect(prompt).toContain('PRIVATE');
      for(const p of plan.parts) for(const ref of p.specRefs??[]) expect(edexcelOutcomeAllowed(ref,paper,tier)).toBe(true);
    }
  });
  it('enforces AO, mathematics, practical and common-tier targets without promising paired papers',()=>{
    const f=edexcelFixture(paper).plan,h=edexcelFixture(paper,'higher').plan;
    expect(['AO1','AO2','AO3'].map(a=>f.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0))).toEqual([40,40,20]);
    expect(f.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)).toBeGreaterThanOrEqual(10);
    expect(f.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)).toBeGreaterThanOrEqual(15);
    expect(f.parts.filter(p=>p.commonTierTarget).reduce((n,p)=>n+p.marks,0)).toBe(27);
    expect(f.parts.filter(p=>p.commonTierTarget)).toEqual(h.parts.filter(p=>p.commonTierTarget));
    expect(f.parts.flatMap(p=>p.specRefs??[]).some(ref=>EDEXCEL_HIGHER_ONLY.has(ref))).toBe(false);
    expect(h.parts.flatMap(p=>p.specRefs??[]).some(ref=>EDEXCEL_HIGHER_ONLY.has(ref))).toBe(true);
    expect(edexcelBiologyInstructions(f)).toContain('do not mean separately generated');
    const corrupted=structuredClone(f);corrupted.parts[0].specRefs=['7.14'];
    expect(()=>assertBiologyPlanIntegrity(corrupted)).toThrow(/outcome/);
    const corruptedAO=structuredClone(f);corruptedAO.parts[0].demand='AO3';
    expect(()=>assertBiologyPlanIntegrity(corruptedAO)).toThrow(/totals/);
    const corruptedCommon=structuredClone(h);
    const commonPart=corruptedCommon.parts.find(p=>p.commonTierTarget&&p.questionNumber==='3(d)')!;
    commonPart.specRefs=paper==='paper_1'?['2.11B']:['6.4'];
    expect(()=>assertBiologyPlanIntegrity(corruptedCommon)).toThrow(/outcome/);
  });
  it('uses the exact same local outcomes in batches and repairs',()=>{
    const plan=edexcelFixture(paper,'higher').plan;
    const subset=plan.parts.filter(p=>p.parentId==='q4');
    const batch=biologyBatchInstructions(plan,subset);
    expect(batch).toContain('PARTS IN THIS RESPONSE: 4(a), 4(b), 4(c), 4(d)');
    const repair=biologyRepairInstructions(plan,new Set(subset.map(p=>p.questionNumber)),true);
    for(const part of subset) for(const ref of part.specRefs??[]) {expect(batch).toContain(ref+':');expect(repair).toContain(ref+':');}
    expect(batch).toContain('Level 3');
    expect(batch).not.toContain('Section A: questions 1–15');
  });
  it('blocks incomplete content before it becomes an exam',()=>{
    const {plan,rows,snapshot}=edexcelFixture(paper);
    rows[0].question_text='The table shows some results.';rows[0].options=null;
    rows.find(q=>q.marks===6).correct_answer='An explanation only.';
    rows.find(q=>q.diagram_config).diagram_config=null;
    const result=validateQuestionCandidates(rows.slice(0,-1),{plan,scope:biologyScopeFromContext(snapshot)});
    for(const code of ['missing_task','invalid_options','missing_answer','missing_required_resource','plan_mismatch']) expect(result.defects.some(d=>d.code===code)).toBe(true);
  });
});

describe('Edexcel is not subject to AQA content exclusions',()=>{
  it('enforces boundaries for every supported GCSE level alias',()=>{
    for(const educationalLevel of ['level2','level2_gcse','gcse','gcse_9_1','ks4','secondary_14_16','level 2']) {
      const scope={...biologyScopeFromContext(edexcelSnapshot('paper_2')),educationalLevel};
      expect(gcseBiologyIssue({correct_answer:'ADH controls water reabsorption.'},scope)).toContain('Higher-only');
    }
  });
  it.each([
    ['paper_1','Explain metaphase in mitosis.'],['paper_1','Describe ABO codominance.'],['paper_1','Explain the lysogenic cycle.'],
    ['paper_2',"Describe filtration in Bowman's capsule of a nephron."],['paper_2','Explain the nitrogen cycle.'],['paper_2',"Calculate diffusion using Fick's law."],
  ] as const)('allows common content in %s: %s',(paper,text)=>{
    expect(gcseBiologyIssue({question_text:text},biologyScopeFromContext(edexcelSnapshot(paper)))).toBeNull();
  });
  it.each([['paper_1','mRNA transcription'],['paper_1','monoclonal antibodies'],['paper_1','sex-linked inheritance'],
    ['paper_2','ADH feedback'],['paper_2','thyroxine and TRH'],['paper_2','inverse-square light intensity'],['paper_2','IVF']] as const)
  ('permits %s Higher content but stops Foundation assessing %s',(paper,text)=>{
    expect(gcseBiologyIssue({correct_answer:text},biologyScopeFromContext(edexcelSnapshot(paper,'foundation')))).toContain('Higher-only');
    expect(gcseBiologyIssue({correct_answer:text},biologyScopeFromContext(edexcelSnapshot(paper,'higher')))).toBeNull();
  });
  it('blocks the opposite paper and advanced biochemistry in stems and private keys',()=>{
    for(const tier of ['foundation','higher'] as const) {
      expect(gcseBiologyIssue({question_text:'Explain transpiration.'},biologyScopeFromContext(edexcelSnapshot('paper_1',tier)))).toContain('other paper');
      expect(gcseBiologyIssue({correct_answer:'Natural selection favours inherited variants.'},biologyScopeFromContext(edexcelSnapshot('paper_2',tier)))).toContain('other paper');
      expect(gcseBiologyIssue({correct_answer:'Calvin cycle'},biologyScopeFromContext(edexcelSnapshot('paper_2',tier)))).not.toBeNull();
    }
  });
});

describe('Edexcel quiz and marking context',()=>{
  it.each(['paper_1','paper_2'] as const)('keeps %s quizzes independent of paper counts and retains structured keys',paper=>{
    const context=edexcelSnapshot(paper);
    expect(()=>checkBiologyPracticeCourse(context)).not.toThrow();
    const prompt=biologyPracticeInstructions(context);
    expect(prompt).toContain('retain the requested count');expect(prompt).toContain(context.component_code);
    expect(prompt).not.toContain('3.8B:');expect(prompt).not.toContain('7.20B:');
    expect(biologyScopeInstructions(biologyScopeFromContext(context))).toMatch(/Pearson Edexcel/i);
    expect(biologyMarkingInstructions(context)).toContain('holistic best fit');
    expect(biologyMarkingInstructions(context)).not.toContain('Create one canonical chart_data');
    const payload={questions:[{task:'Which method improves a sample?',question_type:'mcq_single',marks:1,choices:{A:'Random sampling',B:'One sample',C:'Largest only',D:'Nearest only'},expected_answer:'A'},
      {instruction:'Explain how repeats improve the investigation.',marks:6,question_type:'extended',mark_scheme:fixtureScheme}]};
    const normal=normalizeBiologyPracticePayload(payload,context) as any;
    expect(normal.questions[0].correct_answer).toBe('Random sampling');
    expect(normal.questions[1].correct_answer).toContain('Level 3');
    expect(()=>assertBiologyPractice(normal.questions,context)).not.toThrow();
    normal.questions[0]={question_text:'Which method improves a sample?',question_type:'mcq',marks:1,options:['Random sampling','One sample','Largest only'],correct_answer:'Random sampling'};
    expect(()=>assertBiologyPractice(normal.questions,context)).toThrow(/four/);
    expect(()=>assertBiologyPractice([{question_text:'Explain the results.',correct_answer:'Repeat.',marks:6}],context)).toThrow(/three-level/);
  });
  it('separates both papers, both tiers and existing boards in cache identity',async()=>{
    const contexts=['paper_1','paper_2'].flatMap(paper=>['foundation','higher'].map(tier=>edexcelSnapshot(paper as any,tier as any)));
    const keys=await Promise.all(contexts.map(c=>buildCacheKey({subject:'Biology',examBoard:'Edexcel',educationalLevel:'GCSE',
      assessmentTier:c.assessment_tier,courseId:c.course_id,paperId:c.paper_id,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),
      topics:['Key concepts in biology'],difficulty:'mixed',questionCount:2,questionFormat:'mixed'})));
    expect(new Set(keys).size).toBe(4);
    expect(new Set(contexts.map(biologyPracticeCacheVersion)).size).toBe(2);
  });
});
