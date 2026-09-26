// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {getCourseCapability,OCR_21C_BIOLOGY_ID as COURSE,OCR_GATEWAY_BIOLOGY_ID} from '../functions/_shared/assessment-tier';
import {buildPaperPlan,supportsBiologyPaperContract} from '../functions/_shared/biology-paper-contract';
import {assertBiologyPlanIntegrity,biologyPaperOptions,getBiologyPaperPack,biologyBatchInstructions,biologyRepairInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {biologyScopeFromContext,biologyScopeInstructions,gcseBiologyIssue} from '../functions/_shared/gcse-biology-scope';
import {OCR21C_TOPICS,OCR21C_OUTCOMES,ocr21cOutcomeAllowed} from '../functions/_shared/ocr21c-biology-scope';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {biologyPracticeInstructions,checkBiologyPracticeCourse,assertBiologyPractice,normalizeBiologyPracticePayload,biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {ocr21cFixture,ocr21cSnapshot} from './ocr21c-fixtures';
import {fixtureScheme} from './aqa-paper2-fixtures';
import {resolveProfileContext,toStoredGenerationContext,establishGenerationContext} from '../functions/_shared/profile-context';
const lookup={subject:'Biology Higher',examBoard:'OCR',educationalTier:'GCSE'};

describe('explicit OCR Biology B selection',()=>{
  it('enables J257 but never chooses it or a tier from the subject label',()=>{
    for(const subject of ['Biology','Biology Higher','GCSE Biology B (J257) Foundation','Twenty First Century Biology B']) {
      expect(getCourseCapability({...lookup,subject,courseId:COURSE})?.generationAvailable).toBe(true);
      expect(getCourseCapability({...lookup,subject})).toBeNull();
    }
    expect(biologyPaperOptions(COURSE).map(p=>p.paperId)).toEqual(['breadth','depth']);
    expect(getBiologyPaperPack(COURSE)).toBeNull();
    expect(getBiologyPaperPack(OCR_GATEWAY_BIOLOGY_ID,'second_paper')).toBeNull();
    expect(()=>resolvePaperSelection(lookup,'higher',{})).toThrow(/Select your OCR Biology course/);
    expect(()=>resolvePaperSelection(lookup,'higher',{courseSelection:{courseId:COURSE}})).toThrow(/Breadth or Depth/);
    expect(()=>resolvePaperSelection(lookup,null,{courseSelection:{courseId:COURSE,paperId:'depth'}})).toThrow(/Foundation or Higher/);
    for(const educationalLevel of ['IGCSE','A Level','university']) expect(supportsBiologyPaperContract({...lookup,educationalLevel,courseId:COURSE,paperId:'depth'})).toBe(false);
  });
  it('rejects another board, unknown versions, incorrect components and ambiguous legacy attempts',()=>{
    const snapshot=ocr21cSnapshot();
    expect(()=>resolvePaperSelection({...lookup,examBoard:'Edexcel'},'foundation',{paperContract:snapshot.paper_contract})).toThrow(/does not match/);
    expect(()=>resolvePaperSelection(lookup,'foundation',{paperContract:{...snapshot.paper_contract,contractVersion:999}})).toThrow(/Reapply/);
    expect(()=>resolvePaperSelection(lookup,'foundation',{courseSelection:{courseId:COURSE,paperId:'depth'},paperContract:snapshot.paper_contract})).toThrow(/disagree/);
    expect(()=>paperPlanForAttempt({...snapshot,component_code:'J257/03'})).toThrow(/component/);
    expect(()=>paperPlanForAttempt({...snapshot,context_version:1},{paperContract:snapshot.paper_contract})).toThrow(/fresh attempt/);
    expect(()=>checkBiologyPracticeCourse({...snapshot,paper_contract:null,component_code:'J257/03'})).toThrow(/component/);
    expect(()=>biologyMarkingInstructions({...snapshot,component_code:'J247/01'})).toThrow(/component/);
    expect(paperPlanForAttempt(snapshot,{paperContract:{...snapshot.paper_contract,paperId:'depth'}})?.paperId).toBe('breadth');
  });
  it('freezes the owned profile choice and prevents another user resolving it',async()=>{
    const profile={id:'p1',user_id:'owner',subject_name:'Biology Higher',exam_board:'OCR',educational_tier:'GCSE',assessment_tier:'foundation',paper_blueprint:{paperContract:ocr21cSnapshot('depth').paper_contract}};
    const filters:Record<string,unknown>={};
    const client={from:()=>{const q:any={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},maybeSingle:async()=>({data:filters.user_id==='owner'?profile:null,error:null})};return q;}};
    const resolved=await resolveProfileContext(client,{userId:'owner',subjectName:'Biology',profileId:'p1',examBoard:'AQA',assessmentTier:'higher'});
    const saved=toStoredGenerationContext(resolved);
    expect(saved.component_code).toBe('J257/02');
    profile.assessment_tier='higher';
    const retry=await establishGenerationContext({from:()=>{throw Error('Retry must use the saved snapshot');}},'set','owner',{profile_id:'p1',generation_context:saved});
    expect(retry.component_code).toBe('J257/02');
    await expect(resolveProfileContext(client,{userId:'stranger',subjectName:'Biology',profileId:'p1'})).rejects.toThrow(/not found/);
  });
});

describe.each(['breadth','depth'] as const)('J257 %s templates',paper=>{
  it.each(['foundation','higher'] as const)('validates both %s modes and resource contracts',tier=>{
    for(const mode of ['short_practice','full_mock'] as const) {
      const {plan,rows,snapshot}=ocr21cFixture(paper,tier,mode);
      expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();expect(paperPlanForAttempt(snapshot)).toEqual(plan);
      expect(plan.totalMarks).toBe(mode==='full_mock'?90:paper==='breadth'?24:30);
      expect(plan.partCount).toBe(mode==='short_practice'?12:paper==='breadth'?45:36);
      expect(plan.durationMinutes).toBe(mode==='full_mock'?105:paper==='breadth'?28:35);
      expect(new Set(plan.parts.map(p=>p.topic))).toEqual(new Set(Object.values(OCR21C_TOPICS)));
      expect(plan.parts.filter(p=>p.marks===6)).toHaveLength(paper==='breadth'?0:2);
      expect(plan.parts.some(p=>p.section)).toBe(false);
      expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
      expect(plan.parts.flatMap(p=>p.specRefs??[]).every(ref=>ocr21cOutcomeAllowed(ref,tier))).toBe(true);
    }
  });
  it('targets component-specific AOs and embeds mathematical and practical marks',()=>{
    const f=ocr21cFixture(paper).plan,h=ocr21cFixture(paper,'higher').plan;
    expect(['AO1','AO2','AO3'].map(a=>f.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0))).toEqual(paper==='breadth'?[43,33,14]:[29,39,22]);
    expect(f.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)).toBeGreaterThanOrEqual(9);
    expect(f.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)).toBeGreaterThanOrEqual(14);
    expect(f.parts.flatMap(p=>p.specRefs??[]).some(ref=>OCR21C_OUTCOMES[ref].higher)).toBe(false);
    expect(h.parts.flatMap(p=>p.specRefs??[]).some(ref=>OCR21C_OUTCOMES[ref].higher)).toBe(true);
    expect(()=>buildPaperPlan('full_mock',null,COURSE,paper)).toThrow(/Foundation or Higher/);
    expect(buildPaperPlan('custom','foundation',COURSE,paper)).toBeNull();
    const bad=structuredClone(f);bad.parts[0].specRefs=['B1.1.9'];
    expect(()=>assertBiologyPlanIntegrity(bad)).toThrow(/outcome/);
    bad.parts[0].specRefs=f.parts[0].specRefs;bad.parts[0].section='A';
    expect(()=>assertBiologyPlanIntegrity(bad)).toThrow(/no Gateway/);
  });
  it('passes the same outcomes to batches and repairs, and rejects lost content',()=>{
    const {plan,rows,snapshot}=ocr21cFixture(paper,'higher');
    const subset=plan.parts.filter(p=>p.parentId==='q2');
    const batch=biologyBatchInstructions(plan,subset),repair=biologyRepairInstructions(plan,new Set(subset.map(p=>p.questionNumber)),true);
    for(const p of subset)for(const ref of p.specRefs??[]){expect(batch).toContain(ref+':');expect(repair).toContain(ref+':');}
    expect(batch).toContain(plan.componentCode);expect(batch).toContain('B7');expect(batch).toContain('B8');
    rows[0].question_text='A student recorded results.';rows[0].options=null;
    rows.find(q=>q.diagram_config).diagram_config=null;
    if(paper==='depth')rows.find(q=>q.marks===6).correct_answer='Only an answer.';
    const result=validateQuestionCandidates(rows.slice(0,-1),{plan,scope:biologyScopeFromContext(snapshot)});
    for(const code of ['missing_task','invalid_options','missing_required_resource','plan_mismatch',...(paper==='depth'?['missing_answer']:[])])expect(result.defects.some(d=>d.code===code)).toBe(true);
  });
});

