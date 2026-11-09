// Turns maths code that leaked into plain text (outside $...$ math) into
// readable Unicode: "p + \pi^- \rightarrow \Lambda^0 + K^0" -> "p + π⁻ → Λ⁰ + K⁰",
// "0.40\ Ω" -> "0.40 Ω", "m^2" -> "m²", "s^-1" -> "s⁻¹", "30^°" -> "30°".
// Text inside $...$, $$...$$, \( \) and \[ \] is left for the maths renderer.
// Structural commands (\frac, \sqrt, \vec, \begin/\end) are left untouched so
// the screen renderer can still typeset them. Pure TS: shared by the browser
// and edge functions.

const SYMBOLS: Record<string, string> = {
  rightarrow: '→', to: '→', longrightarrow: '→', leftarrow: '←', gets: '←', Rightarrow: '⇒',
  Leftarrow: '⇐', leftrightarrow: '↔', rightleftharpoons: '⇌', times: '×', cdot: '·', div: '÷',
  pm: '±', mp: '∓', approx: '≈', equiv: '≡', propto: '∝', sim: '~', leq: '≤', le: '≤', geq: '≥',
  ge: '≥', neq: '≠', ne: '≠', infty: '∞', degree: '°', circ: '°', ell: 'ℓ', hbar: 'ħ',
  alpha: 'α', beta: 'β', gamma: 'γ', Gamma: 'Γ', delta: 'δ', Delta: 'Δ', epsilon: 'ε',
  varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', Theta: 'Θ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', Lambda: 'Λ', mu: 'μ', nu: 'ν', xi: 'ξ', Xi: 'Ξ', pi: 'π', Pi: 'Π', rho: 'ρ',
  sigma: 'σ', Sigma: 'Σ', tau: 'τ', phi: 'φ', varphi: 'φ', Phi: 'Φ', chi: 'χ', psi: 'ψ',
  Psi: 'Ψ', omega: 'ω', Omega: 'Ω', Upsilon: 'Υ', partial: '∂', nabla: '∇', sum: 'Σ', int: '∫',
  percent: '%', ohm: 'Ω',
};
const KEEP = new Set(['frac', 'dfrac', 'sqrt', 'vec', 'overrightarrow', 'begin', 'end']);
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'i': 'ⁱ', '°': '°', ' ': '',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎',
};
const mapAll = (s: string, table: Record<string, string>): string | null => {
  let out = '';
  for (const ch of s) {
    if (!(ch in table)) return null;
    out += table[ch];
  }
  return out;
};

const MATH_SEGMENT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;

const normaliseSegment = (seg: string): string => {
  if (!/[\\^]|_\{/.test(seg)) return seg;
  let out = seg
    // Spacing commands: "0.40\ Ω", "40\,Ω", "\;"
    .replace(/\\[,;:! ](?=\S|$)/g, ' ')
    .replace(/\\(?:quad|qquad)\b/g, ' ')
    // Wrappers that only style text
    .replace(/\\(?:text|mathrm|mathbf|mathit|textrm|textbf|operatorname|boxed|bar|overline)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\left\b|\\right\b(?![a-z])/g, '')
    .replace(/\\%/g, '%');
  out = out.replace(/\\([A-Za-z]+)\b/g, (m, name: string) => {
    if (KEEP.has(name)) return m;
    return SYMBOLS[name] ?? m;
  });
  // Superscripts: ^{...}, ^-1, ^2, ^-, ^+, ^°, ^0
  out = out.replace(/\^\{([^{}]{1,12})\}/g, (m, body: string) => mapAll(body, SUP) ?? m);
  out = out.replace(/\^([+\-−]?\d{1,3}|[+\-−°])/g, (m, body: string) => mapAll(body, SUP) ?? m);
  out = out.replace(/\^\s*(°|\\circ)/g, '°');
  // Subscripts only in explicit brace form; bare R_1 is typeset by the screen renderer.
  out = out.replace(/_\{([^{}]{1,12})\}/g, (m, body: string) => mapAll(body, SUB) ?? m);
  return out;
};

export function normalisePlainNotation(text: string): string {
  if (typeof text !== 'string' || !text) return text;
  if (!/[\\^]|_\{/.test(text)) return text;
  return text
    .split(MATH_SEGMENT)
    .map((seg, i) => (i % 2 === 1 ? seg : normaliseSegment(seg)))
    .join('');
}

/** True when plain text (outside math delimiters) still contains maths code. */
export function hasLeakedMathCode(text: string): boolean {
  if (typeof text !== 'string') return false;
  return text
    .split(MATH_SEGMENT)
    .some((seg, i) => i % 2 === 0 && /\\(?!frac|dfrac|sqrt|vec|overrightarrow|begin|end)[A-Za-z]+|\\[,; ]/.test(seg));
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9']+/g) ?? []);

/**
 * Removes a reworded copy of the question asked twice in a row, e.g.
 * "Kirchhoff's second law is a consequence of which law?\n\nWhich law is
 * Kirchhoff's second law a consequence of?" -> first sentence only.
 */
export function dropRepeatedQuestionStem(text: string): string {
  if (typeof text !== 'string') return text;
  const paras = text.split(/\n\s*\n/);
  if (paras.length < 2) return text;
  const last = paras[paras.length - 1].trim();
  const prev = paras[paras.length - 2].trim();
  if (!last.endsWith('?') || !prev.endsWith('?')) return text;
  const a = words(prev), b = words(last);
  if (a.size < 4 || b.size < 4) return text;
  let shared = 0;
  for (const w of b) if (a.has(w)) shared++;
  if (shared / Math.min(a.size, b.size) < 0.8) return text;
  return paras.slice(0, -1).join('\n\n');
}
