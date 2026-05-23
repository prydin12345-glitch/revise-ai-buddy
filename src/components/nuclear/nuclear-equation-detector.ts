export interface NuclearTerm {
  type: 'nucleus' | 'particle' | 'operator';
  label?: string;
  operator?: string;
  nucleus?: {
    massNumber?: number;
    atomicNumber?: number;
    symbol?: string;
    isBlank?: boolean;
  };
}

export interface NuclearEquationData {
  terms: NuclearTerm[];
  correctAnswer?: {
    massNumber: number;
    atomicNumber: number;
    symbol: string;
  };
  blankCount: number;
}

export const isNuclearEquationQuestion = (questionText: string): boolean => {
  if (!questionText) return false;
  const lower = questionText.toLowerCase();
  return (
    /complete\s+(?:the\s+)?(?:nuclear\s+)?equation/i.test(questionText) ||
    /complete\s+(?:the\s+)?(?:following\s+)?equation\s+showing/i.test(questionText) ||
    /fill\s+in\s+(?:the\s+)?(?:missing\s+)?(?:nucleus|nuclide|particle)/i.test(lower) ||
    (/(\?|_{3,}|\[\s*blank\s*\])/i.test(questionText) &&
     /(nuclear|decay|alpha|beta|gamma|α|β|γ|→|->)/i.test(questionText))
  );
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
};
const SUBSCRIPT_MAP: Record<string, string> = {
  '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
};
const fromSuperscript = (s: string) =>
  s.split('').map(c => SUPERSCRIPT_MAP[c] ?? c).join('');
const fromSubscript = (s: string) =>
  s.split('').map(c => SUBSCRIPT_MAP[c] ?? c).join('');

