import { OCR_GATEWAY_BIOLOGY_ID } from './assessment-tier.ts';
import type { PaperPlan, PlannedPart } from './biology-paper-contract.ts';

// Paraphrased from OCR J247 specification v4.0, August 2026, B1–B3.
// Bold Higher-only learning outcomes were checked against the PDF, not its
// plain-text extraction. B7 practical skills are embedded in these topics.
export const GATEWAY_SPEC: Record<string, string> = {
  'B1.1a': 'Microscopy observations, magnification and scientific drawings.',
  'B1.1b': 'Plant, animal and bacterial cell structures and their functions.',
  'BM1.1i': 'Magnification calculations with accessible units and values.',
  'BM1.1iii': 'Standard-form calculations in microscopy (Higher only).',
  'B1.2a': 'DNA as a polymer.',
  'B1.2b': 'Two DNA strands forming a double helix.',
  'B1.2c': 'Nucleotides, complementary bases and the DNA model.',
  'B1.2d': 'Simple protein synthesis, transcription and translation (Higher only).',
  'B1.2e': 'Triplet code and amino-acid sequence (Higher only).',
  'B1.2f': 'Enzyme action, temperature and pH; interpreting investigations.',
  'B1.2g': 'Enzyme specificity, active sites and effects of pH, temperature and concentrations.',
  'B1.3a': 'Continuous cellular respiration supplying ATP in all living cells.',
  'B1.3b': 'Respiration as an exothermic reaction.',
  'B1.3c': 'Aerobic and anaerobic respiration: reactants, products and relative energy transfer.',
  'B1.3d': 'Sugars as monomers in carbohydrate synthesis and breakdown.',
  'B1.3e': 'Amino acids as monomers in protein synthesis and breakdown.',
  'B1.3f': 'Fatty acids and glycerol in lipid synthesis and breakdown.',
  'B1.4a': 'Photosynthetic organisms as producers of food and biomass.',
  'B1.4b': 'Simple two-stage photosynthesis: light energy splits water, releasing oxygen; hydrogen combines with carbon dioxide to make glucose. Use only this GCSE account in the task AND key; do not name advanced cycles or describe biochemical pathways.',
  'B1.4c': 'Photosynthesis as an endothermic process.',
  'B1.4d': 'Photosynthesis experiments, such as testing a light-excluded leaf for starch.',
  'B1.4e': 'Effects of light, temperature and carbon dioxide on photosynthesis rate, with data interpretation.',
  'B1.4f': 'Interacting limiting factors in photosynthesis (Higher only).',
  'BM1.4v': 'Inverse-square relationships for light intensity (Higher only).',
  'B2.1a': 'Diffusion, osmosis and active transport; qualitative water potential, not equations.',
  'B2.1b': 'Cell cycle, mitosis and growth.',
  'B2.1c': 'Differentiation and specialised cells.',
  'B2.1d': 'Stem-cell locations in embryos, adults and plant meristems.',
  'B2.1e': 'Stem cells in growth, development and repair.',
  'B2.1f': 'Differences between embryonic and adult stem cells.',
  'BM2.1i': 'Percentage changes in mass and appropriate units.',
  'B2.2a': 'Surface-area-to-volume ratio, diffusion distance and the need for exchange and transport.',
  'B2.2b': 'Substances transported into and out of organisms.',
  'B2.2d': 'Heart and blood-vessel adaptations.',
  'B2.2c': 'Heart, blood vessels and the double circulatory system.',
  'B2.2e': 'Adaptations of red blood cells and plasma for transport.',
  'B2.2f': 'Root-hair adaptations for water and mineral-ion uptake.',
  'B2.2g': 'Transpiration and translocation.',
  'B2.2h': 'Xylem and phloem structures adapted to transport.',
  'B2.2i': 'Environmental effects on water uptake; interpreting potometer data.',
  'B2.2j': 'Using a potometer to investigate water uptake and calculate rates.',
  'B3.1a': 'Nervous coordination and the roles of receptors and effectors.',
  'B3.1c': 'Reflex arcs, synapses and reaction-time investigations.',
  'B3.1d': 'Eye structures and their functions.',
  'B3.1f': 'Brain regions and their functions.',
  'B3.1g': 'Difficulties of studying brain function (Higher only).',
  'B3.1h': 'Difficulties treating nervous-system damage (Higher only).',
  'B3.2a': 'Endocrine glands, hormones and transport in blood.',
  'B3.2b': 'Thyroxine and adrenaline, including thyroxine feedback (Higher only).',
  'B3.2c': 'Hormones in reproduction and menstrual-cycle control: oestrogen, progesterone, FSH and testosterone; not Higher-only interactions.',
  'B3.2d': 'Interactions of FSH, LH, oestrogen and progesterone in the menstrual cycle (Higher only).',
  'B3.2e': 'Hormonal and non-hormonal contraception and comparison of effectiveness.',
  'B3.2f': 'Hormonal treatments for infertility (Higher only).',
  'B3.2g': 'Plant responses to light and gravity.',
  'B3.2h': 'Effects of auxins, gibberellins and ethene on growth, germination, ripening, flowers and leaf fall.',
  'B3.2i': 'Practical uses of plant hormones (Higher only).',
  'B3.3a': 'Homeostasis and maintaining suitable internal conditions.',
  'B3.3b': 'Temperature regulation, including effectors.',
  'B3.3c': 'Blood glucose control by insulin.',
  'B3.3d': 'Interaction of insulin and glucagon in blood glucose control (Higher only).',
  'B3.3e': 'Type 1 and Type 2 diabetes and treatments.',
  'B3.3f': 'Qualitative effects of osmotic changes on cells; no water-potential equations.',
  'B3.3h': 'Gross kidney and tubule structures, including the collecting duct.',
  'B3.3g': 'Kidney control of water balance through urine volume and concentration.',
  'B3.3i': 'ADH and changes in collecting-duct permeability (Higher only).',
  'B3.3j': 'Osmotic challenges and hormonal water regulation (Higher only).',
};
export const GATEWAY_HIGHER_ONLY = new Set(Object.entries(GATEWAY_SPEC)
  .filter(([, text]) => text.includes('(Higher only)')).map(([ref]) => ref));

