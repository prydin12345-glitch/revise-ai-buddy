// FILE: supabase/functions/_shared/generation-rules.ts
// Universal generation rules (notation, sketch typing, nuclear equations),
// extracted verbatim from generate-practice-questions (Phase 2 refactor).

export const NOTATION_RULES = `
CRITICAL NOTATION RULES — FOLLOW THESE EXACTLY:

These rules override any other formatting instructions.
Never use LaTeX dollar signs, backslash commands, or raw caret/underscore notation.
Always use Unicode characters directly in question text and answers.

REQUIRED FORMATS:
Half-life: T½ (never T1/2 or T_{1/2})
Initial values: A₀ N₀ v₀ x₀ u₀ I₀ Q₀ (never A_0 or A_{0} or $A_0$)
Particles: e⁻ e⁺ β⁻ β⁺ α γ νₑ ν̄ₑ (never e^- or \\beta^- or $e^-$)
Nuclear symbols: ²³⁸₉₄Pu ¹⁴₆C ⁴₂He (never ^238_94Pu or $_{94}^{238}Pu$)
Decay arrow: → (never \\rightarrow or ->)
Powers of ten: × 10⁻¹⁰ × 10⁶ (never × 10^{-10} or 10^-10 or $10^{-10}$)
Units: s⁻¹ m⁻² yr⁻¹ cm³ m² (never s^{-1} or s^-1 or $s^{-1}$)
Constants: Nₐ kB (never N_A or k_B or $N_A$)
Metastable: ⁹⁹ᵐTc (never ^99m_43Tc or 99mTc)
Fractions: write as 1/f = 1/u + 1/v (never \\frac{1}{f})

UNICODE SUPERSCRIPTS: ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻
UNICODE SUBSCRIPTS: ₀₁₂₃₄₅₆₇₈₉

WRONG: "The half-life of ^238Pu is 87.7 years and λ = 2.5 × 10^-10 s^-1"
RIGHT: "The half-life of ²³⁸Pu is 87.7 years and λ = 2.5 × 10⁻¹⁰ s⁻¹"

WRONG: "N_A = 6.02 × 10^23 mol^-1"
RIGHT: "Nₐ = 6.02 × 10²³ mol⁻¹"

WRONG: "^14_6C → ? + e^- + v_e"
RIGHT: "¹⁴₆C → ? + e⁻ + νₑ"
`;

export const SKETCH_TYPE_RULE = `
QUALITATIVE SKETCH QUESTIONS — use question_type = "short_answer" NOT "graph_plotting":
graph_plotting is ONLY for questions where the student must plot specific (x,y) coordinate
points on a grid. Examples where graph_plotting is CORRECT:
- "Plot the following data on a graph: [table of values]"
- "Draw the curve y = x² for -3 ≤ x ≤ 3"
- "Plot velocity against time using the data in the table"

short_answer is CORRECT for qualitative sketch questions where the student draws the general
shape of a curve without specific numeric coordinates. Examples:
- "Sketch a graph to show how N varies with t for radioactive decay"
- "Sketch the velocity-time graph for a ball thrown upward"
- "Sketch the graph of activity against time showing the concept of half-life"
- "Draw a sketch graph showing how pressure varies with volume"
These qualitative sketches MUST use question_type = "short_answer" and MUST NOT include
a diagram_config with pre-drawn graph data.
`;

export const NUCLEAR_EQUATION_COMPLETION_INSTRUCTIONS = `
NUCLEAR EQUATION COMPLETION QUESTIONS:
For questions asking students to complete a nuclear equation, use this format:

question_type: "nuclear_equation_completion"
question_text must contain the partial equation with ? marking the blank.
Example: "Complete the nuclear equation for the beta-plus decay of carbon-11:  11/6 C -> ? + b+ + neutrino"

correct_answer must contain the missing nucleus in the format: "MassNumber Symbol AtomicNumber"
Example: "11 B 5" (boron-11, atomic number 5)

worked_solution must show the conservation calculation:
"Mass number: 11 = 11 + 0  Atomic number: 6 = 5 + 1  Missing nucleus: 11/5 B"

Use this question_type for any question containing:
- "Complete the equation"
- "Complete the nuclear equation"
- "Fill in the missing nucleus"
- "What is the missing particle"
with a nuclear decay equation that has a blank or ?
`;