export const parseNuclearEquation = (
  equationText: string,
  correctAnswerText?: string,
): NuclearEquationData => {
  const terms: NuclearTerm[] = [];

  // Clean up: drop outer braces, normalise arrow:
  const clean = equationText
    .replace(/^\s*\{|\}\s*$/g, '')
    .replace(/->/g, '→')
    .trim();

  const parts = clean
    .split(/(\s*→\s*|\s+\+\s+|\s+\+\s*|\s*\+\s+)/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\{|\}$/g, '').trim();
    if (!part) continue;

    if (/^→$/.test(part)) { terms.push({ type: 'operator', operator: '→' }); continue; }
    if (/^\+$/.test(part)) { terms.push({ type: 'operator', operator: '+' }); continue; }

    if (/^\?+$|^_{2,}$|^\[\s*blank\s*\]$/i.test(part)) {
      terms.push({ type: 'nucleus', nucleus: { isBlank: true } });
      continue;
    }

    // Known particle labels — check before nuclear symbols:
    const particleMap: Record<string, string> = {
      'e^-': 'e⁻', 'e^+': 'e⁺', 'e-': 'e⁻', 'e+': 'e⁺',
      'β-': 'β⁻', 'β+': 'β⁺', 'β^-': 'β⁻', 'β^+': 'β⁺',
      'beta-': 'β⁻', 'beta+': 'β⁺', 'beta': 'β',
      'v_e': 'νₑ', 've': 'νₑ', 'v_mu': 'νμ', 'ν_e': 'νₑ', 'νe': 'νₑ',
      'anti-v_e': 'ν̄ₑ', 'anti_ve': 'ν̄ₑ', 'antineutrino': 'ν̄ₑ',
      'α': 'α', 'alpha': 'α',
      'γ': 'γ', 'gamma': 'γ',
      'n': 'n', 'p': 'p', 'neutrino': 'νₑ',
    };
    const particleKey = Object.keys(particleMap).find(
      k => part.toLowerCase() === k.toLowerCase()
    );
    if (particleKey) {
      terms.push({ type: 'particle', label: particleMap[particleKey] });
      continue;
    }

    if (/^e\^?[+\-⁺⁻]$/i.test(part) || /^[βα]\^?[+\-⁺⁻]?$/i.test(part)) {
      const label = part
        .replace('e^-', 'e⁻').replace('e^+', 'e⁺')
        .replace('β-', 'β⁻').replace('β+', 'β⁺')
        .replace('β^-', 'β⁻').replace('β^+', 'β⁺');
      terms.push({ type: 'particle', label });
      continue;
    }
    if (/^v_?e$/i.test(part) || /^ν_?e$/i.test(part)) {
      terms.push({ type: 'particle', label: 'νₑ' });
      continue;
    }
    if (/^\\?bar.*v.*e/i.test(part) || /^anti.*v.*e/i.test(part)) {
      terms.push({ type: 'particle', label: 'ν̄ₑ' });
      continue;
    }

    // Unicode super/subscript nuclide: ²³⁸₉₂U
    const supSubMatch = part.match(/^([⁰-⁹]+)?([₀-₉]+)?([A-Z][a-z]?)([₀-₉]+)?([⁰-⁹]+)?$/);
    if (supSubMatch && (supSubMatch[1] || supSubMatch[2] || supSubMatch[4] || supSubMatch[5])) {
      const mass = supSubMatch[1] ? parseInt(fromSuperscript(supSubMatch[1])) :
                   supSubMatch[5] ? parseInt(fromSuperscript(supSubMatch[5])) : undefined;
      const atomic = supSubMatch[2] ? parseInt(fromSubscript(supSubMatch[2])) :
                     supSubMatch[4] ? parseInt(fromSubscript(supSubMatch[4])) : undefined;
      terms.push({
        type: 'nucleus',
        nucleus: { massNumber: mass, atomicNumber: atomic, symbol: supSubMatch[3], isBlank: false },
      });
      continue;
    }

    // ASCII ^A_Z<Sym> or _Z^A<Sym>  (with optional braces)
    const ascii1 = part.match(/^\^?\{?(\d+)\}?_\{?(\d+)\}?\s*([A-Z][a-z]?)$/);
    const ascii2 = part.match(/^_\{?(\d+)\}?\^\{?(\d+)\}?\s*([A-Z][a-z]?)$/);
    if (ascii1) {
      terms.push({
        type: 'nucleus',
        nucleus: {
          massNumber: parseInt(ascii1[1]),
          atomicNumber: parseInt(ascii1[2]),
          symbol: ascii1[3],
          isBlank: false,
        },
      });
      continue;
    }
    if (ascii2) {
      terms.push({
        type: 'nucleus',
        nucleus: {
          atomicNumber: parseInt(ascii2[1]),
          massNumber: parseInt(ascii2[2]),
          symbol: ascii2[3],
          isBlank: false,
        },
      });
      continue;
    }

    // Slash format: 11/6 C
    const slashMatch = part.match(/^(\d+)\s*[\/,]\s*(\d+)\s*([A-Z][a-z]?)$/);
    if (slashMatch) {
      terms.push({
        type: 'nucleus',
        nucleus: {
          massNumber: parseInt(slashMatch[1]),
          atomicNumber: parseInt(slashMatch[2]),
          symbol: slashMatch[3],
          isBlank: false,
        },
      });
      continue;
    }

    // Mass + symbol only
    const simple = part.match(/^\^?\{?(\d+)\}?\s*([A-Z][a-z]?)$/);
    if (simple) {
      terms.push({
        type: 'nucleus',
        nucleus: {
          massNumber: parseInt(simple[1]),
          symbol: simple[2],
          isBlank: false,
        },
      });
      continue;
    }

    // Fallback: strip braces, treat as particle label
    const cleaned = part.replace(/[{}]/g, '').trim();
    if (cleaned) terms.push({ type: 'particle', label: cleaned });
  }

  let correctAnswer: NuclearEquationData['correctAnswer'];
  if (correctAnswerText) {
    const pipe = correctAnswerText.split('|').map(s => s.trim());
    if (pipe.length === 3 && /^\d+$/.test(pipe[0])) {
      correctAnswer = {
        massNumber: parseInt(pipe[0]),
        atomicNumber: parseInt(pipe[1]),
        symbol: pipe[2],
      };
    } else {
      const m = correctAnswerText.match(/(\d+)\s+([A-Z][a-z]?)\s+(\d+)/) ||
                correctAnswerText.match(/(\d+)([A-Z][a-z]?)(\d+)/) ||
                correctAnswerText.match(/(\d+)\s*[\/,]\s*(\d+)\s*([A-Z][a-z]?)/);
      if (m) {
        if (/[A-Z]/.test(m[2])) {
          correctAnswer = { massNumber: parseInt(m[1]), symbol: m[2], atomicNumber: parseInt(m[3]) };
        } else {
          correctAnswer = { massNumber: parseInt(m[1]), atomicNumber: parseInt(m[2]), symbol: m[3] };
        }
      }
    }
  }

  return {
    terms,
    correctAnswer,
    blankCount: terms.filter(t => t.type === 'nucleus' && t.nucleus?.isBlank).length,
  };
};

export const extractEquationFromQuestionText = (text: string): string | null => {
  if (!text) return null;
  const normalized = text.replace(/->/g, '→');
  // Find a substring that contains → and at least one ? or blank marker
  const lines = normalized.split(/\n|\.\s+/);
  for (const line of lines) {
    if (/→/.test(line) && /(\?|_{2,}|\[\s*blank\s*\])/i.test(line)) {
      return line.trim();
    }
  }
  // fallback: any line with →
  for (const line of lines) {
    if (/→/.test(line)) return line.trim();
  }
  return null;
};