export const GATEWAY_RULES = `OCR GATEWAY BIOLOGY A J247 — FIRST PAPER ONLY:
Foundation J247/01 (Paper 1), Higher J247/03 (Paper 3). Scope B1 Cell level systems, B2 Scaling up, B3 Organism level systems, with B7 practical skills.
Do not import AQA's Paper 1 topic list. Exclude assessed knowledge from B4 Community level systems, B5 Genes/inheritance/selection and B6 Global challenges, including disease/immunity/ecology. DNA structure and cell division in B1/B2 ARE allowed; do not exclude them just because they concern DNA.
Basic ATP in respiration, qualitative water potential and a simple two-stage account of photosynthesis ARE GCSE Gateway content at both tiers. Higher also includes simple protein synthesis and hormonal feedback. Never require Calvin-cycle intermediates, NADPH, chemiosmosis, electron transport chains or detailed thylakoid/stroma mechanisms.
For B1.4b, the entire answer is the simple account above: light energy splits water and releases oxygen; hydrogen combines with carbon dioxide to make glucose. Do not mention the Calvin cycle, thylakoids or stroma anywhere in the generated question or private key, including as optional credit or an exclusion note.
Foundation must not assess bold Higher-only outcomes: standard-form microscopy calculations, transcription/translation/triplet code, inverse-square law, interacting photosynthesis limiting factors, brain-research/treatment difficulties, thyroxine/adrenaline feedback, reproductive-hormone interactions or infertility treatment, uses of plant hormones, glucagon/ADH feedback or osmotic regulation mechanisms. Basic insulin, brain/eye structures and gross kidney functions remain allowed.
Use complete instructions, consistent units and private answer keys. Every scored part must be answerable from its text and actual attached resources. Graphs for sampled continuous time use numeric x values and a line, not categorical bars. Never invent a second dataset to draw a resource.`;

export function gatewayPartInstruction(part: PlannedPart, includeOptions = true): string {
  return `${part.questionNumber} | Section ${part.section} | ${part.marks} marks | ${part.responseType} | ${part.demand} | ${part.topic}` +
    ` | ${(part.specRefs ?? []).map(ref => `${ref}: ${GATEWAY_SPEC[ref] ?? 'UNSUPPORTED REF'}`).join('; ')}` +
    (includeOptions && part.responseType === 'mcq_single' ? ' | Return an "options" array of exactly four distinct non-empty choices (plain text, no A./B. prefixes) and a correct_answer matching one of them exactly.' : '') +
    (part.resource === 'none' ? '' : ` | Supply a complete ${part.resource} payload with real, self-consistent data.`) +

    (part.mathsMarks ? ` | At least ${part.mathsMarks} marks must require mathematical work, with workings and units in the private key.` : '') +
    (part.practicalMarks ? ` | At least ${part.practicalMarks} marks must assess practical methods, evidence or evaluation.` : '') +
    (part.marks === 6 ? ' | Use a level-of-response key: Level 1 (1–2), Level 2 (3–4), Level 3 (5–6), 0 no relevant science; specific science descriptors, indicative content and communication guidance.' : '');
}
export function gatewayPlanInstructions(plan: PaperPlan | null): string {
  if (plan?.courseId !== OCR_GATEWAY_BIOLOGY_ID) return '';
  return `OCR GUIDED CONTRACT: ${plan.label}, ${plan.componentCode}, ${plan.totalMarks} marks / ${plan.durationMinutes} minutes.
${plan.mode === 'full_mock' ? 'Section A: questions 1–15, 15 marks. Section B: questions 16–24, 75 marks.' : 'This is a short practice selection, not a full official-length paper.'}
Generate exactly the listed scored rows, in order. No extra context-only parent rows. Do not regroup or renumber. Section A MCQs use question_type="mcq", exactly four distinct options A–D, one answer (letter or exact option). Other rows use question_type="written".
Each row must contain separate context and task fields, marks, question_number, root_question_number and a private correct_answer. Section A roots equal their own numbers and have no parent; Section B parent/root equal the leading number. Use the exact listed topic as topic_tag. Use chart_data with type=data_table for tables, type=line_chart for sampled continuous data; supply real data, labels and units. Only one canonical payload per resource, no duplicate markdown tables.
The Section B allocation below is Examly's practice template, not a claim that every OCR paper uses these groups.
${plan.parts.map(part => gatewayPartInstruction(part)).join('\n')}`;
}
export function gatewayMarkingInstructions(context: any): string {
  if (context?.resolved_by !== 'server' || context.course_id !== OCR_GATEWAY_BIOLOGY_ID) return '';
  return `COURSE: OCR Gateway Biology A, ${context.component_code}, ${context.assessment_tier} tier.
${GATEWAY_RULES}
Use the saved question's private scheme and actual resource values. For a six-mark level-of-response task, apply holistic best fit: Level 1 1–2, Level 2 3–4, Level 3 5–6; zero for no relevant science. Select the level by scientific content and skills, then use coherence and communication to select the mark within it. Credit valid alternatives. Do not turn six marks into an automatic six-fact checklist. Tier controls what was assessed, never a deduction for an otherwise correct answer.`;
}
