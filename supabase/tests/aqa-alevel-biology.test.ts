// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {AQA_ALEVEL_BIOLOGY_ID as COURSE,getCourseCapability,getAssessmentTierOptions,resolveCourseAssessmentTier,isValidAssessmentTierFor} from '../functions/_shared/assessment-tier';
import {buildPaperPlan} from '../functions/_shared/biology-paper-contract';
import {getBiologyPaperPack,biologyBatchInstructions} from '../functions/_shared/biology-course-packs';
import {resolvePaperSelection,paperPlanForAttempt} from '../functions/_shared/course-selection';
import {resolveProfileContext,toStoredGenerationContext,establishGenerationContext} from '../functions/_shared/profile-context';
import {biologyContentIssue,biologyScopeFromContext,biologyScopeInstructions} from '../functions/_shared/gcse-biology-scope';
import {biologyMarkingInstructions} from '../functions/_shared/biology-marking';
import {checkBiologyPracticeCourse,biologyPracticeCacheVersion,assertBiologyPractice} from '../functions/_shared/biology-practice';
import {AQA_ALEVEL_BIOLOGY_SPECIFICATION,AQA_ALEVEL_P1_OUTCOMES} from '../functions/_shared/aqa-alevel-biology-scope';
import {validateQuestionCandidates} from '../functions/_shared/question-contract-validator';
import {alevelFixture,alevelSnapshot,pointScheme} from './aqa-alevel-fixtures';
const lookup={subject:'Biology Higher',examBoard:'AQA',educationalTier:'level3'};
const blueprint={courseSelection:{courseId:COURSE,paperId:'paper_1',specificationVersion:AQA_ALEVEL_BIOLOGY_SPECIFICATION},paperContract:alevelSnapshot().paper_contract};

it('recognises custom display names without choosing a tier from the name',()=>{
  for(const subject of ['Biology','Biology Higher','AQA A-level Biology 7402 Paper 1','Biology Foundation']){
    const l={...lookup,subject};expect(getCourseCapability(l)?.id).toBe(COURSE);expect(getAssessmentTierOptions(l)).toEqual([]);
    expect(resolveCourseAssessmentTier(null,l)).toBe('not_tiered');
  }
  for(const educationalTier of ['AS','AS level','7401','AP','GCSE'])expect(getCourseCapability({...lookup,educationalTier})?.id).not.toBe(COURSE);
  expect(getCourseCapability({...lookup,examBoard:'OCR'})?.id).not.toBe(COURSE);
  expect(getCourseCapability({...lookup,subject:'Combined Science'})).toBeNull();
});
it('distinguishes untiered from unknown legacy and rejects explicit illegal tiers',()=>{
  expect(resolveCourseAssessmentTier(null,{subject:'Biology',examBoard:'AQA',educationalTier:'GCSE'})).toBeNull();
  expect(isValidAssessmentTierFor('not_tiered',lookup)).toBe(true);
  for(const tier of ['higher','foundation','banana']){
    expect(isValidAssessmentTierFor(tier,lookup)).toBe(false);
    expect(()=>resolveCourseAssessmentTier(tier,lookup)).toThrow();
  }
});
it('requires an explicit supported paper and does not cross qualification or edition',()=>{
  expect(getBiologyPaperPack(COURSE)).toBeNull();
  expect(()=>resolvePaperSelection(lookup,'not_tiered',null)).toThrow(/Choose and save/);
  expect(resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:COURSE,paperId:'paper_2'}}).componentCode).toBe('7402/2');
  for(const paperId of ['paper_4','unit_1'])expect(()=>resolvePaperSelection(lookup,'not_tiered',{courseSelection:{courseId:COURSE,paperId}})).toThrow();
  expect(()=>resolvePaperSelection({...lookup,educationalTier:'GCSE'},'higher',blueprint)).toThrow(/does not match/);
  expect(()=>resolvePaperSelection(lookup,'not_tiered',{...blueprint,paperContract:{...blueprint.paperContract,specificationVersion:'old'}})).toThrow(/version/);
  expect(resolvePaperSelection(lookup,'not_tiered',blueprint).curriculum?.qualification).toBe('A-level');
});