it('keeps J257 GCSE science distinct from AQA and Higher-only content distinct from Foundation',()=>{
  const f=biologyScopeFromContext(ocr21cSnapshot()),h=biologyScopeFromContext(ocr21cSnapshot('depth','higher'));
  for(const text of ['Outline the light-dependent first stage of photosynthesis.','Compare relative ATP yields in respiration.','Explain natural selection.','Explain single-gene inheritance.','Calculate biomass-transfer efficiency.']) {
    expect(gcseBiologyIssue({question_text:text},f)).toBeNull();expect(gcseBiologyIssue({question_text:text},h)).toBeNull();
  }
  for(const term of ['mRNA','monoclonal antibodies','ADH','glucagon','inverse-square law','standard form']) {
    expect(gcseBiologyIssue({correct_answer:term},f)).toContain('Higher-only');expect(gcseBiologyIssue({correct_answer:term},h)).toBeNull();
  }
  for(const term of ['Calvin cycle','thylakoid','chemiosmosis','Krebs cycle']) {
    expect(gcseBiologyIssue({correct_answer:term},f)).toContain('beyond-GCSE');expect(gcseBiologyIssue({correct_answer:term},h)).toContain('beyond-GCSE');
  }
  expect(biologyScopeInstructions(f)).toContain('BREADTH');expect(biologyScopeInstructions(h)).toContain('DEPTH');
});

