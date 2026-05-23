/**
 * Strip LaTeX notation from AI-generated feedback so it renders as
 * plain readable text in the UI rather than escaped source.
 *
 * Applied to every AI feedback string before it is stored in the
 * database or returned to the client.
 */
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
  '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '+':'⁺','-':'⁻',
};
const SUBSCRIPT_MAP: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄',
  '5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
};
const toSuperscript = (s: string): string =>
  s.split('').map(c => SUPERSCRIPT_MAP[c] ?? c).join('');
const toSubscript = (s: string): string =>
  s.split('').map(c => SUBSCRIPT_MAP[c] ?? c).join('');

export const sanitiseFeedback = (text: string | null | undefined): string => {
  if (!text) return text ?? '';

  // ── Physics shorthand notation (run BEFORE LaTeX brace removal) ──────────
  text = text
    // Half-life:
    .replace(/\bT\s*1\/2\b/g, 'T½')
    .replace(/\bT\s*_\{?1\/2\}?\b/g, 'T½')
    .replace(/\bT\s*_\{?½\}?\b/g, 'T½')
    .replace(/\bhalf[‐\-]?life\s+T\s*1\/2/gi, 'half-life T½')
    // Initial value subscripts:
    .replace(/\bA\s*_\{?0\}?\b/g, 'A₀')
    .replace(/\bN\s*_\{?0\}?\b/g, 'N₀')
    .replace(/\bx\s*_\{?0\}?\b/g, 'x₀')
    .replace(/\bv\s*_\{?0\}?\b/g, 'v₀')
    .replace(/\bu\s*_\{?0\}?\b/g, 'u₀')
    .replace(/\bI\s*_\{?0\}?\b/g, 'I₀')
    .replace(/\bQ\s*_\{?0\}?\b/g, 'Q₀')
    // Particle notation:
    .replace(/\be\s*\^\s*-1\b/g, 'e⁻¹')
    .replace(/\be\s*\^\s*-/g, 'e⁻')
    .replace(/\be\s*\^\s*\+/g, 'e⁺')
    .replace(/\banti[-\s]?v\s*_\{?e\}?/gi, 'ν̄ₑ')
    .replace(/\bv\s*_\{?e\}?/g, 'νₑ')
    .replace(/\bv\s*_\{?mu\}?/g, 'νμ')
    .replace(/\\bar\s*\{\s*\\?nu\s*\}\s*_\{?e\}?/g, 'ν̄ₑ')
    .replace(/\\bar\s*\{\s*v\s*\}/g, 'ν̄')
    .replace(/\\bar\s*\{\s*\\nu\s*\}/g, 'ν̄')
    .replace(/\\nu\s*_\{?e\}?/g, 'νₑ')
    // Nuclear notation ^A_Z<Sym> with optional braces:
    .replace(/\^\{?(\d+)\}?_\{?(\d+)\}?([A-Z][a-z]?)/g,
      (_, mass, atomic, sym) => toSuperscript(mass) + toSubscript(atomic) + sym)
    .replace(/_\{?(\d+)\}?\^\{?(\d+)\}?([A-Z][a-z]?)/g,
      (_, atomic, mass, sym) => toSuperscript(mass) + toSubscript(atomic) + sym)
    .replace(/\^\{?(\d+)\}?([A-Z][a-z]?)/g,
      (_, mass, sym) => toSuperscript(mass) + sym)
    // Units with caret powers:
    .replace(/\bs\s*\^\s*-\s*1\b/g, 's⁻¹')
    .replace(/\bm\s*\^\s*-\s*1\b/g, 'm⁻¹')
    .replace(/\byr\s*\^\s*-\s*1\b/g, 'yr⁻¹')
    .replace(/\bcm\s*\^\s*3\b/g, 'cm³')
    .replace(/\bm\s*\^\s*2\b/g, 'm²')
    .replace(/\bm\s*\^\s*3\b/g, 'm³')
    .replace(/\bkm\s*\^\s*2\b/g, 'km²')
    // Strip stray braces wrapping nuclear equations:
    .replace(/\{([^{}]*→[^{}]*)\}/g, '$1');

  let out = text;

  // Strip explicit math delimiters
  out = out
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    .replace(/\$\$/g, '')
    .replace(/(?<!\\)\$(?!\$)/g, '');

  // \frac{a}{b} → a/b  (run twice to handle nested fractions)
  for (let i = 0; i < 2; i++) {
    out = out.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '($1)/($2)');
  }
  // Tidy up redundant parens around single tokens
  out = out.replace(/\(([A-Za-z0-9_]+)\)\/\(([A-Za-z0-9_]+)\)/g, '$1/$2');

  // \text{x} → x, \mathrm{x} → x, \mathbf{x} → x, \boxed{x} → x
  out = out
    .replace(/\\(?:text|mathrm|mathbf|mathit|boxed|operatorname)\s*\{([^{}]*)\}/g, '$1')
    // Broken \text → \ext seen in nuclear feedback
    .replace(/\\ext\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\ext([A-Z])/g, '$1')
    // Doubled "<num>ext<unit><num>ext<unit>" pattern e.g. "1200extBq1200extBq" → "1200 Bq"
    .replace(/(\d+(?:\.\d+)?(?:\s*×\s*10[⁰¹²³⁴⁵⁶⁷⁸⁹\-\+\d]+)?)\s*ext([A-Za-z]+)\1\s*ext\2/g, '$1 $2')
    // Generic "<num>ext<unit>" leftover (handles lowercase units like "Bq", "kg")
    .replace(/(\d)\s*ext([A-Za-z]+)/g, '$1 $2')
    .replace(/\bext([A-Z][a-z]?)\b/g, '$1')
    .replace(/(\d+)ext([A-Z])/g, '$1$2');

  // Common LaTeX symbols → Unicode
  const map: Array<[RegExp, string]> = [
    [/\\rightarrow|\\to\b/g, '→'],
    [/\\leftarrow|\\gets\b/g, '←'],
    [/\\Rightarrow/g, '⇒'],
    [/\\Leftarrow/g, '⇐'],
    [/\\leftrightarrow/g, '↔'],
    [/\\times/g, '×'],
    [/\\cdot/g, '·'],
    [/\\div/g, '÷'],
    [/\\pm/g, '±'],
    [/\\mp/g, '∓'],
    [/\\approx/g, '≈'],
    [/\\equiv/g, '≡'],
    [/\\leq|\\le\b/g, '≤'],
    [/\\geq|\\ge\b/g, '≥'],
    [/\\neq|\\ne\b/g, '≠'],
    [/\\infty/g, '∞'],
    [/\\degree/g, '°'],
    [/\\circ/g, '°'],
    [/\\alpha/g, 'α'], [/\\beta/g, 'β'], [/\\gamma/g, 'γ'], [/\\Gamma/g, 'Γ'],
    [/\\delta/g, 'δ'], [/\\Delta/g, 'Δ'], [/\\epsilon/g, 'ε'], [/\\varepsilon/g, 'ε'],
    [/\\zeta/g, 'ζ'], [/\\eta/g, 'η'], [/\\theta/g, 'θ'], [/\\Theta/g, 'Θ'],
    [/\\iota/g, 'ι'], [/\\kappa/g, 'κ'], [/\\lambda/g, 'λ'], [/\\Lambda/g, 'Λ'],
    [/\\mu/g, 'μ'], [/\\nu/g, 'ν'], [/\\xi/g, 'ξ'], [/\\pi/g, 'π'], [/\\Pi/g, 'Π'],
    [/\\rho/g, 'ρ'], [/\\sigma/g, 'σ'], [/\\Sigma/g, 'Σ'], [/\\tau/g, 'τ'],
    [/\\phi/g, 'φ'], [/\\varphi/g, 'φ'], [/\\Phi/g, 'Φ'],
    [/\\chi/g, 'χ'], [/\\psi/g, 'ψ'], [/\\Psi/g, 'Ψ'],
    [/\\omega/g, 'ω'], [/\\Omega/g, 'Ω'],
    [/\\sqrt\s*\{([^{}]*)\}/g, '√($1)'],
    [/\\sum/g, 'Σ'],
    [/\\prod/g, 'Π'],
    [/\\int/g, '∫'],
    [/\\partial/g, '∂'],
    [/\\nabla/g, '∇'],
  ];
  for (const [re, sub] of map) out = out.replace(re, sub);

  // _{...} / ^{...} → drop braces, leave readable
  out = out
    .replace(/\^\{([^{}]*)\}/g, '^$1')
    .replace(/_\{([^{}]*)\}/g, '_$1');

  // Catch-all: remaining \command{arg} → arg, then bare \command → ''
  out = out
    .replace(/\\[a-zA-Z]+\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '');

  // Tidy whitespace
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return out;
};

