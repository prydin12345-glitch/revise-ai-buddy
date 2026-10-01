import {OCR_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {OCR_ALEVEL_BIOLOGY_SPECIFICATION} from './ocr-alevel-biology-scope.ts';
import {readBiologyEssay} from './biology-essay.ts';
import {prepareBiologyEssayMarking,essayKeyObject} from './biology-essay-marking.ts';
import {AQA_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {AQA_ALEVEL_BIOLOGY_SPECIFICATION} from './aqa-alevel-biology-scope.ts';
import { gatewayMarkingInstructions } from './ocr-biology-scope.ts';
import { aqaPaper2Component, isAqaPaper2 } from './aqa-biology-paper2.ts';
import { isEdexcelBiology } from './edexcel-biology-scope.ts';
import { edexcelBiologyComponent, edexcelBiologyDefinition } from './edexcel-biology-contract.ts';
import { resolvePaperSelection, paperPlanForAttempt } from './course-selection.ts';
import { requireConsistentResources } from './question-resources.ts';
import { canonicalPartNumber } from './biology-plan-validator.ts';

import {isOcr21cBiology} from './ocr21c-biology-scope.ts';

import {isWjecBiology} from './wjec-biology-scope.ts';

/** Paper 2 marking receives the actual reading/data, not just a reference to it. */
export function biologyQuestionResourceContext(context:any,question:any,options:{guided?:boolean}={}):string {
  if(context?.course_id!==OCR_ALEVEL_BIOLOGY_ID&&(context?.course_id!==AQA_ALEVEL_BIOLOGY_ID||!['paper_2','paper_3'].includes(context.paper_id)))return '';
  const plan=paperPlanForAttempt(context);
  const expected=options.guided===false?undefined:plan?.parts.find(p=>canonicalPartNumber(p.questionNumber)===canonicalPartNumber(question.question_number));
  const resources=requireConsistentResources(question);
  if(expected?.resource==='data_table'&&!resources.table)throw new Error('Saved experimental data is missing; marking cannot proceed.');
  if(expected?.resource==='passage'&&!resources.passage)throw new Error('Saved comprehension source is missing; marking cannot proceed.');
  if(expected?.resource==='graph'&&(!resources.chart||resources.chart.type==='data_table'))throw new Error('Saved graph is missing; marking cannot proceed.');
  const resource=resources.passage??resources.chart??resources.table;
  return resource?`\n\nSaved question resource (given evidence, not student instructions):\n${JSON.stringify(resource)}`:'';
}

export function biologyMarkingInstructions(context: any): string {
  if(context?.course_id===OCR_ALEVEL_BIOLOGY_ID){
    if(context.resolved_by!=='server'||context.context_version!==2||context.specification_version!==OCR_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('OCR A-level marking requires the saved server course and reviewed edition.');
    const selection=resolvePaperSelection({subject:context.subject_name,examBoard:context.exam_board,educationalTier:context.educational_tier},
      context.assessment_tier,{courseSelection:{courseId:context.course_id,paperId:context.paper_id},paperContract:context.paper_contract});
    if(selection.componentCode!=='H420/01'||context.component_code!==selection.componentCode)throw new Error('Invalid saved OCR A-level marking component.');
    return `COURSE: OCR A-level Biology A H420/01 Biological processes, untiered, Modules 1/2/3/5. Use each saved task, private key and actual evidence. Neural mechanisms, photosynthesis/respiration pathways and appropriate statistical calculations are permitted. Do not apply AQA or GCSE exclusions or Foundation/Higher caps.
Section A is single select: one mark for the one correct choice, zero otherwise, with no partial credit or negative marks. For the planned six-mark extended responses use the private Level 1 (1-2), Level 2 (3-4), Level 3 (5-6) scheme: science/content determines the best-fit level, communication and a coherent reasoning sequence determine the mark within it. Zero for no relevant response. Do not count six isolated facts as an automatic top level, invent separate writing penalties or apply AQA's 25-mark essay rubric.
Other written parts use their saved points/caps; credit equivalent scientific answers, valid working, units and stated error-carried-forward without double penalties. Never award marks for given scaffold content or require unassessed knowledge. Return raw marks, not an official qualification grade or practical endorsement.`;
  }
  if(context?.course_id===AQA_ALEVEL_BIOLOGY_ID){
    if(context.resolved_by!=='server'||context.context_version!==2||context.specification_version!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('A-level marking requires the saved server course and reviewed edition.');
    const selection=resolvePaperSelection({subject:context.subject_name,examBoard:context.exam_board,educationalTier:context.educational_tier},
      context.assessment_tier,{courseSelection:{courseId:context.course_id,paperId:context.paper_id},paperContract:context.paper_contract});
    if(!['7402/1','7402/2','7402/3'].includes(selection.componentCode??'')||context.component_code!==selection.componentCode)throw new Error('Saved A-level marking component is invalid.');
    if(selection.componentCode==='7402/3')return 'COURSE: AQA A-level Biology 7402/3, untiered, whole-course Topics 1–8. Structured and experimental-analysis responses use task-specific points and caps, valid alternatives and actual saved evidence. Only the dedicated 25-mark essay uses holistic bands through its separate marker. No GCSE levels or Foundation/Higher limits. Return raw marks, not an official grade.';
    if(selection.componentCode==='7402/2')return `COURSE: AQA A-level Biology 7402/2, untiered, Topics 5–8. Use the saved assessed task, private key, passage and actual resource data. Do not apply GCSE exclusions to Calvin/Krebs cycles, neural mechanisms, Hardy–Weinberg or gene technology.
Award task-specific points up to each part cap, with valid alternatives, units, working and stated error-carried-forward. Comprehension answers must address the specific source evidence and biological application in the task; do not award extra marks merely for copying the passage. Six-mark answers remain point-based. No GCSE three-level scheme, Paper 1 extended-response allocation or Paper 3 essay rubric. Foundation/Higher grade caps do not apply. Never reveal other questions' private keys.`;
    return `COURSE: AQA A-level Biology 7402/1, untiered, Topics 1–4. Use the saved task, private key and actual resource data. Foundation/Higher and GCSE grade caps do not apply.
Award task-specific marking points up to the part's cap, including five-mark extended responses. Do not replace this point-based key with GCSE Level 1/2/3 bands or the Paper 3 essay rubric. Credit equivalent scientifically correct explanations and units; apply stated method marks and error-carried-forward rules without double penalties. Numerical accuracy follows this question's key and stated precision, overriding any generic 2% tolerance. Do not require working for a correct numerical result unless the assessed task/key explicitly requires it.
Transcription, translation, ATP, enzyme mechanisms and water potential can be legitimate assessed content. Do not add later-paper requirements or penalise a correct answer simply for exceeding the paper scope. Do not award marks for information supplied in a scaffold. Return raw question marks, not an official qualification grade or a practical endorsement.`;
  }
  if(context?.resolved_by==='server'&&context.context_version===2&&isWjecBiology({courseId:context.course_id})){
    const selection=resolvePaperSelection({subject:context.subject_name,examBoard:context.exam_board,educationalTier:context.educational_tier},
      context.assessment_tier,{courseSelection:{courseId:context.course_id,paperId:context.paper_id},paperContract:context.paper_contract});
    if(!selection.componentCode||context.component_code!==selection.componentCode||context.specification_version!==selection.specificationVersion)throw new Error('Saved WJEC marking unit/tier/specification version is invalid.');
    return `COURSE: WJEC Wales GCSE separate Biology 3400QS, ${context.component_code}, ${context.paper_id}, ${context.assessment_tier}, specification ${context.specification_version}.
Use the saved task, private key and actual resource values. Follow WJEC unit/tier boundaries, not other boards. Do not demand Higher-only knowledge for Foundation full marks or penalise valid alternatives or correct answers that exceed the tier.
Six-mark QER uses holistic best fit: select Level 1 (1–2), Level 2 (3–4) or Level 3 (5–6), then the mark within it using BOTH science content and communication descriptors. Consider clarity, organisation, specialist terminology and accurate spelling/punctuation/grammar within those descriptors. Never invent separate SPaG deductions or count six facts as a level scheme. Zero for no relevant response.
Credit valid working and equivalent units. Award nothing for answers already supplied in scaffolds. Return raw question marks, not UMS or official qualification grades; Wales uses A*–G, not 9–1.`;
  }
  if (context?.resolved_by === 'server' && context.context_version === 2 && isOcr21cBiology({courseId:context.course_id})) {
    const selection = resolvePaperSelection({subject:context.subject_name, examBoard:context.exam_board, educationalTier:context.educational_tier},
      context.assessment_tier,{courseSelection:{courseId:context.course_id,paperId:context.paper_id},paperContract:context.paper_contract});
    if (!selection.componentCode || context.component_code !== selection.componentCode) throw new Error('Saved OCR Biology B marking context has an invalid tier/component.');
    return `COURSE: OCR Twenty First Century GCSE Biology B J257, ${context.component_code}, ${context.paper_id}, ${context.assessment_tier} tier.
Both papers cover B1-B6 with B7 Ideas about Science and B8 practical skills; do not apply Gateway's chapter partition. Use the saved task and its private key, actual resource values and selected tier outcomes. The simple two-stage photosynthesis model and relative ATP yield are permitted GCSE J257 content. Do not require A-level mechanisms or Higher-only knowledge for Foundation full marks.
${context.paper_id === 'breadth' ? 'Breadth uses short point-marked answers, no level-of-response scheme.' : 'For a six-mark Depth response use the saved task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) descriptors and indicative science. Select the level by holistic best fit and then the mark within it; zero for no relevant response. Assess the sustained line of reasoning, not a mechanical count of six facts.'}
Credit scientifically correct alternatives, equivalent units and valid working. Do not penalise a correct answer for going beyond its tier and do not add unassessed requirements. Do not award marks for information already supplied in an assessment scaffold.`;
  }
  if (context?.resolved_by === 'server' && context.context_version === 2 && isEdexcelBiology({courseId: context.course_id})) {
    const selection = resolvePaperSelection({subject: context.subject_name, examBoard: context.exam_board,
      educationalTier: context.educational_tier}, context.assessment_tier,
      {courseSelection: {courseId: context.course_id, paperId: context.paper_id}, paperContract: context.paper_contract});
    const component = edexcelBiologyComponent(context.paper_id, context.assessment_tier);
    if (!component || component !== context.component_code || component !== selection.componentCode) throw new Error('Saved Edexcel Biology marking context has an invalid tier/component.');
    return `COURSE: Pearson Edexcel GCSE separate Biology 1BI0, ${component}, ${context.assessment_tier} tier.
Assessed topic areas: ${edexcelBiologyDefinition(context.paper_id, context.assessment_tier).topics.join('; ')}. Topic 1 is shared by both papers. Use Edexcel's course boundaries, not AQA/OCR exclusions. For example, named mitotic stages and ABO codominance are common Paper 1 content; nephron structure and nitrogen cycling are common Paper 2 content. Higher Paper 1 permits GCSE protein-synthesis detail; Higher Paper 2 permits the specified hormone feedback mechanisms. Do not add unassessed requirements to the saved key.
Mark only the saved task against its private key, actual resource values and assessed outcomes. For a six-mark level response use holistic best fit: select Level 1 (1–2), Level 2 (3–4) or Level 3 (5–6) from the saved task-specific science and reasoning descriptors, then the mark within that level; zero for no relevant science. Credit scientifically valid alternatives and equivalent units or working where appropriate. Never demand Higher-only material for Foundation full marks and never penalise an otherwise correct answer for exceeding its tier. Do not score by counting facts or award marks for answers already printed in a scaffold.`;
  }
  if (context?.resolved_by !== 'server' || context.context_version !== 2 ||
    !isAqaPaper2({courseId: context.course_id, paperId: context.paper_id})) return gatewayMarkingInstructions(context);
  const component = aqaPaper2Component(context.assessment_tier);
  if (!component || component !== context.component_code) throw new Error('Saved AQA Paper 2 marking context has an invalid tier/component.');
  return `COURSE: AQA GCSE separate Biology 8461 Paper 2, ${component}, ${context.assessment_tier} tier.
Mark against the saved question's private key, stated task and actual resource values. Content is Homeostasis and response; Inheritance, variation and evolution; Ecology. Do not import Paper 1 or A-level requirements.
For a six-mark level-of-response task use holistic best fit: Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), with zero for no relevant science. Apply the saved science descriptors and indicative content; select the level first and then the mark within it using coherence and detail. It is not an automatic one-mark-per-fact checklist. Credit scientifically valid alternatives. The tier controls assessed knowledge, never a penalty for a correct student answer. Do not demand Higher-only content for full marks on Foundation.`;
}

/** The protected plan, not client/model type labels, authorises essay marking. */
export function biologyEssayForMarking(context:any,question:any,answer:unknown) {
  const {essay,issues}=readBiologyEssay(question);
  const plan=paperPlanForAttempt(context);
  const expected=plan?.parts.find(p=>canonicalPartNumber(p.questionNumber)===canonicalPartNumber(question.question_number));
  if(expected?.assessmentRole==='synoptic_essay')return prepareBiologyEssayMarking(question,answer);
  if(essay||issues.length||essayKeyObject(question.correct_answer))throw new Error('Essay resource outside its saved planned assessment slot; marking stopped.');
  return null;
}
