import { it, expect } from 'vitest';
import { axisLabels } from '@/components/graph/LineChart';

it('shows axis labels written as xAxisLabel/yAxisLabel', () => {
  expect(axisLabels({ xAxisLabel: 'Time / s', yAxisLabel: 'p.d. / V' })).toEqual({ xLabel: 'Time / s', yLabel: 'p.d. / V' });
  expect(axisLabels({ xLabel: 'Time / min', xAxisLabel: 'other' }).xLabel).toBe('Time / min');
});
