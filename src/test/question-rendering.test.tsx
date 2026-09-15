// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveQuestionResources, requireConsistentResources, formatHeaderUnit, chartIssues } from '../functions/_shared/question-resources.ts';
import { validateQuestionCandidates } from '../functions/_shared/question-contract-validator.ts';
import { gcseBiologyIssue } from '../functions/_shared/gcse-biology-scope.ts';
import { buildBiologyInstructions } from '../functions/_shared/prompt-templates.ts';
import { prepareGroupRepair } from '../functions/_shared/prepare-group-repair.ts';

const table = { type: 'data_table', headers: ['Bacterial Strain', 'Zone of Inhibition (mm)'], rows: [['P', 10], ['Q', 15], ['R', 25], ['S', 5]], units: ['', 'mm'] };
const markdown = '| Bacterial Strain | Zone of Inhibition (mm) |\n|---|---|\n| P | 10 |\n| Q | 15 |\n| R | 25 |\n| S | 5 |';
const question = { question_number: '3(d)', question_type: 'short_answer', marks: 3, question_text: 'Use the table to identify the most susceptible strain.\n' + markdown, correct_answer: 'R has the largest zone, 25 mm.', diagram_config: table };
const scope = { subject: 'Biology Higher', educationalLevel: 'GCSE', examBoard: 'AQA' };

describe('reported table failures', () => {
  it('rejects the actual antibiotic values instead of choosing a copy', () => {
    const q = { ...question, diagram_config: { ...table, rows: [['P', 18], ['Q', 5], ['R', 25], ['S', 10]] } };
    expect(resolveQuestionResources(q).issues.some(i => i.code === 'conflicting_resource_data')).toBe(true);
    expect(() => requireConsistentResources(q)).toThrow(/disagrees/);
    expect(validateQuestionCandidates([q], { scope }).ok).toBe(false);
  });
  it('rejects the actual potato table disagreement', () => {
    const q = { question_text: '| Concentration (mol/dm³) | Change (%) |\n|---|---|\n| 0.0 | +15 |\n| 0.1 | +8 |\n| 0.2 | 0 |\n| 0.3 | -5 |\n| 0.4 | -12 |',
      diagram_config: { type: 'data_table', headers: ['Concentration (mol/dm³)', 'Change (%)'], rows: [[0, 5.2], [0.1, 2.1], [0.2, 0], [0.3, -2.5], [0.4, -5.8]] } };
    expect(resolveQuestionResources(q).issues[0].code).toBe('conflicting_resource_data');
  });
  it('removes an identical copy and preserves the assessed task', () => {
    const result = requireConsistentResources(question);
    expect(result.text).toBe('Use the table to identify the most susceptible strain.');
    expect(result.table?.rows).toEqual(table.rows);
  });
  it('treats 0 and 0.0 as equal, not as missing data', () => {
    const q = { question_text: markdown.replace('| P | 10 |', '| P | 0.0 |'), diagram_config: { ...table, rows: [['P', 0], ...table.rows.slice(1)] } };
    expect(requireConsistentResources(q).text).toBe('');
  });
  it('handles HTML tables with arbitrary classes', () => {
    const html = '<table class="other"><tr><th>Bacterial Strain</th><th>Zone of Inhibition (mm)</th></tr>' + table.rows.map(row => '<tr><td>' + row[0] + '</td><td>' + row[1] + '</td></tr>').join('') + '</table>';
    expect(requireConsistentResources({ ...question, question_text: 'Identify the strain.\n' + html }).text).toBe('Identify the strain.');
  });
  it('preserves input tables and separately headed tables', () => {
    for (const text of [markdown.replace('| P | 10 |', '| P | |'), markdown.replace('Bacterial Strain', 'Sample')]) {
      expect(requireConsistentResources({ ...question, question_text: text }).text).toBe(text);
    }
  });
  it('checks raw aliases and legacy storage', () => {
    expect(requireConsistentResources({ question_text: markdown, options: table }).text).toBe('');
    const different = { ...table, rows: [['P', 99], ...table.rows.slice(1)] };
    expect(resolveQuestionResources({ ...question, chart_data: different }).issues.length).toBeGreaterThan(0);
    expect(resolveQuestionResources({ ...question, table_data: JSON.stringify(different) }).issues.length).toBeGreaterThan(0);
  });
  it('recognises valid legacy resources at the final question gate', () => {
    for (const resource of [{ options: table }, { table_data: JSON.stringify(table) }, { diagramConfig: table }]) {
      expect(validateQuestionCandidates([{ ...question, diagram_config: null, requires_resource: true, ...resource }], { scope }).ok).toBe(true);
    }
  });
  it('rejects malformed rows and nonfinite values without crashing', () => {
    expect(resolveQuestionResources({ diagram_config: { ...table, rows: [null] }, options: table }).issues.length).toBeGreaterThan(0);
    expect(chartIssues({ ...table, rows: [['P']] }).length).toBeGreaterThan(0);
    expect(chartIssues({ ...table, rows: [['P', Infinity]] }).length).toBeGreaterThan(0);
  });
  it('prints the declared unit once', () => {
    expect(formatHeaderUnit('Zone of inhibition (mm)', 'mm')).toBe('Zone of inhibition (mm)');
    expect(formatHeaderUnit('Zone of inhibition (mm) (mm)', 'mm')).toBe('Zone of inhibition (mm)');
    expect(formatHeaderUnit('Rate', 'cm³/hour')).toBe('Rate (cm³/hour)');
  });
});