/**
 * Rule appended to all AI feedback/grading system prompts so the model
 * avoids emitting LaTeX in the first place. The sanitiser is the safety
 * net for when it does anyway.
 */
export const FEEDBACK_FORMATTING_RULE = `

CRITICAL FORMATTING RULE FOR FEEDBACK:
Never use LaTeX notation in feedback text. Do NOT use \\frac{}{}, \\(, \\), \\[, \\], $$, \\text{}, \\rightarrow, \\ext, or any LaTeX delimiters or commands.
Write maths in plain readable text using Unicode:
- Fractions: write "1/f = 1/do + 1/di" not "\\frac{1}{f} = ..."
- Arrows: write "→" not "\\rightarrow"
- Multiplication: write "×" not "\\times"
- Superscripts: use Unicode superscripts (²³⁸U) or caret (x^2), never \\^{}
- Greek letters: write "α β γ Δ λ μ π θ Ω" directly, not "\\alpha" etc.
- Variables with units: write "f = 15.0 cm" not "f = 15.0\\text{ cm}"
- Nuclear equations: write "²³⁸₉₂U → ²³⁴₉₀Th + ⁴₂He" using Unicode

Correct example: "Using the lens formula 1/f = 1/do + 1/di, with f = 15 cm and do = 25 cm, rearranging gives di = 37.5 cm. The image is real and inverted."
Wrong example: "Using \\(\\frac{1}{f} = \\frac{1}{d_o} + \\frac{1}{d_i}\\)"
`;

