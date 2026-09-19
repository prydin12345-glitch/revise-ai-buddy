import { gatewayMarkingInstructions } from './ocr-biology-scope.ts';
import { aqaPaper2Component, isAqaPaper2 } from './aqa-biology-paper2.ts';

export function biologyMarkingInstructions(context: any): string {
  if (context?.resolved_by !== 'server' || context.context_version !== 2 ||
    !isAqaPaper2({courseId: context.course_id, paperId: context.paper_id})) return gatewayMarkingInstructions(context);
  const component = aqaPaper2Component(context.assessment_tier);
  if (!component || component !== context.component_code) throw new Error('Saved AQA Paper 2 marking context has an invalid tier/component.');
  return `COURSE: AQA GCSE separate Biology 8461 Paper 2, ${component}, ${context.assessment_tier} tier.
Mark against the saved question's private key, stated task and actual resource values. Content is Homeostasis and response; Inheritance, variation and evolution; Ecology. Do not import Paper 1 or A-level requirements.
For a six-mark level-of-response task use holistic best fit: Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), with zero for no relevant science. Apply the saved science descriptors and indicative content; select the level first and then the mark within it using coherence and detail. It is not an automatic one-mark-per-fact checklist. Credit scientifically valid alternatives. The tier controls assessed knowledge, never a penalty for a correct student answer. Do not demand Higher-only content for full marks on Foundation.`;
}
