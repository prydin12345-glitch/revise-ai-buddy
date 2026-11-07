import { describe, expect, it } from 'vitest';
import { canonicalMcqAnswer } from '../functions/_shared/model-question-normalization.ts';

const latex = ['25 \\mu\\text{F}', '50 \\mu\\text{F}', '100 \\mu\\text{F}', '200 \\mu\\text{F}'];
const text = ['Delta U = 0; heat out', 'Delta U > 0; no heat', 'Delta U = 0; heat in', 'Delta U < 0; heat out'];

describe('MCQ keys written with an explanation or different maths notation', () => {
  it('resolves a Unicode key followed by an explanation to the LaTeX option', () => {
    expect(canonicalMcqAnswer('100 μF\n\nC (100 μF): gradient gives RC = 2.0 s', latex)).toBe('100 \\mu\\text{F}');
  });
  it('resolves a letter key followed by an explanation', () => {
    expect(canonicalMcqAnswer('A\n\nA: For an ideal gas ...', text)).toBe(text[0]);
  });
  it('still leaves an answer that names no option unresolved', () => {
    expect(canonicalMcqAnswer('E', text)).toBe('E');
    expect(canonicalMcqAnswer('Delta U = 5', text)).toBe('Delta U = 5');
  });
  it('does not accept a letter whose stated text is a different option', () => {
    expect(canonicalMcqAnswer('A) Delta U > 0; no heat', text)).toBe('A) Delta U > 0; no heat');
  });
});