describe('graphs and placeholders', () => {
  const line = { type: 'line_chart', xLabel: 'Elapsed time (hours)', datasets: [{ label: 'Uptake', data: [{ x: 0, y: 5 }, { x: 3, y: 8 }, { x: 12, y: 28 }] }] };
  it('preserves numeric point times with unequal spacing', () => {
    expect(chartIssues(line)).toEqual([]);
    expect(requireConsistentResources({ diagram_config: line }).chart.datasets[0].data[2].x).toBe(12);
  });
  it('flags the reported ambiguous interval bars without inventing timestamps', () => {
    const bars = { type: 'bar_chart', xLabel: 'Time of Day', bars: [{ label: '00:00–03:00', value: 8 }, { label: '12:00–15:00', value: 28 }] };
    expect(chartIssues(bars)[0].code).toBe('inappropriate_graph');
    expect(chartIssues({ ...bars, measurementType: 'interval_mean' })).toEqual([]);
  });
  it('preserves categorical bars and histograms', () => {
    expect(chartIssues({ type: 'bar_chart', xLabel: 'Strain', bars: [{ label: 'P', value: 10 }] })).toEqual([]);
    expect(chartIssues({ type: 'histogram', classes: [] })).toEqual([]);
  });
  it('rejects duplicate x readings', () => {
    expect(chartIssues({ ...line, datasets: [{ label: 'Uptake', data: [{ x: 1, y: 2 }, { x: 1, y: 4 }] }] }).length).toBeGreaterThan(0);
  });
  it('removes the answer-revealing placeholder while retaining the task and data', () => {
    const text = '[Graph showing water uptake over 24 hours, with a peak between 12:00-15:00 at 28 cm³/hour]\n\nDescribe the pattern and suggest a reason for the observed peak.';
    const r = requireConsistentResources({ question_text: text, diagram_config: line });
    expect(r.text).toBe('Describe the pattern and suggest a reason for the observed peak.');
    expect(r.chart).toEqual(line);
  });
});

describe('GCSE photosynthesis boundary', () => {
  const leaked = { ...question, question_text: 'State whether the light-dependent stage occurs in thylakoid membranes or stroma.' };
  it('blocks the reported GCSE item through the common final gate', () => {
    expect(validateQuestionCandidates([leaked], { scope }).defects.some(d => d.code === 'out_of_level')).toBe(true);
  });
  it('also checks the private answer', () => {
    expect(gcseBiologyIssue({ question_text: 'Explain how plants absorb light.', correct_answer: 'The light-dependent stage produces NADPH.' }, scope)).not.toBeNull();
  });
  it('permits GCSE knowledge and retains A-level support', () => {
    expect(gcseBiologyIssue({ question_text: 'Explain how chlorophyll in chloroplasts absorbs light energy for an endothermic reaction.' }, scope)).toBeNull();
    expect(gcseBiologyIssue(leaked, { ...scope, educationalLevel: 'A Level' })).toBeNull();
  });
  it('uses the qualification in the shared Biology prompt', () => {
    expect(buildBiologyInstructions('Biology', 'GCSE')).toContain('GCSE BIOLOGY FIGURES');
    expect(buildBiologyInstructions('Biology', 'GCSE')).not.toContain('≥ 50% application');
    expect(buildBiologyInstructions('Biology', 'A Level')).toContain('APPLICATION-FIRST');
  });
});

describe('complete resource repair', () => {
  const fixed = { question_number: '3(d)', context: 'A scientist tested bacteria.', task: 'Use the table to identify the most susceptible strain.', correct_answer: 'R has the largest zone, 25 mm.', diagram_config: table };
  it('accepts a complete repaired task, resource and key', () => {
    expect(prepareGroupRepair([question], [fixed], scope)?.['3(d)'].diagram_config).toEqual(table);
  });
  it('rejects a text-only repair of a resource item', () => {
    expect(prepareGroupRepair([question], [{ ...fixed, diagram_config: null }], scope)).toBeNull();
  });
  it('rejects a missing rewritten key and partial sibling repair', () => {
    expect(prepareGroupRepair([question], [{ ...fixed, correct_answer: '' }], scope)).toBeNull();
    expect(prepareGroupRepair([question, { ...question, question_number: '3(e)' }], [fixed], scope)).toBeNull();
  });
  it('retains immutable marks and clears stale mathematics', () => {
    const q = { ...question, question_latex: '10^6' };
    const result = prepareGroupRepair([q], [{ ...fixed, marks: 99 }], scope)!['3(d)'];
    expect(result.marks).toBe(3);
    expect(result.question_latex).toBeNull();
  });
});