/**
 * Marking-quality rules appended to all AI marking system prompts.
 * Addresses sign-convention validity, significant figures tolerance,
 * feedback length, and self-contradiction.
 */
export const MARKING_QUALITY_RULES = `

SIGN CONVENTION RULE:
Physics and maths problems often have multiple valid sign conventions. Before marking a student wrong, check whether their answer is consistent with a valid alternative convention.
- Lens equation: u = +15 (real-is-positive) gives v = +30. u = -15 (Cartesian) gives v = -30. Both are correct — do not mark one wrong because it differs from the model answer convention.
- If the student's working is internally consistent and arrives at a physically correct answer (same magnitude, correct interpretation), award full marks even if the sign convention differs from the mark scheme.
- Only penalise sign convention errors if the student is internally inconsistent — i.e. they mix two different conventions in the same calculation.

SIGNIFICANT FIGURES RULE:
- Accept answers rounded to 2, 3, or 4 significant figures unless the question explicitly states a required precision.
- Do not penalise intermediate rounding. Only check the final answer.
- If the student's final answer is within 2% of the correct value, award full marks unless precision is the specific skill being assessed.
- Never mark an answer wrong solely because of a rounding difference in an intermediate step if the final answer is correct.
- If the question does not state required precision, briefly tell the student what precision you accepted in your feedback (e.g. "Accepted to 3 significant figures — 0.660 MBq.").

FEEDBACK CONCISENESS RULE:
- Keep feedback to a maximum of 150 words.
- Lead with what the student got right in one sentence.
- State what was wrong in one or two sentences maximum — be specific and direct.
- Give the correct working in no more than three lines.
- Do not repeat the same point multiple times.
- Do not recalculate the entire problem in the feedback unless the student made a fundamental method error.

SELF-CONTRADICTION RULE:
- Before finalising feedback, check: if you acknowledged the student's method was correct AND their arithmetic was correct, you MUST award full marks. Correct method plus correct arithmetic cannot produce a wrong answer.
- If the student used a different but valid approach, do not call it wrong. Award marks for correct physics/maths regardless of which valid method was used.
- Never tell a student their intermediate step was wrong without confirming whether their final answer was still correct despite it.
`;
