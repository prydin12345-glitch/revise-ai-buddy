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
  const normalized = equationText.replace(/->/g, '→');

  const parts = normalized
    .split(/(\s*→\s*|\s+\+\s+)/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (part === '→') { terms.push({ type: 'operator', operator: '→' }); continue; }
    if (part === '+') { terms.push({ type: 'operator', operator: '+' }); continue; }

    if (/^\?+$|^_{2,}$|^\[\s*blank\s*\]$/i.test(part)) {
      terms.push({ type: 'nucleus', nucleus: { isBlank: true } });
      continue;
    }

    if (/^(alpha|beta|gamma|ν|ν̄|neutrino|antineutrino)$/i.test(part) ||
        /^[αβγ]/.test(part) || /^β[⁺⁻±+\-]/.test(part) ||
        /^b[+\-]$/i.test(part) || /^e[⁺⁻+\-]?$/i.test(part)) {
      terms.push({ type: 'particle', label: part });
      continue;
    }

    // Superscript/subscript format: ²³⁸₉₂U or ²³⁸U₉₂
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

    // Format like "11/6 C" or "11 6 C" or "11C6"
    const slashMatch = part.match(/(\d+)\s*[\/,]\s*(\d+)\s*([A-Z][a-z]?)/);
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

    const massMatch = part.match(/(\d+)\s*([A-Z][a-z]?)/);
    const atomicMatch = part.match(/[A-Z][a-z]?\s*(\d+)/);
    if (massMatch) {
      terms.push({
        type: 'nucleus',
        nucleus: {
          massNumber: parseInt(massMatch[1]),
          symbol: massMatch[2],
          atomicNumber: atomicMatch ? parseInt(atomicMatch[1]) : undefined,
          isBlank: false,
        },
      });
      continue;
    }

    terms.push({ type: 'particle', label: part });
  }

  let correctAnswer: NuclearEquationData['correctAnswer'];
  if (correctAnswerText) {
    // Try "11 B 5" or "11|5|B" or "11/5 B"
    const pipe = correctAnswerText.split('|').map(s => s.trim());
    if (pipe.length === 3 && /^\d+$/.test(pipe[0])) {
      correctAnswer = {
        massNumber: parseInt(pipe[0]),
        atomicNumber: parseInt(pipe[1]),
        symbol: pipe[2],
      };
    } else {
      const m = correctAnswerText.match(/(\d+)\s+([A-Z][a-z]?)\s+(\d+)/) ||
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
