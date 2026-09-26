// @vitest-environment node
import {describe,expect,it} from 'vitest';
import {getCourseCapability,WJEC_BIOLOGY_ID as COURSE} from '../functions/_shared/assessment-tier';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {getBiologyPaperPack,biologyPaperOptions,assertBiologyPlanIntegrity,biologyBatchInstructions,biologyRepairInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {resolveProfileContext,toStoredGenerationContext,establishGenerationContext} from '../functions/_shared/profile-context';
import {WJEC_BIOLOGY_SPECIFICATION as SPEC,WJEC_GRADE_RANGES,WJEC_UNIT3_VERSIONS,wjecUnit3ForCohort} from '../functions/_shared/wjec-biology-specification';
import {WJEC_OUTCOMES,WJEC_TOPICS,wjecOutcomeAllowed} from '../functions/_shared/wjec-biology-scope';
import {biologyScopeFromContext,biologyScopeInstructions,gcseBiologyIssue} from '../functions/_shared/gcse-biology-scope';
import {biologyPracticeInstructions,checkBiologyPracticeCourse,assertBiologyPractice,normalizeBiologyPracticePayload,biologyPracticeCacheVersion} from '../functions/_shared/biology-practice';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {buildCacheKey} from '../functions/_shared/cache-utils';
import {wjecFixture,wjecSnapshot} from './wjec-fixtures';
import {fixtureScheme} from './aqa-paper2-fixtures';
const lookup={subject:'Biology Higher',examBoard:'WJEC',educationalTier:'GCSE'};
it('recognises custom names but requires unit/tier and separates Wales from Eduqas',()=>{
  for(const subject of ['Biology','Biology Higher','WJEC Biology (Wales) Unit 2','GCSE Biology Foundation 3400QS'])expect(getCourseCapability({...lookup,subject})?.id).toBe(COURSE);
  for(const subject of ['Combined Science Biology','The Sciences Double Award','Microbiology'])expect(getCourseCapability({...lookup,subject})).toBeNull();
  for(const examBoard of ['Eduqas','WJEC Eduqas','OCR','Edexcel'])expect(getCourseCapability({...lookup,examBoard,courseId:COURSE})).toBeNull();
  for(const educationalTier of ['IGCSE','A Level','university'])expect(getCourseCapability({...lookup,educationalTier})).toBeNull();
  expect(getBiologyPaperPack(COURSE)).toBeNull();expect(getBiologyPaperPack(COURSE,'unit_3')).toBeNull();
  expect(biologyPaperOptions(COURSE).map(p=>p.paperId)).toEqual(['unit_1','unit_2']);
  expect(()=>resolvePaperSelection(lookup,'higher',{})).toThrow(/Unit 1 or Unit 2/);
  expect(()=>resolvePaperSelection(lookup,null,{courseSelection:{courseId:COURSE,paperId:'unit_1'}})).toThrow(/Foundation or Higher/);
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:COURSE,paperId:'unit_3'}})).toThrow(/not available/);
});
it('records both practical editions without choosing a cohort from the current date',()=>{
  expect(wjecUnit3ForCohort(null)).toBeNull();expect(wjecUnit3ForCohort(undefined)).toBeNull();
  expect(wjecUnit3ForCohort('before_september_2026')).toMatchObject({title:'Practical Assessment',marks:30,assessmentTier:'not_tiered',generationAvailable:false});
  expect(wjecUnit3ForCohort('from_september_2026')).toMatchObject({title:'Scientific Enquiry',marks:28,firstTeaching:'2026-09',firstAward:2028,practicalMarks:6,writtenMarks:22,practicalMinutes:60,writtenMinutes:60});
  expect(new Set(Object.values(WJEC_UNIT3_VERSIONS).map(v=>v.specificationVersion)).size).toBe(2);
  expect(WJEC_GRADE_RANGES).toEqual({foundation:'C–G',higher:'A*–D'});
});
it('rejects conflicting units, boards, components, templates and editions',()=>{
  const s=wjecSnapshot();
  expect(()=>resolvePaperSelection({...lookup,examBoard:'Eduqas'},'foundation',{paperContract:s.paper_contract})).toThrow(/does not match/);
  expect(()=>resolvePaperSelection(lookup,'foundation',{paperContract:{...s.paper_contract,contractVersion:999}})).toThrow(/Reapply/);
  expect(()=>resolvePaperSelection(lookup,'foundation',{courseSelection:{courseId:COURSE,paperId:'unit_2'},paperContract:s.paper_contract})).toThrow(/disagree/);
  expect(()=>resolvePaperSelection(lookup,'foundation',{paperContract:{...s.paper_contract,specificationVersion:'wjec-3400-v2-2019-01'}})).toThrow(/specification/);
  for(const patch of [{component_code:'3400UA'},{context_version:1},{specification_version:null}])expect(()=>paperPlanForAttempt({...s,...patch})).toThrow();
  expect(()=>checkBiologyPracticeCourse({...s,paper_contract:null,specification_version:null})).toThrow(/specification/);
  expect(()=>biologyMarkingInstructions({...s,component_code:'3400UB'})).toThrow(/invalid/);
  expect(paperPlanForAttempt(s,{paperContract:{...s.paper_contract,paperId:'unit_2'}})?.paperId).toBe('unit_1');
});
it('freezes the owned unit/edition server-side including Custom quiz retries',async()=>{
  const profile={id:'p',user_id:'owner',subject_name:'Biology Higher',exam_board:'WJEC',educational_tier:'GCSE',assessment_tier:'foundation',paper_blueprint:{courseSelection:{courseId:COURSE,paperId:'unit_2'}}};
  const filters:Record<string,unknown>={};const db={from:()=>{const q:any={select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},maybeSingle:async()=>({data:filters.user_id==='owner'?profile:null,error:null})};return q;}};
  const saved=toStoredGenerationContext(await resolveProfileContext(db,{userId:'owner',profileId:'p',subjectName:'Biology',examBoard:'Eduqas',assessmentTier:'higher'}));
  expect(saved).toMatchObject({component_code:'3400U2',specification_version:SPEC,paper_contract:null,assessment_tier:'foundation'});
  profile.assessment_tier='higher';profile.paper_blueprint.courseSelection.paperId='unit_1';
  expect(await establishGenerationContext({from:()=>{throw Error('Retry must not reread profile');}},'set','owner',{profile_id:'p',generation_context:saved})).toEqual(saved);
  expect(biologyPracticeInstructions(saved)).toContain('UNIT 2');
  await expect(resolveProfileContext(db,{userId:'stranger',profileId:'p',subjectName:'Biology'})).rejects.toThrow(/not found/);
});
describe.each(['unit_1','unit_2'] as const)('WJEC %s',unit=>{
  it.each(['foundation','higher'] as const)('builds both %s modes with correct components/resources',tier=>{
    for(const mode of ['short_practice','full_mock'] as const){
      const {plan,rows,snapshot}=wjecFixture(unit,tier,mode);
      expect(()=>assertBiologyPlanIntegrity(plan)).not.toThrow();expect(paperPlanForAttempt(snapshot)).toEqual(plan);
      expect(plan).toMatchObject({totalMarks:mode==='full_mock'?80:27,durationMinutes:mode==='full_mock'?105:35,partCount:mode==='full_mock'?32:12,specificationVersion:SPEC});
      expect(plan.componentCode).toBe(unit==='unit_1'?(tier==='foundation'?'3400U1':'3400UA'):(tier==='foundation'?'3400U2':'3400UB'));
      expect(plan.parts.filter(p=>p.responseType==='mcq_single')).toHaveLength(mode==='full_mock'?4:2);
      expect(plan.parts.filter(p=>p.marks===6)).toHaveLength(mode==='full_mock'?2:1);
      expect(validateQuestionCandidates(rows,{plan,scope:biologyScopeFromContext(snapshot)}).defects).toEqual([]);
      expect(plan.parts.flatMap(p=>p.specRefs??[]).every(ref=>wjecOutcomeAllowed(ref,unit,tier))).toBe(true);
    }
  });
  it('targets AO proportions and genuinely different tier outcomes',()=>{
    const f=wjecFixture(unit).plan,h=wjecFixture(unit,'higher').plan;
    expect(['AO1','AO2','AO3'].map(a=>f.parts.filter(p=>p.demand===a).reduce((n,p)=>n+p.marks,0))).toEqual([32,32,16]);
    expect(f.parts.reduce((n,p)=>n+(p.mathsMarks??0),0)).toBeGreaterThanOrEqual(8);expect(f.parts.reduce((n,p)=>n+(p.practicalMarks??0),0)).toBeGreaterThanOrEqual(12);
    expect(new Set(f.parts.map(p=>p.topic)).size).toBe(unit==='unit_1'?6:8);
    expect(f.parts.flatMap(p=>p.specRefs??[]).some(ref=>WJEC_OUTCOMES[ref].higher)).toBe(false);
    expect(h.parts.flatMap(p=>p.specRefs??[]).some(ref=>WJEC_OUTCOMES[ref].higher)).toBe(true);
    expect(buildPaperPlan('custom','foundation',COURSE,unit)).toBeNull();
    const bad=structuredClone(f);bad.parts[0].specRefs=['1.1h-HT'];expect(()=>assertBiologyPlanIntegrity(bad)).toThrow(/outcome/);
    bad.parts[0].specRefs=f.parts[0].specRefs;bad.specificationVersion='unknown';expect(()=>assertBiologyPlanIntegrity(bad)).toThrow(/specification/);
  });
  it('carries exact outcomes into batches and repairs without weakening gates',()=>{
    const {plan,rows,snapshot}=wjecFixture(unit,'higher'),subset=plan.parts.filter(p=>p.parentId==='q3');
    const batch=biologyBatchInstructions(plan,subset),repair=biologyRepairInstructions(plan,new Set(subset.map(p=>p.questionNumber)),true);
    for(const p of subset)for(const ref of p.specRefs??[]){expect(batch).toContain(ref+':');expect(repair).toContain(ref+':');}
    expect(batch).toContain(SPEC);expect(batch).toContain('communication');
    rows[0].question_text='A student recorded measurements.';rows[0].options=null;rows.find(q=>q.diagram_config).diagram_config=null;rows.find(q=>q.marks===6).correct_answer='Just a model answer.';
    const result=validateQuestionCandidates(rows.slice(0,-1),{plan,scope:biologyScopeFromContext(snapshot)});
    for(const code of ['missing_task','invalid_options','missing_required_resource','plan_mismatch','missing_answer'])expect(result.defects.some(d=>d.code===code)).toBe(true);
  });
});
it('applies WJEC-specific Higher boundaries while allowing common GCSE knowledge',()=>{
  const f=biologyScopeFromContext(wjecSnapshot()),h=biologyScopeFromContext(wjecSnapshot('unit_2','higher'));
  for(const text of ['Explain insulin action.','Describe complementary A/T and C/G base pairing.','Explain natural selection.','Complete the monohybrid cross.','Describe reflex properties.'])expect(gcseBiologyIssue({question_text:text},f)).toBeNull();
  for(const term of ['active transport','ATP','limiting factors','nitrogen cycle','capture–recapture','relay neurone','glucagon','nephron','ADH','triplet code','adenine','continuous variation','memory cells','monoclonal antibodies']){
    expect(gcseBiologyIssue({correct_answer:term},f)).toContain('Higher-only');expect(gcseBiologyIssue({correct_answer:term},h)).toBeNull();
  }
  for(const term of ['Calvin cycle','thylakoid','chemiosmosis','Krebs cycle','mRNA','light-dependent stage']){
    expect(gcseBiologyIssue({correct_answer:term},f)).toContain('beyond-GCSE');expect(gcseBiologyIssue({correct_answer:term},h)).toContain('beyond-GCSE');
  }
  expect(biologyScopeInstructions(f)).toContain('UNIT 1');expect(biologyScopeInstructions(h)).toContain('UNIT 2');
});
it('normalises private quiz keys and supplies WJEC QER marking guidance',()=>{
  for(const unit of ['unit_1','unit_2'] as const){
    const s=wjecSnapshot(unit),prompt=biologyPracticeInstructions(s);expect(prompt).toContain('retain the requested count');expect(prompt).toContain(SPEC);
    for(const [ref,o] of Object.entries(WJEC_OUTCOMES))if(o.higher||!wjecOutcomeAllowed(ref,unit,'foundation'))expect(prompt).not.toContain(ref+':');
    const payload={questions:[{task:'Which method improves the sample?',question_type:'mcq',marks:1,choices:{A:'Random sampling',B:'Nearest',C:'Largest',D:'One sample'},expected_answer:'A'},
      {task:'Explain how to improve the investigation.',question_type:'written',marks:6,mark_scheme:fixtureScheme}]};
    const normal=normalizeBiologyPracticePayload(payload,s) as any;expect(normal.questions[0].correct_answer).toBe('Random sampling');expect(()=>assertBiologyPractice(normal.questions,s)).not.toThrow();
    expect(()=>assertBiologyPractice([{question_text:'Explain the results.',marks:6,correct_answer:'Only a fact.'}],s)).toThrow(/three-level/);
    expect(biologyMarkingInstructions(s)).toContain('BOTH science content and communication');
  }
});
it('separates unit/tier/edition caches and excludes other boards',async()=>{
  const contexts=['unit_1','unit_2'].flatMap(u=>['foundation','higher'].map(t=>wjecSnapshot(u as any,t as any)));
  const params=contexts.map(c=>({subject:'Biology',examBoard:'WJEC',educationalLevel:'GCSE',assessmentTier:c.assessment_tier,courseId:c.course_id,
    paperId:c.paper_id,presetVersion:1,resourceVersion:biologyPracticeCacheVersion(c),topics:[WJEC_TOPICS['1.1']],questionCount:2,questionFormat:'mixed',difficulty:'mixed'}));
  const keys=await Promise.all([...params,{...params[0],resourceVersion:'old-edition'},{...params[0],examBoard:'Eduqas'}].map(buildCacheKey));
  expect(new Set(keys).size).toBe(6);expect(params.every(p=>p.resourceVersion?.includes(SPEC))).toBe(true);
});
