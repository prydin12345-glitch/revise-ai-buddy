import { describe, it, expect } from 'vitest';
import { normalisePlainNotation, dropRepeatedQuestionStem, hasLeakedMathCode } from '../../supabase/functions/_shared/plain-notation';

describe('plain notation', () => {
  it('turns particle equations into symbols', () => {
    expect(normalisePlainNotation('p + \\pi^- \\rightarrow \\Lambda^0 + K^0')).toBe('p + π⁻ → Λ⁰ + K⁰');
    expect(normalisePlainNotation('\\Sigma^+ \\rightarrow p + \\pi^0')).toBe('Σ⁺ → p + π⁰');
  });
  it('removes spacing commands and tidies powers', () => {
    expect(normalisePlainNotation('r = 0.40\\ Ω and 40\\,Ω')).toBe('r = 0.40 Ω and 40 Ω');
    expect(normalisePlainNotation('2.5 m^2 at 3 s^-1, 30^°')).toBe('2.5 m² at 3 s⁻¹, 30°');
  });
  it('leaves real maths segments and fractions alone', () => {
    expect(normalisePlainNotation('Find $\\pi r^2$ here')).toBe('Find $\\pi r^2$ here');
    expect(normalisePlainNotation('\\frac{1}{2}')).toBe('\\frac{1}{2}');
    expect(hasLeakedMathCode('$\\alpha$ ok')).toBe(false);
    expect(hasLeakedMathCode('0.40\\ Ω')).toBe(true);
  });
  it('drops a reworded repeat of the question', () => {
    const t = "Kirchhoff's second law for an electrical circuit is a direct consequence of which conservation law?\n\nWhich conservation law is Kirchhoff's second law for an electrical circuit a direct consequence of?";
    expect(dropRepeatedQuestionStem(t)).toBe("Kirchhoff's second law for an electrical circuit is a direct consequence of which conservation law?");
    const two = 'What is the speed of the ball?\n\nWhat is the acceleration of the trolley at the end?';
    expect(dropRepeatedQuestionStem(two)).toBe(two);
  });
});
