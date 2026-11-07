import { describe, it, expect } from 'vitest';
import { repeatedConceptDefects, definedConcept, repeatedSentence, coveredTasksNote } from '../functions/_shared/paper-repetition';
import { resolveQuestionResources } from '../functions/_shared/question-resources';

const graph = { type: 'line_chart', xAxisLabel: 'Time / s', yAxisLabel: 'p.d. / V', datasets: [{ label: 'V', data: [{ x: 0, y: 12 }, { x: 2, y: 7.3 }] }] };

describe('paper repetition', () => {
  it('finds the defined concept', () => {
    expect(definedConcept('Define electric potential at a point in an electric field.')).toBe('electric potential');
    expect(definedConcept('Which statement correctly defines the electric potential at a point?')).toBe('electric potential');
    expect(definedConcept('Which statement correctly defines gravitational potential at a point?')).toBe('gravitational potential');
  });
  it('flags the same definition in a different question, not the first one', () => {
    const d = repeatedConceptDefects([
      { id: 'a', question_number: '2(a)', root_question_number: '2', marks: 2, question_text: 'Define electric potential at a point in an electric field.' },
      { id: 'b', question_number: '11', marks: 1, question_text: 'Which statement correctly defines gravitational potential at a point?' },
      { id: 'c', question_number: '20', marks: 1, question_text: 'Which statement correctly defines the electric potential at a point in an electric field?' },
    ]);
    expect(d.map(x => x.partId)).toEqual(['c']);
  });
  it('flags identical graph data reused by another question', () => {
    const d = repeatedConceptDefects([
      { id: 'a', question_number: '13', marks: 1, question_text: 'Find C.', diagram_config: graph },
      { id: 'b', question_number: '18', marks: 1, question_text: 'Find R.', diagram_config: { ...graph, xAxisLabel: 'Time t (s)' } },
    ]);
    expect(d.map(x => x.partId)).toEqual(['b']);
  });
  it('flags a sentence written twice in one stem', () => {
    expect(repeatedSentence('At which distance from the charge is the potential zero?\n\nAt which distance from the $charge$ is the potential zero?')).not.toBeNull();
  });
  it('leaves a healthy paper alone', () => {
    expect(repeatedConceptDefects([
      { id: 'a', question_number: '1', marks: 1, question_text: 'State Faraday\'s law.' },
      { id: 'b', question_number: '2', marks: 1, question_text: 'Calculate the time constant.' },
    ])).toEqual([]);
    expect(coveredTasksNote([{ question_number: '1', marks: 1, question_text: 'Ctx\nDefine X.' }])).toContain('Q1: Define X.');
  });
});

describe('graph labels and stored tables', () => {
  it('shows a table stored only as the figure', () => {
    const r = resolveQuestionResources({ question_text: 'The following measurements were recorded.', table_data: null,
      diagram_config: { type: 'data_table', headers: ['Quantity', 'Value'], rows: [['Mass', '0.750 kg'], ['Time', '300 s']] } } as any);
    expect(r.issues).toEqual([]);
    expect(r.chart?.type).toBe('data_table');
  });
});