it('builds the full 76+15 mark paper with its own outcomes and no GCSE level-response quota',()=>{
  const {plan}=alevelFixture();
  expect([plan.totalMarks,plan.durationMinutes,plan.partCount,plan.parentCount]).toEqual([91,120,34,9]);
  expect(plan.parts.filter(p=>p.assessmentRole==='extended_response').reduce((s,p)=>s+p.marks,0)).toBe(15);
  expect(plan.parts.filter(p=>p.assessmentRole==='structured').reduce((s,p)=>s+p.marks,0)).toBe(76);
  expect(['AO1','AO2','AO3'].map(ao=>plan.parts.filter(p=>p.demand===ao).reduce((s,p)=>s+p.marks,0))).toEqual([42,29,20]);
  expect(plan.parts.every(p=>p.specRefs?.every(ref=>AQA_ALEVEL_P1_OUTCOMES[ref]))).toBe(true);
  expect(plan.parts.some(p=>p.responseType==='mcq_single'||p.marks===6)).toBe(false);
  const prompt=biologyBatchInstructions(plan,plan.parts.slice(-3));
  expect(prompt).toContain('9(a), 9(b), 9(c)');expect(prompt).toContain('extended_response');expect(prompt).toContain('No three-level GCSE rubric');
  expect(getBiologyPaperPack(COURSE,'paper_1')?.validation.levelSchemeAtMarks).toBeNull();
});
it('builds a reduced practice and refuses Foundation/Higher plans',()=>{
  const {plan}=alevelFixture('short_practice');expect([plan.totalMarks,plan.durationMinutes,plan.partCount,plan.parentCount]).toEqual([25,33,8,4]);
  expect(buildPaperPlan('custom','not_tiered',COURSE,'paper_1')).toBeNull();
  for(const tier of ['foundation','higher',null] as const)expect(()=>buildPaperPlan('full_mock',tier,COURSE,'paper_1')).toThrow();
});
it('allows legitimate A-level Paper 1 knowledge and keeps GCSE exclusions in place',()=>{
  const scope=biologyScopeFromContext(alevelSnapshot());
  for(const text of ['Explain transcription and mRNA splicing.','Describe ATP synthase and ATP hydrolysis.','Describe chloroplast thylakoid structure.','Explain water potential and osmosis.','Describe the Bohr effect.','Compare DNA sequences and natural selection.']){
    expect(biologyContentIssue({question_text:text},scope)).toBeNull();
  }
  expect(biologyContentIssue({question_text:'Explain the thylakoid membrane.'},{subject:'Biology',educationalLevel:'GCSE',examBoard:'AQA',assessmentTier:'higher'})).toContain('A-level');
  expect(biologyScopeInstructions(scope)).not.toContain('GCSE BIOLOGY KNOWLEDGE BOUNDARY');
});
it.each(['Explain the Calvin cycle.','Describe the action potential.','Calculate the Hardy-Weinberg frequency.','Explain PCR.','Calculate the standard deviation of the readings.'])('blocks out-of-paper task %s',question_text=>{
  const {rows,snapshot}=alevelFixture('short_practice');rows[0].question_text=question_text;
  expect(validateQuestionCandidates(rows,{scope:biologyScopeFromContext(snapshot)}).defects.some(d=>d.code==='out_of_level')).toBe(true);
});
it('requires a valid frozen edition for exam, practice and marking',()=>{
  const valid=alevelSnapshot();expect(paperPlanForAttempt(valid)?.totalMarks).toBe(91);
  expect(biologyMarkingInstructions(valid)).toContain('point-based');expect(()=>checkBiologyPracticeCourse(valid)).not.toThrow();
  for(const patch of [{context_version:1},{specification_version:null},{component_code:'8461/1H'},{assessment_tier:'higher'},{paper_id:'paper_2'}]){
    const bad={...valid,...patch};expect(()=>paperPlanForAttempt(bad)).toThrow();expect(()=>checkBiologyPracticeCourse(bad)).toThrow();expect(()=>biologyMarkingInstructions(bad)).toThrow();
  }
});
it('point-marks six-mark A-level quizzes and separates their cache from GCSE',()=>{
  const context=alevelSnapshot('short_practice');
  expect(()=>assertBiologyPractice([{id:'q',question_number:'1',marks:6,question_type:'written',question_text:'Explain how to investigate osmosis fairly.',correct_answer:pointScheme}],context)).not.toThrow();
  expect(biologyPracticeCacheVersion(context)).toContain('7402');expect(biologyPracticeCacheVersion(context)).toContain(AQA_ALEVEL_BIOLOGY_SPECIFICATION);
});
it('derives and freezes untiered context from an owned profile',async()=>{
  const profile={id:'p',user_id:'owner',subject_name:'Biology Higher',exam_board:'AQA',educational_tier:'level3',assessment_tier:null,paper_blueprint:blueprint};
  const filters:any[]=[];
  const db:any={from(){const q:any={select:()=>q,eq:(...a:any[])=>{filters.push(a);return q;},maybeSingle:async()=>({data:profile,error:null})};return q;}};
  const resolved=await resolveProfileContext(db,{userId:'owner',profileId:'p',subjectName:'Wrong name',examBoard:'OCR',assessmentTier:'higher'});
  expect(resolved.assessmentTier).toBe('not_tiered');expect(resolved.assessmentTierSupported).toBe(false);
  expect(filters).toContainEqual(['user_id','owner']);
  const stored=toStoredGenerationContext(resolved);expect(stored.curriculum).toEqual(alevelSnapshot().curriculum);
  profile.educational_tier='GCSE';
  const set={profile_id:'p',generation_context:stored,exam_board:'OCR',educational_tier:'GCSE'};
  const result=await establishGenerationContext({from(){throw Error('Retry must not re-read the edited profile');}},'set','owner',set);
  expect(result).toBe(stored);expect(set.educational_tier).toBe('level3');expect(paperPlanForAttempt(result)?.componentCode).toBe('7402/1');
});
