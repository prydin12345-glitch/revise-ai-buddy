// FILE: supabase/functions/_shared/difficulty-instructions.ts
// Difficulty progression prompt builder, extracted verbatim from
// generate-practice-questions (Phase 2 refactor).
import { detectSubject } from "./subject-detection.ts";

export const buildDifficultyInstructions = (
  level: string,
  mode: string,
  subject: string,
  tierStr: string,
): string => {
  const difficultyProfile = detectSubject(subject);
  const isPhysics = difficultyProfile.hasPhysicsStyleDifficulty;
  const isMaths = difficultyProfile.hasMathsStyleDifficulty;

  if (mode === 'increasing') {
    return `
DIFFICULTY PROGRESSION RULE:
Generate questions that increase in difficulty across the set.
First third: accessible single-step questions testing recall and basic application.
Middle third: multi-step questions requiring formula manipulation and unit conversion.
Final third: challenging questions requiring synthesis of multiple concepts,
unfamiliar contexts, or extended mathematical reasoning.
    `.trim();
  }

  if (mode === 'mixed') {
    return `
DIFFICULTY MIX RULE:
Generate a balanced spread — approximately one third easy, one third medium,
one third hard. Vary the question types, mark tariffs, and cognitive demand
across the set. Do not cluster all hard questions at the end.
    `.trim();
  }

  const EASY = `
DIFFICULTY LEVEL: EASY
Target: accessible recall and single-step application.
- Questions test one concept at a time.
- Maximum 2 marks per question.
- Data is given directly in the question — no extraction required.
- One formula is applied with no rearrangement needed.
- Numbers are clean and simple.
- Command words: State, Name, Give, Identify, Write down.
BAD EXAMPLE (do not generate): "Explain the difference between nuclear fission and fusion and calculate the energy released."
GOOD EXAMPLE: "State what is meant by the decay constant of a radioactive isotope." [1 mark]
  `.trim();

  const MEDIUM = `
DIFFICULTY LEVEL: MEDIUM
Target: multi-step calculations and conceptual understanding.
- Questions require two or three logical steps.
- 2-4 marks per question.
- May require rearranging a formula or converting units.
- Data may need to be extracted from a description.
- Command words: Calculate, Determine, Explain, Describe, Show that.
BAD EXAMPLE (do not generate): "What is radioactive decay?"
GOOD EXAMPLE: "A radioactive sample has a decay constant of 2.4 x 10^-4 s^-1. Calculate the half-life of the sample in hours." [3 marks]
  `.trim();

  const HARD_GENERIC = `
DIFFICULTY LEVEL: HARD
Target: A-Level examination standard. Unfamiliar contexts, multi-part structure,
synthesis of multiple concepts.

MANDATORY STRUCTURAL RULES FOR HARD QUESTIONS:
1. Every question must have at least two sub-parts labelled (a)(i), (a)(ii), (b)(i) etc.
2. Sub-parts must build on each other — the answer to (a) is needed for (b).
3. Embed the question in an unfamiliar real-world scenario or application.
4. The scenario must not be the standard textbook example for that topic.
5. Total marks per question: 5 to 8 marks distributed across sub-parts.
6. At least one sub-part must use the command word "Hence" or "Show that" or "Suggest".
7. At least one sub-part must require a written explanation not just a number.

MARK TARIFF GUIDE:
- 1 mark: single factual statement or one arithmetic step
- 2 marks: two-step calculation or statement plus explanation
- 3 marks: multi-step calculation or explanation with evidence
- 4 marks: complex calculation plus interpretation or evaluation
- 5 marks: extended response requiring strategy, calculation, and evaluation

FORBIDDEN QUESTION PATTERNS (never generate these at hard difficulty):
- "Calculate the half-life given N and lambda" — single substitution
- "Write the nuclear equation for alpha decay of X" — recall only
- "State the decay constant" — definition recall
- "Calculate the activity" by simple A = lambda*N substitution
- Any question answerable by substituting directly into one formula

REQUIRED QUESTION PATTERNS (use these as models):
Good example 1 — unfamiliar application:
"An archaeologist uses carbon-14 dating to estimate the age of a wooden artefact.
The artefact contains 0.375 times as much carbon-14 as living wood.
The half-life of carbon-14 is 5740 years.
(a)(i) Calculate the decay constant of carbon-14 in yr^-1. [1]
(a)(ii) Hence calculate the age of the artefact. [3]
(b) Suggest one reason why carbon dating would be unreliable for an artefact
less than 200 years old. [1]"

Good example 2 — multi-concept synthesis:
"A nuclear power station uses uranium-235 as fuel. Each fission event releases
3.2 x 10^-11 J of energy. The station has a thermal efficiency of 35%.
(a) Calculate the number of fission events per second needed to produce
an electrical output of 1.2 GW. [3]
(b) Estimate the mass of uranium-235 consumed per day.
Molar mass of U-235 = 235 g mol^-1. [3]
(c) Suggest two environmental advantages of nuclear power compared with
fossil fuels for generating electricity at this scale. [2]"

Good example 3 — show that plus hence:
"A sample of iodine-131 is used in cancer treatment.
Half-life of I-131 = 8.0 days. Initial activity = 800 MBq.
(a) Show that the decay constant of I-131 is approximately 1.0 x 10^-6 s^-1. [2]
(b) Hence calculate the activity of the sample after 24 days. [2]
(c) The safe threshold for discharge is 100 MBq. Determine the minimum number
of complete days the patient must remain in isolation before their activity
falls below the threshold. [3]"
  `.trim();

  const HARD_PHYSICS_SUPPLEMENT = isPhysics ? `

ADDITIONAL RULES FOR HARD PHYSICS QUESTIONS:

For nuclear physics:
- Never ask just "write the nuclear equation" as a standalone question.
- Always embed it as sub-part (b) of a larger multi-part question.
- Include at least one "show that" sub-part to guide students through a proof.
- Use real isotopes with real half-lives — Ra-226, I-131, Co-60, U-238, Pu-238.

For optics:
- Give object distance and focal length in a real optical instrument context
  (camera, microscope, projector, corrective lens).
- Ask for image distance, nature of image, AND magnification as linked sub-parts.
- Include one sub-part requiring a description of the image properties.

For electromagnetism:
- Always include a sketch sub-part alongside a calculation sub-part.

For radioactive decay:
- Use the "show that" format for intermediate values so students can continue
  even if they drop a mark on one step.
- Include a comparison or evaluation sub-part.
- Include contextual data (RTG power output, cancer treatment dose, archaeological dating)
  rather than abstract numbers.

For waves:
- Combine a calculation with a sketch and an explanation in the same question.
- Use real measurement scenarios: ripple tanks, oscilloscopes, interference fringes.
  `.trim() : '';

  const HARD_MATHS_SUPPLEMENT = isMaths ? `

ADDITIONAL RULES FOR HARD MATHS QUESTIONS:
- Probability questions must use non-standard distributions or conditional probability.
- Statistics questions must require interpretation of results not just calculation.
- Mechanics questions must have multiple forces or require resolving components.
- Include at least one proof or "show that" sub-part per question.
  `.trim() : '';

  switch ((level || '').toLowerCase()) {
    case 'easy': return EASY;
    case 'medium': return MEDIUM;
    case 'hard': return [HARD_GENERIC, HARD_PHYSICS_SUPPLEMENT, HARD_MATHS_SUPPLEMENT].filter(Boolean).join('\n\n');
    default: return MEDIUM;
  }
};
