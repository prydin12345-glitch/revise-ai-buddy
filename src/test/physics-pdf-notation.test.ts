import { describe, expect, it } from 'vitest';
import { generateExamPDF } from '@/lib/exam-pdf-generator';
import { exportedPDFText } from './pdf-test-utils';
import { responseFixture } from '../../supabase/tests/response-foundation-fixtures';

describe('shared plain scientific notation in PDF', () => {
  it('exports actual Unicode arrow and Greek glyphs and keeps superscript charges', async () => {
    const pdf = await generateExamPDF({ title: 'Particle notation', subject: 'Physics', questions: [{
      id: 'particles', question_number: '1', question_type: 'short_answer', marks: 2,
      question_text: String.raw`Explain the reaction p + \pi^- \rightarrow \Lambda^0 + K^0. A resistance is $5\,\Omega$ and acceleration is 9.8 m/s2.`,
    }] }, { includeWorkingSpace: false });
    const text = await exportedPDFText(pdf);
    expect(text).toMatch(/π-\s*→\s*Λ0\s*\+\s*K0/);
    expect(text).toContain('5 Ω');
    expect(text).not.toContain('->');
    expect(text).not.toMatch(/\\rightarrow|\\pi|\\Lambda|ohm/);
    expect(pdf.getFontList()).toHaveProperty('ScientificSymbols');
  });

  it('keeps Unicode notation in structured response options and public resource tables', async () => {
    const response = responseFixture('choice');
    if (response.definition.kind !== 'choice') throw new Error('Expected a choice fixture.');
    response.definition.options[0].label = String.raw`\pi \rightarrow \mu`;
    response.definition.options[1].label = String.raw`\Delta E`;
    response.definition.options[2].label = String.raw`5\,\Omega`;
    const pdf = await generateExamPDF({ title: 'Structured notation', subject: 'Physics', questions: [{
      id: 'structured', question_number: '1', question_type: 'mcq', marks: 2,
      question_text: 'Select the statements.', response_definition: response.definition,
      response_resources: [{id: 'experiment', kind: 'table', title: 'Given quantities',
        columns: ['Symbol', 'Meaning'], rows: [[String.raw`\Phi`, 'Flux']]}],
    }] }, { includeWorkingSpace: false });
    const text = await exportedPDFText(pdf);
    expect(text).toContain('π → μ');
    expect(text).toContain('Δ E');
    expect(text).toContain('5 Ω');
    expect(text).toContain('Φ');
  });
});
