/**
 * ReferenceDiagram - Displays a static reference graph for questions that mention 
 * "shown in the diagram" but are short_answer type (not interactive graph questions).
 * 
 * This component renders the graphConfig.series data from a related question or
 * generates a curve from a function expression in the question text.
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Line,
} from 'recharts';
import { GraphSeries } from './types';

interface ReferenceDiagramProps {
  series: GraphSeries[];
  domainX?: [number, number];
  domainY?: [number, number];
  xLabel?: string;
  yLabel?: string;
  className?: string;
}

/**
 * Parse a simple function expression and generate curve data points.
 * Supports: x(x+a)(b-x), x(x+a)(x-b), ax^2+bx+c, 1/(x+a), etc.
 */
export function generateCurveFromExpression(
  expression: string,
  domainX: [number, number] = [-5, 5],
  steps: number = 50
): { x: number; y: number }[] | null {
  try {
    // Clean the expression
    const cleanExpr = expression
      .replace(/\s+/g, '')
      .replace(/−/g, '-')
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .toLowerCase();
    
    // Try to parse common patterns
    
    // Pattern 1: x(x+a)(b-x) or x(x+a)(x-b)
    const cubicMatch = cleanExpr.match(/x\(x([+-]\d+(?:\.\d+)?)\)\((\d+(?:\.\d+)?)?([+-])?x?\)/);
    if (cubicMatch) {
      const a = parseFloat(cubicMatch[1]);
      const b = parseFloat(cubicMatch[2] || '1');
      const isNegX = cubicMatch[3] === '-' || cleanExpr.includes('-x)');
      
      return Array.from({ length: steps + 1 }, (_, i) => {
        const x = domainX[0] + (i / steps) * (domainX[1] - domainX[0]);
        const y = isNegX 
          ? x * (x + a) * (b - x)
          : x * (x + a) * (x - b);
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      });
    }
    
    // Pattern 2: (x+a)^2(x-b) style cubic
    const cubicMatch2 = cleanExpr.match(/\(x([+-]\d+(?:\.\d+)?)\)\^?2\(x([+-]\d+(?:\.\d+)?)\)/);
    if (cubicMatch2) {
      const a = parseFloat(cubicMatch2[1]);
      const b = parseFloat(cubicMatch2[2]);
      
      return Array.from({ length: steps + 1 }, (_, i) => {
        const x = domainX[0] + (i / steps) * (domainX[1] - domainX[0]);
        const y = Math.pow(x + a, 2) * (x + b);
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      });
    }
    
    // Pattern 3: 1/(x+a) - reciprocal
    const reciprocalMatch = cleanExpr.match(/1\/\(x([+-]\d+(?:\.\d+)?)\)/);
    if (reciprocalMatch) {
      const a = parseFloat(reciprocalMatch[1]);
      const asymptote = -a;
      
      return Array.from({ length: steps + 1 }, (_, i) => {
        const x = domainX[0] + (i / steps) * (domainX[1] - domainX[0]);
        if (Math.abs(x - asymptote) < 0.1) return { x, y: NaN }; // Skip near asymptote
        const y = 1 / (x + a);
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      }).filter(p => !isNaN(p.y) && Math.abs(p.y) < 100);
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract function expression from question text.
 * Looks for patterns like "f(x) = ..." or "y = f(x) where f(x) = ..."
 */
export function extractFunctionFromText(text: string): string | null {
  // Pattern: f(x) = expression
  const fxMatch = text.match(/f\(x\)\s*=\s*([^.]+?)(?:\.|$|is\s+shown)/i);
  if (fxMatch) {
    return fxMatch[1].trim();
  }
  
  // Pattern: where f(x) = expression
  const whereMatch = text.match(/where\s+f\(x\)\s*=\s*([^.]+?)(?:\.|$|is\s+shown)/i);
  if (whereMatch) {
    return whereMatch[1].trim();
  }
  
  return null;
}

export function ReferenceDiagram({
  series,
  domainX = [-5, 5],
  domainY = [-5, 5],
  xLabel = 'x',
  yLabel = 'y',
  className = '',
}: ReferenceDiagramProps) {
  // Filter out series without valid data
  const validSeries = useMemo(() => 
    series.filter(s => s.data && s.data.length >= 2), 
    [series]
  );
  
  if (validSeries.length === 0) {
    return null;
  }
  
  return (
    <div className={`w-full aspect-[4/3] max-w-md border rounded-lg bg-card p-2 ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 15, right: 15, bottom: 30, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          
          <XAxis
            type="number"
            dataKey="x"
            domain={domainX}
            tickCount={Math.min(11, domainX[1] - domainX[0] + 1)}
            allowDecimals={true}
            label={{ 
              value: xLabel, 
              position: 'bottom', 
              offset: 5,
              style: { fill: 'hsl(var(--foreground))' }
            }}
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
            stroke="hsl(var(--foreground))"
          />
          
          <YAxis
            type="number"
            dataKey="y"
            domain={domainY}
            tickCount={Math.min(11, domainY[1] - domainY[0] + 1)}
            allowDecimals={true}
            label={{ 
              value: yLabel, 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: 'hsl(var(--foreground))' }
            }}
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
            stroke="hsl(var(--foreground))"
          />
          
          {/* Reference lines at 0 */}
          {domainX[0] <= 0 && domainX[1] >= 0 && (
            <ReferenceLine x={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
          )}
          {domainY[0] <= 0 && domainY[1] >= 0 && (
            <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeWidth={1} />
          )}
          
          {/* Render each series as a line */}
          {validSeries.map((s, idx) => {
            const lineColor = s.color || 'hsl(var(--primary))';
            const lineStyle = s.lineStyle === 'dashed' ? '5 5' : 
                             s.lineStyle === 'dotted' ? '2 2' : undefined;
            
            return (
              <Line
                key={s.id || `series-${idx}`}
                type="monotone"
                data={s.data}
                dataKey="y"
                stroke={lineColor}
                strokeWidth={2}
                strokeDasharray={lineStyle}
                dot={false}
                isAnimationActive={false}
                name={s.label}
                connectNulls
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Legend for labeled series */}
      {validSeries.some(s => s.label) && (
        <div className="text-center text-sm text-muted-foreground mt-1">
          {validSeries.map(s => s.label).filter(Boolean).join(', ')}
        </div>
      )}
    </div>
  );
}

export default ReferenceDiagram;
