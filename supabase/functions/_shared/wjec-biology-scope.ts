import {WJEC_BIOLOGY_ID} from './assessment-tier.ts';
import {WJEC_BIOLOGY_SPECIFICATION,WJEC_WRITTEN_UNITS,type WjecBiologyUnit} from './wjec-biology-specification.ts';
// Original summaries anchored to specification clauses. HT suffixes separate
// bold Higher content inside otherwise common clauses. Not an exhaustive syllabus.
export const WJEC_TOPICS = {
  '1.1':'1.1 Cells and movement across membranes',
  '1.2':'1.2 Respiration and the respiratory system in humans',
  '1.3':'1.3 Digestion and the digestive system in humans',
  '1.4':'1.4 Circulatory system in humans',
  '1.5':'1.5 Plants and photosynthesis',
  '1.6':'1.6 Ecosystems, nutrient cycles and human impact on the environment',
  '2.1':'2.1 Classification and biodiversity',
  '2.2':'2.2 Cell division and stem cells',
  '2.3':'2.3 DNA and inheritance',
  '2.4':'2.4 Variation and evolution',
  '2.5':'2.5 Response and regulation',
  '2.6':'2.6 Kidneys and homeostasis',
  '2.7':'2.7 Micro-organisms and their applications',
  '2.8':'2.8 Disease, defence and treatment',
} as const;
export type WjecTopic = keyof typeof WJEC_TOPICS;
type Outcome={topic:WjecTopic;text:string;higher?:true};
export const WJEC_OUTCOMES:Record<string,Outcome> = {
  '1.1a-b':{topic:'1.1',text:'Plant/animal cell structures and functions; light microscopy and scientific drawings from observation.'},
  '1.1c-d':{topic:'1.1',text:'Specialised cells and the cell–tissue–organ–system hierarchy.'},
  '1.1e-g':{topic:'1.1',text:'Diffusion and osmosis; selectively permeable membranes; Visking-tubing evidence.'},
  '1.1h-HT':{topic:'1.1',higher:true,text:'Active transport against a concentration gradient.'},
  '1.1i,k-l':{topic:'1.1',text:'Enzyme catalysts, active sites, lock-and-key and collisions; temperature, pH and denaturation. Foundation does not require enzyme-substrate complexes or protein folding.'},
  '1.1j-k-HT':{topic:'1.1',higher:true,text:'Amino-acid chains fold to give enzyme shape; enzyme-substrate complex formation.'},
  '1.2a-b':{topic:'1.2',text:'Word equations for aerobic and human anaerobic respiration; energy release, lactic acid and oxygen debt. Foundation does not assess ATP or incomplete-glucose-breakdown efficiency.'},
  '1.2a-b-HT':{topic:'1.2',higher:true,text:'ATP carries released energy; anaerobic respiration produces less ATP per glucose because breakdown is incomplete.'},
  '1.2c-h':{topic:'1.2',text:'Ventilation, lung structures, alveolar adaptations, bell-jar model limitations and inspired/expired air data.'},
  '1.3a-d':{topic:'1.3',text:'Soluble digestion products; carbohydrase, protease and lipase; iodine, Benedict’s and biuret tests.'},
  '1.3e-j':{topic:'1.3',text:'Digestive organs, peristalsis, bile, absorption and nutrient uses; model-gut limitations.'},
  '1.3k-m':{topic:'1.3',text:'Balanced diet, health and measuring food energy. Supply any calorimetry equation and required inputs.'},
  '1.4a-b':{topic:'1.4',text:'Blood components and red-cell/phagocyte adaptations.'},
  '1.4c-j':{topic:'1.4',text:'Heart chambers, vessels and valves, double circulation, capillary exchange and vessel adaptations.'},
  '1.4k-l':{topic:'1.4',text:'Cardiovascular risk; compare statins, angioplasty and lifestyle changes.'},
  '1.5a-d':{topic:'1.5',text:'Photosynthesis word equation, chlorophyll and glucose uses; investigate light, carbon dioxide or temperature effects. Foundation describes individual factor effects without limiting-factor analysis.'},
  '1.5b-HT':{topic:'1.5',higher:true,text:'Photosynthesis limiting factors; inverse-square light-intensity calculations.'},
  '1.5e-g,i-k':{topic:'1.5',text:'Leaves, stomata, root hairs, osmosis, xylem, phloem and transpiration; investigate environmental effects on water loss.'},
  '1.5h-HT':{topic:'1.5',higher:true,text:'Mineral-ion uptake into root hairs by active transport.'},
  '1.6a-c,e-g':{topic:'1.6',text:'Food webs, energy losses, pyramids, decay and carbon cycling. Foundation does not calculate trophic-transfer efficiency or require nitrogen-cycle mechanisms.'},
  '1.6d,h-HT':{topic:'1.6',higher:true,text:'Trophic energy-transfer efficiency; nitrogen fixation, decomposition, nitrification and denitrification.'},
  '1.6i-m':{topic:'1.6',text:'Farming impacts, indicator species, bioaccumulation and eutrophication; water-quality evidence.'},
  '2.1a-e':{topic:'2.1',text:'Classification, scientific names, adaptation, competition and biodiversity conservation.'},
  '2.1f-g':{topic:'2.1',text:'Quadrat sampling, abundance and representative, sufficient samples.'},
  '2.1h-HT':{topic:'2.1',higher:true,text:'Capture–recapture population estimates and assumptions.'},
  '2.2a-d':{topic:'2.2',text:'Chromosome pairs; purposes/outcomes of mitosis and meiosis; uncontrolled division and cancer. Do not require named mitotic phases.'},
  '2.2e-f':{topic:'2.2',text:'Adult/embryonic stem cells, differentiation and potential tissue repair.'},
  '2.3a-b':{topic:'2.3',text:'DNA helix, sugar/phosphate chains, A/T/C/G, base pairing and order determining proteins. Foundation uses letters, not full base names or triplet-code detail.'},
  '2.3a-b-HT':{topic:'2.3',higher:true,text:'Adenine, thymine, cytosine, guanine and triplet code in protein synthesis. Do not require transcription/translation machinery.'},
  '2.3c-e':{topic:'2.3',text:'DNA profiling: separated fragments give bands; profile comparisons and applications.'},
  '2.3f-j':{topic:'2.3',text:'Alleles, genotype/phenotype, monohybrid inheritance, Punnett squares, ratios and XX/XY. Supply parents but leave assessed offspring/results blank.'},
  '2.4a-g':{topic:'2.4',text:'Genetic/environmental variation, sexual/asexual reproduction, mutation, cystic fibrosis, selection and extinction. Foundation need not classify continuous/discontinuous variation.'},
  '2.4a-HT':{topic:'2.4',higher:true,text:'Continuous and discontinuous variation and suitable data displays.'},
  '2.4h':{topic:'2.4',text:'Selection for antibiotic, pesticide and warfarin resistance.'},
  '2.5a-c,e-g':{topic:'2.5',text:'Sense organs, nervous system, reflex properties, eye structures, homeostasis and hormones. Foundation does not require the detailed reflex-arc pathway.'},
  '2.5d-HT':{topic:'2.5',higher:true,text:'Reflex arcs: receptor, sensory/relay/motor neurones, spinal cord, synapses and effector.'},
  '2.5h-k':{topic:'2.5',text:'Insulin lowers glucose through liver glycogen storage; diabetes, skin and thermoregulation. Foundation does not require glucagon or negative-feedback mechanisms.'},
  '2.5l-HT':{topic:'2.5',higher:true,text:'Negative feedback in glucose control by insulin/glucagon and temperature regulation.'},
  '2.6a-c,f-g':{topic:'2.6',text:'Kidneys and excretory system, urine, gross structure, water balance and artificial urine tests. Foundation relates intake to dilute/concentrated urine without nephron mechanisms or ADH.'},
  '2.6d-e,g-HT':{topic:'2.6',higher:true,text:'Nephron structure, pressure filtration, selective reabsorption and ADH.'},
  '2.6h-j':{topic:'2.6',text:'Dialysis versus transplantation, rejection and immunosuppression. Foundation need not explain dialysis-machine mechanisms.'},
  '2.7a-c':{topic:'2.7',text:'Aseptic culture, colonies, original bacterial numbers, temperature and food storage; antibiotic-growth practical.'},
  '2.7d':{topic:'2.7',text:'Penicillium fermenter conditions and penicillin extraction from the medium.'},
  '2.8a-g,j-n':{topic:'2.8',text:'Pathogens, transmission, HIV/Chlamydia/malaria, barriers, phagocytes, antibodies/antigens, vaccination decisions, antibiotics/resistance and drug trials. Foundation need not explain memory cells or vaccine immune mechanisms.'},
  '2.8h-i-HT':{topic:'2.8',higher:true,text:'Vaccine antigens, specific antibodies, memory cells and faster secondary immune responses.'},
  '2.8o-p-HT':{topic:'2.8',higher:true,text:'Monoclonal production from continuously dividing activated lymphocytes and medical uses.'},
};
export const isWjecBiology=(scope:{courseId?:string|null})=>scope.courseId===WJEC_BIOLOGY_ID;
export const wjecOutcomeAllowed=(ref:string,unit:WjecBiologyUnit,tier:unknown):boolean=>{
  const o=WJEC_OUTCOMES[ref];
  return !!o&&o.topic.startsWith(unit==='unit_1'?'1.':'2.')&&(tier==='foundation'||tier==='higher')&&(!o.higher||tier==='higher');
};
export function wjecBiologyRules(unit:WjecBiologyUnit):string {
  return `WJEC GCSE separate Biology WALES 3400QS; specification ${WJEC_BIOLOGY_SPECIFICATION}. English-medium component, not Eduqas or Double Award.
UNIT ${unit==='unit_1'?'1':'2'}: ${WJEC_WRITTEN_UNITS[unit].title}. Assess only this unit's outcomes, not AQA/OCR/Edexcel paper partitions.
Units 1 and 2 are unchanged for September 2026 entrants. Untiered Unit 3 Scientific Enquiry is a separate practical assessment, not this mock. Never fabricate NEA evidence.
Foundation common clauses cover C–G; Higher also permits bold clauses (A*–D). Use the saved tier. No 9–1 grades or raw-to-UMS conversions.
At Foundation do not require active transport, ATP yield, enzyme-substrate complexes, limiting-factor analysis, nitrogen-cycle mechanisms, trophic-transfer efficiency, capture–recapture, detailed reflex arcs, negative feedback, nephron mechanisms, ADH, triplet codes, named DNA bases or memory-cell/monoclonal detail. These are WJEC Higher content. Insulin action, A/T/C/G base pairing, monohybrid inheritance and natural selection remain common. Foundation may recognise standard form; do not demand a specified number of significant figures.
Higher remains GCSE: no Calvin cycle, thylakoid/stroma mechanisms, Krebs cycle, chemiosmosis, transcription/translation machinery, chi-squared or Hardy–Weinberg. Do not import another board's two-stage photosynthesis model.
Use varied complete tasks, tables with measurements/units, line graphs for continuous variables, categorical bars only when appropriate. Never replace required data with decorative diagrams. Keep data consistent across each parent group.
Six-mark QER needs a private task-specific Level 1 (1–2), Level 2 (3–4), Level 3 (5–6) scheme with science AND communication descriptors, indicative content and zero for no relevant response. Use holistic best fit, including clarity, organisation and appropriate terminology/spelling/punctuation/grammar within the descriptors. Never invent a separate SPaG penalty or print the scheme in the question.`;
}
/** Conservative flags supplement the reviewed outcomes; not a complete classifier. */
export function wjecBiologyContentIssue(text:string,tier:unknown):string|null {
  const beyond=text.match(/\bCalvin cycle\b|\bthylakoids?\b|\bstroma\b|\bchemiosmosis\b|\bKrebs cycle\b|\bNADPH\b|\bphotolysis\b|\belectron transport chain\b|\b(?:transcription|translation)\b|\b[mt]RNA\b|\bHardy[ -]Weinberg\b|\bchi[- ]squared?\b|\blight[- ](?:dependent|independent)\b/i);
  if(beyond)return `WJEC Biology contains beyond-GCSE content (${beyond[0]}); regenerate within the selected unit and tier.`;
  if(tier==='foundation'){
    const higher=text.match(/\bactive transport\b|\bATP\b|\benzyme[- ]substrate complex\w*|\blimiting factors?\b|\binverse[- ]square\b|\bnitrogen cycle\b|\bnitrification\b|\bdenitrification\b|\bcapture.{0,3}recapture\b|\b(?:relay|sensory|motor) neurones?\b|\breflex arc\b|\bnegative feedback\b|\bglucagon\b|\bnephrons?\b|\bBowman.?s capsule\b|\bultrafiltration\b|\bselective reabsorption\b|\bADH\b|\banti[- ]?diuretic\b|\btriplet code\b|\b(?:adenine|thymine|cytosine|guanine)\b|\b(?:continuous|discontinuous) variation\b|\bmemory cells?\b|\bmonoclonal\b|\b(?:energy|trophic|biomass)[ -]transfer efficiency\b/i);
    if(higher)return `WJEC Foundation contains Higher-only content (${higher[0]}); regenerate the complete task and key using common clauses.`;
  }
  return null;
}
