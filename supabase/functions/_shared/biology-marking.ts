import {AQA_ALEVEL_BIOLOGY_ID} from './assessment-tier.ts';
import {AQA_ALEVEL_BIOLOGY_SPECIFICATION} from './aqa-alevel-biology-scope.ts';
import { gatewayMarkingInstructions } from './ocr-biology-scope.ts';
import { aqaPaper2Component, isAqaPaper2 } from './aqa-biology-paper2.ts';
import { isEdexcelBiology } from './edexcel-biology-scope.ts';
import { edexcelBiologyComponent, edexcelBiologyDefinition } from './edexcel-biology-contract.ts';
import { resolvePaperSelection } from './course-selection.ts';

import {isOcr21cBiology} from './ocr21c-biology-scope.ts';

import {isWjecBiology} from './wjec-biology-scope.ts';

export function biologyMarkingInstructions(context: any): string {
  if(context?.course_id===AQA_ALEVEL_BIOLOGY_ID){
    if(context.resolved_by!=='server'||context.context_version!==2||context.specification_version!==AQA_ALEVEL_BIOLOGY_SPECIFICATION)throw new Error('A-level marking requires the saved server course and reviewed edition.');
    const selection=resolvePaperSelection({subject:context.subject_name,examBoard:context.exam_board,educationalTier:context.educational_tier},
      context.assessment_tier,{courseSelection:{courseId:context.course_id,paperId:context.paper_id},paperContract:context.paper_contract});
    if(selection.componentCode!=='7402/1'||context.component_code!==selection.componentCode)throw new Error('Saved A-level marking component is invalid.');
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
