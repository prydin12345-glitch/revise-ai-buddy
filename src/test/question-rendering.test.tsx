import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MathRenderer } from '@/components/MathRenderer';
import { DataTableChart } from '@/components/graph/DataTableChart';
import { getChartData } from '@/utils/chartData';
import { normalizeMathText } from '@/lib/math-text';
afterEach(cleanup);
const chart = { type: 'data_table' as const, headers: ['Strain', 'Zone (mm)'], units: ['', 'mm'], rows: [['P', 10], ['Q', 15]] };
const question = { question_text: 'Identify the strain.\n| Strain | Zone (mm) |\n|---|---|\n| P | 10 |\n| Q | 15 |', diagram_config: chart };
function Preview({ q = question }: { q?: typeof question }) {
  const chartData = getChartData(q);
  return <><MathRenderer content={q.question_text} question={q} />{chartData && <DataTableChart chartData={chartData} />}</>;
}
describe('question rendering regression', () => {
  it('renders one table and one unit label with the assessed task', () => {
    render(<Preview />);
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByText('Identify the strain.')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Zone (mm)' })).toBeTruthy();
    expect(screen.queryByText('Zone (mm) (mm)')).toBeNull();
  });
  it('shows a conflict instead of choosing a dataset', () => {
    render(<Preview q={{ ...question, diagram_config: { ...chart, rows: [['P', 18], ['Q', 5]] } }} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
  it('renders the entire raw scientific expression once despite a duplicate latex field', () => {
    const { container } = render(<MathRenderer content={String.raw`A population contains 5 \times 10^6 cells.`} latex="10^6" hasMath />);
    expect(container.querySelectorAll('.katex')).toHaveLength(1);
    expect(container.querySelector('annotation')?.textContent).toBe(String.raw`5 \times 10^{6}`);
    expect(container.textContent).toContain('cells.');
  });
  it('preserves legitimate repeated powers and existing delimiters', () => {
    const text = String.raw`Compare \(5 \times 10^6\) and $2 \times 10^6$.`;
    const { container } = render(<MathRenderer content={text} hasMath />);
    expect(container.querySelectorAll('.katex')).toHaveLength(2);
    expect(normalizeMathText('$5 \\times 10^{6}$')).toBe('$5 \\times 10^{6}$');
  });
  it('retains ordinary prose when a stray latex field exists', () => {
    render(<MathRenderer content="Explain why the population increased." latex="10^6" />);
    expect(screen.getByText('Explain why the population increased.')).toBeTruthy();
  });
});
