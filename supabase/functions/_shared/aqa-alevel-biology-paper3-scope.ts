import { AQA_ALEVEL_BIOLOGY_SPECIFICATION, AQA_ALEVEL_P1_TOPICS, AQA_ALEVEL_P1_OUTCOMES } from './aqa-alevel-biology-scope.ts';
import { AQA_ALEVEL_P2_TOPICS, AQA_ALEVEL_P2_OUTCOMES } from './aqa-alevel-biology-paper2-scope.ts';
export const AQA_ALEVEL_P3_TOPICS = [...AQA_ALEVEL_P1_TOPICS, ...AQA_ALEVEL_P2_TOPICS] as const;
/** Whole-course pool: earlier-paper exclusions do not apply to synoptic Paper 3. */
export const AQA_ALEVEL_P3_OUTCOMES: Record<string,{topic:number;text:string}> = {
  ...AQA_ALEVEL_P1_OUTCOMES,
  ...Object.fromEntries(Object.entries(AQA_ALEVEL_P2_OUTCOMES).map(([ref,entry])=>[ref,{...entry,topic:entry.topic+4}])),
  '3.1.6':{topic:0,text:'ATP structure, hydrolysis/resynthesis, ATP synthase and phosphorylation; integrate with photosynthesis, respiration and transport where relevant.'},
  '3.2.1':{topic:1,text:'Eukaryotic organelles, prokaryotes, viruses, microscopy and cell fractionation; link structure to processes across the course.'},
  '3.4.7':{topic:3,text:'Comparing sequences, representative sampling, means and interpretation of supplied standard deviations; links to gene technology are permitted.'},
};
export const AQA_ALEVEL_P3_RULES = `AQA A-level Biology 7402/3, specification ${AQA_ALEVEL_BIOLOGY_SPECIFICATION}; full A-level, untiered, Topics 1–8 and relevant practical skills 1–12.
Paper 3 is 78 marks in 120 minutes: 38 structured marks including practical techniques, 15 critical-analysis marks using given experimental data, and ONE 25-mark essay chosen from TWO titles. Group/part counts, selected topic pools and skill annotations are Examly choices, not official fixed counts. Short practice is reduced and labelled separately.
Use synoptic application across the whole course. Calvin/Krebs cycles, chemiosmosis, neural mechanisms, inheritance and gene technology are allowed. Do not import Paper 1/2 exclusions or GCSE tier rules. Every scored row needs a separately stated task and sufficient givens. Original synthetic experiments must include context, measured results/units, sample sizes, controls and interpretable uncertainty or variability; never fabricate missing cells during repair.
Structured and critical-analysis keys use independently creditable points, working and caps. Only the 25-mark essay uses the dedicated five-band holistic rubric. All private guidance stays in correct_answer, never in public resources. Interpret supplied standard deviations without calculating them; provide unfamiliar formulae. Mathematical targets require actual mathematical work, not merely describing a graph. A written mock does not award the practical endorsement.`;
export function aqaAlevelPaper3ContentIssue(text:string):string|null {
  if(/\b(?:calculate|compute|work out)\b[^.?!\n]{0,70}\bstandard deviation\b/i.test(text))return 'Interpret supplied standard deviations; do not require their calculation.';
  if(/\bMichaelis[-– ]Menten\b|\bLineweaver[-– ]Burk\b|\bNernst equation\b/i.test(text))return 'This assessed mechanism exceeds the reviewed AQA A-level outcomes; use the planned outcome pool.';
  return null;
}
