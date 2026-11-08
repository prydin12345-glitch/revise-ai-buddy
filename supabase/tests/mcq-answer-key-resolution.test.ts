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

describe('conservative mathematical option identities', () => {
  it('resolves spacing, math delimiters, micro symbols and superscript notation', async () => {
    const {mcqComparable}=await import('../functions/_shared/model-question-normalization.ts');
    expect(canonicalMcqAnswer('80\\,μF', ['40 \\mu\\mathrm{F}', '$80\\,\\mu\\mathrm{F}$', '160 \\mu\\mathrm{F}', '320 \\mu\\mathrm{F}'])).toBe('$80\\,\\mu\\mathrm{F}$');
    expect(canonicalMcqAnswer('R', ['$R$', '$2R$', '$R/2$', '$4R$'])).toBe('$R$');
    expect(mcqComparable('N A⁻¹ m⁻¹')).toBe(mcqComparable('$N\\,A^{-1}\\,m^{-1}$'));
    expect(mcqComparable(String.fromCharCode(92)+'mathrm{R}')).toBe('R');
    expect(mcqComparable(String.fromCharCode(92)+'mu F')).toBe('μF');
    expect(mcqComparable(String.fromCharCode(92)+'(R'+String.fromCharCode(92)+')')).toBe('R');
  });
  it('keeps SI unit and symbol case significant', async () => {
    const {mcqComparable}=await import('../functions/_shared/model-question-normalization.ts');
    expect(mcqComparable('1 mF')).not.toBe(mcqComparable('1 MF'));
    expect(mcqComparable('$r$')).not.toBe(mcqComparable('$R$'));
    expect(canonicalMcqAnswer('1 MF',['1 mF','1 MF','1 μF','1 nF'])).toBe('1 MF');
  });
  it('does not choose one of two mathematically identical options', () => {
    const options=['$R$','R','$2R$','$4R$'];
    expect(canonicalMcqAnswer('R',options)).toBe('R');
  });
  it.each(['A\n\nCorrect answer: B', 'A\n\nB) Membrane: explanation'])('does not silently discard a contradictory answer declaration: %s', (key) => {
    expect(canonicalMcqAnswer(key,['Nucleus','Membrane','Ribosome','Cytoplasm'])).toBe(key);
  });
});


describe('conflicting short answer declarations', () => {
  const options=['80 μF','100 μF','120 μF','140 μF'];
  it.each(['A\n\nB','A\nCorrect answer B','A\nOption B is correct','A\nChoice B would be the answer','A\nB is the correct answer','A\nB is correct'])('keeps an ambiguous key unresolved: %s', key => {
    expect(canonicalMcqAnswer(key,options)).toBe(key);
  });
  it.each(['A\nCorrect answer A','A\nOption A is correct','A\nOption B is not correct','A\nB) 100 μF: incorrect because it uses the wrong gradient.','A\nThe time constant gives 80 μF.'])('keeps a consistent first key with explanation: %s', key => {
    expect(canonicalMcqAnswer(key,options)).toBe(options[0]);
  });
});
