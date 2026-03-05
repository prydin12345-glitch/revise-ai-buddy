// Shared graph renderer component using Recharts

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  ScatterChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  Legend
} from 'recharts';
import { cn } from '@/lib/utils';
import type { GraphConfig, GraphSeries, GraphPoint } from './types';

interface RegressionLine {
  slope: number;
  intercept: number;
  color?: string;
}

interface GraphRendererProps {
  config: GraphConfig;
  series: GraphSeries[];
  studentPoints?: GraphPoint[];
  expectedPoints?: GraphPoint[];
  showCorrectAnswers?: boolean;
  // Marking results for plotting review
  pointStatuses?: Array<{ point: GraphPoint; status: 'correct' | 'incorrect' | 'missed' }>;
  regressionLine?: RegressionLine;
  onChartClick?: (x: number, y: number) => void;
  interactive?: boolean;
  height?: number;
  className?: string;
}

// Status color mapping (matches table logic)
const statusColors = {
  correct: '#22c55e', // green-500
  incorrect: '#ef4444', // red-500
  missed: '#f97316', // orange-500
  neutral: '#3b82f6' // blue-500
};

export function GraphRenderer({
  config,
  series,
  studentPoints = [],
  expectedPoints = [],
  showCorrectAnswers = false,
  pointStatuses = [],
  regressionLine,
  onChartClick,
  interactive = false,
  height = 300,
  className
}: GraphRendererProps) {
  const { chartType, xLabel, yLabel, domainX, domainY, gridEnabled = true } = config;

  // Calculate domain from data if not specified
  const calculatedDomain = useMemo(() => {
    const allPoints = [
      ...series.flatMap(s => s.data),
      ...studentPoints,
      ...expectedPoints
    ];
    
    if (allPoints.length === 0) {
      return { x: domainX || [-10, 10], y: domainY || [-10, 10] };
    }

    const xValues = allPoints.map(p => p.x);
    const yValues = allPoints.map(p => p.y);
    
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    
    // Add 10% padding
    const xPad = Math.max(1, (maxX - minX) * 0.1);
    const yPad = Math.max(1, (maxY - minY) * 0.1);

    return {
      x: domainX || [Math.floor(minX - xPad), Math.ceil(maxX + xPad)],
      y: domainY || [Math.floor(minY - yPad), Math.ceil(maxY + yPad)]
    };
  }, [series, studentPoints, expectedPoints, domainX, domainY]);

  // Handle click for interactive plotting
  const handleChartClick = (event: any) => {
    if (!interactive || !onChartClick || !event?.activeCoordinate) return;
    
    // The activeCoordinate gives pixel position, we need chart values
    // This is a simplified approach - for production you'd use refs
    const { activePayload } = event;
    if (activePayload?.[0]?.payload) {
      const { x, y } = activePayload[0].payload;
      onChartClick(x, y);
    }
  };

  // Prepare data for Recharts
  const chartData = useMemo(() => {
    if (series.length === 0) return [];
    
    // Merge all series data points by x value for line chart
    const pointMap = new Map<number, Record<string, number>>();
    
    series.forEach(s => {
      s.data.forEach(point => {
        const existing = pointMap.get(point.x) || { x: point.x };
        existing[s.id] = point.y;
        pointMap.set(point.x, existing);
      });
    });
    
    return Array.from(pointMap.values()).sort((a, b) => a.x - b.x);
  }, [series]);

  // Common axis props
  const axisProps = {
    stroke: 'hsl(var(--muted-foreground))',
    style: { fontSize: '12px' }
  };

  // Render line chart for interpretation
  if (chartType === 'line' || (chartType === 'scatter' && series.some(s => s.showLine))) {
    return (
      <div className={cn('w-full', className)}>
        <ResponsiveContainer width="100%" aspect={1.2}>
          <LineChart
            data={chartData}
            onClick={interactive ? handleChartClick : undefined}
            style={{ cursor: interactive ? 'crosshair' : 'default' }}
            margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
          >
            {gridEnabled && (
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            )}
            <XAxis
              dataKey="x"
              domain={calculatedDomain.x}
              type="number"
              {...axisProps}
              label={{ value: xLabel, position: 'bottom', offset: 10 }}
            />
            <YAxis
              domain={calculatedDomain.y}
              {...axisProps}
              label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              formatter={(value: number, name: string) => [value.toFixed(2), name]}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 10 }} />
            
            {series.map(s => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={s.color || statusColors.neutral}
                strokeWidth={2}
                strokeDasharray={s.lineStyle === 'dashed' ? '5 5' : s.lineStyle === 'dotted' ? '2 2' : undefined}
                dot={false}
                connectNulls
              />
            ))}
            
            {/* Student plotted points */}
            {studentPoints.map((point, idx) => {
              const status = pointStatuses.find(ps => 
                ps.point.x === point.x && ps.point.y === point.y
              )?.status;
              
              return (
                <ReferenceDot
                  key={`student-${idx}`}
                  x={point.x}
                  y={point.y}
                  r={6}
                  fill={status ? statusColors[status] : statusColors.neutral}
                  stroke="#fff"
                  strokeWidth={2}
                />
              );
            })}
            
            {/* Expected points (review mode) */}
            {showCorrectAnswers && expectedPoints.map((point, idx) => {
              const wasMatched = pointStatuses.some(ps => 
                ps.status === 'correct' && 
                Math.abs(ps.point.x - point.x) < 0.01 && 
                Math.abs(ps.point.y - point.y) < 0.01
              );
              
              if (wasMatched) return null; // Don't double-render matched points
              
              return (
                <ReferenceDot
                  key={`expected-${idx}`}
                  x={point.x}
                  y={point.y}
                  r={6}
                  fill="transparent"
                  stroke={statusColors.missed}
                  strokeWidth={2}
                  strokeDasharray="3 3"
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Render scatter chart
  return (
    <div className={cn('w-full', className)}>
      <ResponsiveContainer width="100%" aspect={1.2}>
        <ScatterChart
          onClick={interactive ? handleChartClick : undefined}
          style={{ cursor: interactive ? 'crosshair' : 'default' }}
          margin={{ top: 20, right: 30, left: 20, bottom: 30 }}
        >
          {gridEnabled && (
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          )}
          <XAxis
            dataKey="x"
            domain={calculatedDomain.x}
            type="number"
            {...axisProps}
            label={{ value: xLabel, position: 'bottom', offset: 10 }}
          />
          <YAxis
            dataKey="y"
            domain={calculatedDomain.y}
            type="number"
            {...axisProps}
            label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px'
            }}
            formatter={(value: number) => value.toFixed(2)}
          />
          
          {series.map(s => (
            <Scatter
              key={s.id}
              name={s.label}
              data={s.data}
              fill={s.color || statusColors.neutral}
            />
          ))}
          
          {/* Student points as a separate scatter */}
          {studentPoints.length > 0 && (
            <Scatter
              name="Your points"
              data={studentPoints.map((p, idx) => ({
                ...p,
                status: pointStatuses[idx]?.status
              }))}
              fill={statusColors.neutral}
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                const color = payload.status ? statusColors[payload.status] : statusColors.neutral;
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
            />
          )}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
