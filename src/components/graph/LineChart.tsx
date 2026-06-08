import { useMemo } from 'react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/**
 * Line chart payload as written by the AI extractor:
 *   {
 *     type: 'line_chart',
 *     xLabel, yLabel, caption,
 *     domainX?: [min, max], domainY?: [min, max],
 *     datasets: [{ label, data: [{x:number, y:number}], color?, dashed? }]
 *   }
 */
export interface LineChartData {
  type: 'line_chart';
  xLabel?: string;
  yLabel?: string;
  caption?: string;
  domainX?: [number, number];
  domainY?: [number, number];
  datasets: Array<{
    label: string;
    color?: string;
    dashed?: boolean;
    data: Array<{ x: number; y: number }>;
  }>;
}

export function isLineChartQuestion(options: any): options is LineChartData {
  return !!options && typeof options === 'object' && options.type === 'line_chart'
    && Array.isArray(options.datasets) && options.datasets.length > 0;
}

const DEFAULT_COLORS = [
  'hsl(var(--primary))',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#84cc16',
  '#f97316',
];

interface LineChartProps {
  chartData: LineChartData;
  className?: string;
}

export const LineChart = ({ chartData, className = '' }: LineChartProps) => {
  const { datasets, xLabel, yLabel, caption, domainX, domainY } = chartData;
  const isMulti = datasets.length > 3;
  const chartHeight = isMulti ? 400 : 320;

  // Merge all x values across datasets into a single sorted axis.
  const merged = useMemo(() => {
    const xSet = new Set<number>();
    datasets.forEach(ds => ds.data.forEach(pt => xSet.add(Number(pt.x))));
    const xs = Array.from(xSet).sort((a, b) => a - b);
    return xs.map(x => {
      const row: Record<string, number | null> = { x };
      datasets.forEach(ds => {
        const m = ds.data.find(p => Number(p.x) === x);
        row[ds.label] = m ? Number(m.y) : null;
      });
      return row;
    });
  }, [datasets]);

  return (
    <figure className={`w-full my-4 ${className}`}>
      {caption && (
        <figcaption className="text-sm font-medium text-foreground mb-2 text-center">
          {caption}
        </figcaption>
      )}
      <div className="w-full rounded-lg border border-border bg-card p-3" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <RechartsLineChart
            data={merged}
            margin={{ top: 12, right: isMulti ? 140 : 24, left: 16, bottom: 48 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="x"
              type="number"
              domain={domainX ?? ['auto', 'auto']}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              tickLine={{ stroke: 'hsl(var(--border))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -36, fill: 'hsl(var(--foreground))', fontSize: 11 } : undefined}
            />
            <YAxis
              type="number"
              domain={domainY ?? ['auto', 'auto']}
              width={48}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', offset: 16, fill: 'hsl(var(--foreground))', fontSize: 11 } : undefined}
            />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 6,
                fontSize: 12,
              }}
            />
            {datasets.length > 1 && (
              <Legend
                layout={isMulti ? 'vertical' : 'horizontal'}
                align={isMulti ? 'right' : 'center'}
                verticalAlign={isMulti ? 'middle' : 'bottom'}
                wrapperStyle={{
                  fontSize: 11,
                  paddingLeft: isMulti ? 12 : 0,
                  paddingTop: isMulti ? 0 : 8,
                }}
              />
            )}
            {datasets.map((ds, i) => (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={ds.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                strokeWidth={2}
                strokeDasharray={ds.dashed ? '5 4' : undefined}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
};

export default LineChart;