it('keeps quizzes small, normalises choices/keys and applies component-specific marking',()=>{
  for(const paper of ['breadth','depth'] as const) {
    const snapshot=ocr21cSnapshot(paper);
    const prompt=biologyPracticeInstructions(snapshot);
    expect(prompt).toContain(snapshot.component_code);expect(prompt).toContain('retain the requested count');
    expect(prompt).not.toContain('B1.1.9:');expect(prompt).not.toContain('B5.4.6:');
    expect(biologyMarkingInstructions(snapshot)).toContain(paper==='breadth'?'point-marked':'holistic best fit');
    const payload={questions:[{task:'Which method improves a sample?',question_type:'mcq',marks:1,choices:{A:'Random sampling',B:'Largest only',C:'One sample',D:'Nearest only'},expected_answer:'A'},
      {task:'Explain how repeats improve an investigation.',marks:paper==='depth'?6:3,question_type:'written',expected_answer:'Reduce random error.',...(paper==='depth'?{mark_scheme:fixtureScheme}:{})}]};
    const normal=normalizeBiologyPracticePayload(payload,snapshot) as any;
    expect(normal.questions[0].correct_answer).toBe('Random sampling');
    expect(()=>assertBiologyPractice(normal.questions,snapshot)).not.toThrow();
    expect(()=>assertBiologyPractice([{task:'Explain the results.',question_text:'Explain the results.',correct_answer:'Repeat.',marks:6}],snapshot)).toThrow(paper==='breadth'?/four marks/:/three-level/);
  }
});

it('uses separate caches for every J257 paper/tier and Gateway',async()=>{
  const contexts=['breadth','depth'].flatMap(p=>['foundation','higher'].map(t=>ocr21cSnapshot(p as any,t as any)));
  const params=contexts.map(c=>({subject:'Biology',examBoard:'OCR',educationalLevel:'GCSE',assessmentTier:c.assessment_tier,
    courseId:c.course_id,paperId:c.paper_id,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:['B1 You and your genes'],difficulty:'mixed',questionCount:2,questionFormat:'mixed'}));
  const keys=await Promise.all([...params,{...params[0],courseId:OCR_GATEWAY_BIOLOGY_ID,paperId:'first_paper'}].map(buildCacheKey));
  expect(new Set(keys).size).toBe(5);expect(new Set(contexts.map(biologyPracticeCacheVersion)).size).toBe(2);
});
