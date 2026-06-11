/**
 * GraphTransformationQuestion - A-Level style function transformation questions
 * 
 * Displays a reference curve y = f(x) with labeled key points, then asks
 * multi-part questions about applying transformations like f(x+a), af(x), -f(x).
 * Supports sketch, coordinate, equation, and text answer types.
 */
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { GraphRenderer } from "./GraphRenderer";
import { GraphPlottingQuestion } from "./GraphPlottingQuestion";
import { MathRenderer } from "@/components/MathRenderer";
import {
  GraphTransformationConfig,
  TransformationPart,
  GraphPoint,
  DrawingPath,
  LineSegment,
  GraphTransformationMarkingResult,
  GraphPlottingConfig,
  GraphSeries,
} from "./types";

interface PartAnswer {
  sketchPoints?: GraphPoint[];
  sketchCurve?: DrawingPath[];
  sketchSegments?: LineSegment[];
  textAnswer?: string;
  numericAnswer?: number;
  coordinateAnswer?: { x: number; y: number };
}

interface GraphTransformationQuestionProps {
  config: GraphTransformationConfig;
  answers: Record<string, PartAnswer>;
  onAnswerChange: (partId: string, answer: PartAnswer) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphTransformationMarkingResult;
  subjectColor?: string;
}


// Densify sparse curve data with Catmull-Rom interpolation so reference
// curves render smoothly. AI-emitted referenceCurve arrays often contain
// only 4-9 points, which previously drew as straight polyline segments.
function densifyCurve(data: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (!Array.isArray(data) || data.length < 3 || data.length >= 40) return data;
  const pts = [...data].sort((a, b) => a.x - b.x);
  const out: Array<{ x: number; y: number }> = [];
  const segments = Math.ceil(80 / (pts.length - 1));
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t < segments; t++) {
      const u = t / segments;
      const u2 = u * u;
      const u3 = u2 * u;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
      });
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export const GraphTransformationQuestion = ({
  config,
  answers,
  onAnswerChange,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  subjectColor = "#3B82F6",
}: GraphTransformationQuestionProps) => {
  const [activeSketchPart, setActiveSketchPart] = useState<string | null>(null);

  // Build reference curve series for display
  // Drawing mode per sketch part. Previously hard-coded to null with a
  // no-op handler, which made Straight/Curved/Freeform/Angle dead in
  // transformation sketches.
  const [partJoinModes, setPartJoinModes] = useState<Record<string, "straight" | "curved" | "freeform" | "angle" | "best_fit" | null>>({});

  // Normalise keyPoints: tolerate both {coordinates:{x,y}} (canonical) and
  // flat {x,y} (what AI extraction commonly emits). Without this, the curve
  // interpolation crashed silently and no reference curve rendered.
  const normalizedKeyPoints = useMemo(() => {
    const kps: any[] = (config.originalFunction?.keyPoints as any[]) ?? [];
    return kps
      .map((kp: any, i: number) => {
        const coords = kp?.coordinates
          ?? (typeof kp?.x === 'number' && typeof kp?.y === 'number' ? { x: kp.x, y: kp.y } : null);
        if (!coords || !isFinite(coords.x) || !isFinite(coords.y)) return null;
        return { id: kp.id ?? `kp-${i}`, type: kp.type ?? 'point', label: kp.label, coordinates: coords };
      })
      .filter(Boolean) as Array<{ id: string; type: string; label?: string; coordinates: { x: number; y: number } }>;
  }, [config.originalFunction?.keyPoints]);

  // Widen display domains so the grid always shows all relevant quadrants:
  // include the origin with at least one negative unit on each axis, and pad
  // one unit beyond every data point. Fixes AI-emitted domains like [0, 5]
  // that clipped the view to the first quadrant.
  const effectiveDomains = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    const collect = (pts?: Array<{ x: number; y: number }>) => {
      pts?.forEach((pt) => {
        if (pt && isFinite(pt.x) && isFinite(pt.y)) { xs.push(pt.x); ys.push(pt.y); }
      });
    };
    collect(config.originalFunction?.referenceCurve?.data as any);
    normalizedKeyPoints.forEach((kp) => { xs.push(kp.coordinates.x); ys.push(kp.coordinates.y); });
    const cfgX = (config.domainX as [number, number]) ?? [-10, 10];
    const cfgY = (config.domainY as [number, number]) ?? [-10, 10];
    const xLo = xs.length ? Math.min(...xs) - 1 : cfgX[0];
    const xHi = xs.length ? Math.max(...xs) + 1 : cfgX[1];
    const yLo = ys.length ? Math.min(...ys) - 1 : cfgY[0];
    const yHi = ys.length ? Math.max(...ys) + 1 : cfgY[1];
    return {
      domainX: [Math.floor(Math.min(cfgX[0], xLo, -1)), Math.ceil(Math.max(cfgX[1], xHi, 1))] as [number, number],
      domainY: [Math.floor(Math.min(cfgY[0], yLo, -1)), Math.ceil(Math.max(cfgY[1], yHi, 1))] as [number, number],
    };
  }, [config.domainX, config.domainY, config.originalFunction?.referenceCurve, normalizedKeyPoints]);

  const referenceSeries = useMemo(() => {
    const series: GraphSeries[] = [];
    
    // Primary: use provided reference curve (densified for smooth rendering)
    if (config.originalFunction.referenceCurve) {
      series.push({
        ...config.originalFunction.referenceCurve,
        data: densifyCurve(config.originalFunction.referenceCurve.data as any) as any,
      });
    } else if (normalizedKeyPoints.length >= 3) {
      // Fallback: generate curve from key points via interpolation
      const sortedPoints = [...normalizedKeyPoints]
        .sort((a, b) => a.coordinates.x - b.coordinates.x);
      
      // Simple polynomial interpolation for smooth curve
      const curveData: GraphPoint[] = [];
      const xMin = sortedPoints[0].coordinates.x - 1;
      const xMax = sortedPoints[sortedPoints.length - 1].coordinates.x + 1;
      
      // Use Lagrange interpolation for smooth curve
      for (let x = xMin; x <= xMax; x += 0.25) {
        let y = 0;
        for (let i = 0; i < sortedPoints.length; i++) {
          let term = sortedPoints[i].coordinates.y;
          for (let j = 0; j < sortedPoints.length; j++) {
            if (i !== j) {
              term *= (x - sortedPoints[j].coordinates.x) / 
                      (sortedPoints[i].coordinates.x - sortedPoints[j].coordinates.x);
            }
          }
          y += term;
        }
        if (isFinite(y) && Math.abs(y) < 100) {
          curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        }
      }
      
      series.push({
        id: 'interpolated',
        label: 'y = f(x)',
        data: curveData,
        color: subjectColor,
        showLine: true,
      });
    }
    
    // Always add key points as a scatter overlay for labels
    if (config.originalFunction.keyPoints?.length) {
      series.push({
        id: 'keypoints',
        label: 'Key Points',
        data: normalizedKeyPoints.map(kp => ({
          x: kp.coordinates.x,
          y: kp.coordinates.y,
          label: kp.label,
        })),
        color: '#1F2937',
        showLine: false,
      });
    }
    
    return series;
  }, [config.originalFunction, subjectColor]);

  // Get status for a part
  const getPartStatus = (partId: string): 'correct' | 'incorrect' | 'partial' | 'missed' | null => {
    if (!showCorrectAnswers || !markingData) return null;
    return markingData.perPartResults[partId]?.status || null;
  };

  // Render asymptote reference lines for the graph
  const asymptoteLines = useMemo(() => {
    if (!config.originalFunction.asymptotes?.length) return [];
    
    return config.originalFunction.asymptotes.map((asym, i) => ({
      id: `asymptote-${i}`,
      type: asym.type,
      value: asym.value,
      equation: asym.equation,
    }));
  }, [config.originalFunction.asymptotes]);

  // Render the reference function diagram
  const renderReferenceDiagram = () => {
    const { originalFunction } = config;
    const { domainX, domainY } = effectiveDomains;

    return (
      <Card className="mb-6 border-2" style={{ borderColor: `${subjectColor}40` }}>
        <CardContent className="p-4">
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-1">Given:</p>
            <div className="font-medium">
              <MathRenderer content={originalFunction.description} />
            </div>
            {originalFunction.asymptotes?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {originalFunction.asymptotes.map((a, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-mono">
                    Asymptote: <MathRenderer content={a.equation} inline />
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          
          <div className="bg-muted/30 rounded-lg p-2 relative">
            {/* Asymptote overlay - rendered as dashed lines */}
            {asymptoteLines.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-10">
                <svg className="w-full h-full" style={{ overflow: 'visible' }}>
                  {asymptoteLines.map((asym) => {
                    const domainXRange = domainX || [-10, 10];
                    const domainYRange = domainY || [-10, 10];
                    const chartWidth = 100; // percentage
                    const chartHeight = 100;
                    
                    if (asym.type === 'vertical' && asym.value !== undefined) {
                      // Convert x value to percentage position
                      const xPos = ((asym.value - domainXRange[0]) / (domainXRange[1] - domainXRange[0])) * chartWidth;
                      return (
                        <line
                          key={asym.id}
                          x1={`${xPos}%`}
                          y1="5%"
                          x2={`${xPos}%`}
                          y2="95%"
                          stroke="#EF4444"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          opacity={0.7}
                        />
                      );
                    }
                    if (asym.type === 'horizontal' && asym.value !== undefined) {
                      const yPos = 100 - ((asym.value - domainYRange[0]) / (domainYRange[1] - domainYRange[0])) * chartHeight;
                      return (
                        <line
                          key={asym.id}
                          x1="5%"
                          y1={`${yPos}%`}
                          x2="95%"
                          y2={`${yPos}%`}
                          stroke="#EF4444"
                          strokeWidth={1.5}
                          strokeDasharray="6 4"
                          opacity={0.7}
                        />
                      );
                    }
                    return null;
                  })}
                </svg>
              </div>
            )}
            
            <GraphRenderer
              config={{
                chartType: 'line',
                xLabel: config.xLabel || 'x',
                yLabel: config.yLabel || 'y',
                domainX: domainX,
                domainY: domainY,
                gridEnabled: true,
              }}
              series={referenceSeries}
              height={280}
            />
          </div>
          
          {/* Key points legend */}
          {normalizedKeyPoints.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {normalizedKeyPoints.map((kp) => (
                <Badge 
                  key={kp.id} 
                  variant="outline"
                  className="text-xs font-mono"
                  style={{ borderColor: `${subjectColor}60` }}
                >
                  <span className="font-semibold">{kp.label}</span>
                  <span className="mx-1">:</span>
                  ({kp.coordinates.x}, {kp.coordinates.y})
                  {kp.type !== 'point' && (
                    <span className="ml-1 opacity-60 text-[10px]">
                      {kp.type.replace('-', ' ').replace('_', ' ')}
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render a sketch part (uses GraphPlottingQuestion canvas)
  const renderSketchPart = (part: TransformationPart) => {
    const partAnswer = answers[part.id] || {};
    const status = getPartStatus(part.id);
    
    // Create a plotting config for the sketch canvas
    const sketchConfig: GraphPlottingConfig = {
      chartType: 'scatter',
      xLabel: config.xLabel || 'x',
      yLabel: config.yLabel || 'y',
      domainX: effectiveDomains.domainX,
      domainY: effectiveDomains.domainY,
      gridEnabled: true,
      stepX: config.sketchGridStep || 1,
      stepY: config.sketchGridStep || 1,
      snapToGrid: true,
      showConnectLine: false,
      maxPoints: 20,
      joinPointsMode: {
        enabled: true,
        graded: false,
      },
    };

    // Build reference series: show original f(x) as a faint dashed grey reference curve
    // so the student can see what they're transforming
    const sketchReferenceSeries: GraphSeries[] = [];
    
    // Add original function as a dashed grey reference curve
    if (config.originalFunction.referenceCurve) {
      sketchReferenceSeries.push({
        ...config.originalFunction.referenceCurve,
        data: densifyCurve(config.originalFunction.referenceCurve.data as any) as any,
        id: 'reference-original',
        label: 'y = f(x)',
        color: '#999999',
        lineStyle: 'dashed',
      });
    } else if (normalizedKeyPoints.length >= 3) {
      // Generate reference from key points (shape-normalised)
      const sortedPoints = [...normalizedKeyPoints]
        .sort((a, b) => a.coordinates.x - b.coordinates.x);
      const curveData: GraphPoint[] = [];
      const xMin = sortedPoints[0].coordinates.x - 1;
      const xMax = sortedPoints[sortedPoints.length - 1].coordinates.x + 1;
      for (let x = xMin; x <= xMax; x += 0.25) {
        let y = 0;
        for (let i = 0; i < sortedPoints.length; i++) {
          let term = sortedPoints[i].coordinates.y;
          for (let j = 0; j < sortedPoints.length; j++) {
            if (i !== j) {
              term *= (x - sortedPoints[j].coordinates.x) / 
                      (sortedPoints[i].coordinates.x - sortedPoints[j].coordinates.x);
            }
          }
          y += term;
        }
        if (isFinite(y) && Math.abs(y) < 100) {
          curveData.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
        }
      }
      sketchReferenceSeries.push({
        id: 'reference-original',
        label: 'y = f(x)',
        data: curveData,
        color: '#999999',
        showLine: true,
        lineStyle: 'dashed',
      });
    }

    return (
      <div className="mt-3">
        <p className="text-sm text-muted-foreground mb-2">
          Sketch your answer on the grid below. The original curve y = f(x) is shown as a dashed grey line for reference.
        </p>
        <div className="border rounded-lg p-2 bg-background">
          <GraphPlottingQuestion
            config={sketchConfig}
            studentPoints={partAnswer.sketchPoints || []}
            segments={partAnswer.sketchSegments || []}
            drawnPaths={partAnswer.sketchCurve || []}
            joinMode={partJoinModes[part.id] ?? null}
            onPointsChange={(points) => {
              onAnswerChange(part.id, { ...partAnswer, sketchPoints: points });
            }}
            onJoinModeChange={(mode) => setPartJoinModes((prev) => ({ ...prev, [part.id]: mode }))}
            onSegmentsChange={(segments) => {
              onAnswerChange(part.id, { ...partAnswer, sketchSegments: segments });
            }}
            onDrawnPathsChange={(paths) => {
              onAnswerChange(part.id, { ...partAnswer, sketchCurve: paths });
            }}
            readOnly={readOnly}
            showCorrectAnswers={showCorrectAnswers}
            subjectColor={subjectColor}
            referenceSeries={sketchReferenceSeries}
          />
        </div>
        
        {showCorrectAnswers && part.correctAnswer.transformedPoints && (
          <div className="mt-2 text-sm text-muted-foreground">
            <p className="font-medium">Expected points:</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {part.correctAnswer.transformedPoints.map((pt, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {pt.label || pt.originalLabel || `P${i+1}`}: ({pt.x}, {pt.y})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render a coordinate answer part
  const renderCoordinatePart = (part: TransformationPart) => {
    const partAnswer = answers[part.id] || {};
    const status = getPartStatus(part.id);
    
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm">(</span>
        <Input
          type="number"
          placeholder="x"
          value={partAnswer.coordinateAnswer?.x ?? ''}
          onChange={(e) => {
            const x = parseFloat(e.target.value);
            onAnswerChange(part.id, {
              ...partAnswer,
              coordinateAnswer: { 
                x: isNaN(x) ? 0 : x, 
                y: partAnswer.coordinateAnswer?.y ?? 0 
              }
            });
          }}
          disabled={readOnly}
          className="w-20"
        />
        <span className="text-sm">,</span>
        <Input
          type="number"
          placeholder="y"
          value={partAnswer.coordinateAnswer?.y ?? ''}
          onChange={(e) => {
            const y = parseFloat(e.target.value);
            onAnswerChange(part.id, {
              ...partAnswer,
              coordinateAnswer: { 
                x: partAnswer.coordinateAnswer?.x ?? 0, 
                y: isNaN(y) ? 0 : y 
              }
            });
          }}
          disabled={readOnly}
          className="w-20"
        />
        <span className="text-sm">)</span>
        
        {status && (
          <span className="ml-2">
            {status === 'correct' && <CheckCircle2 className="h-5 w-5 text-success" />}
            {status === 'incorrect' && <XCircle className="h-5 w-5 text-destructive" />}
            {status === 'partial' && <AlertCircle className="h-5 w-5 text-warning" />}
          </span>
        )}
        
        {showCorrectAnswers && part.correctAnswer.coordinateAnswer && status !== 'correct' && (
          <span className="ml-2 text-sm text-success">
            Answer: ({part.correctAnswer.coordinateAnswer.x}, {part.correctAnswer.coordinateAnswer.y})
          </span>
        )}
      </div>
    );
  };

  // Render a text/equation/value answer part
  const renderTextPart = (part: TransformationPart) => {
    const partAnswer = answers[part.id] || {};
    const status = getPartStatus(part.id);
    const isNumeric = part.questionType === 'value';
    
    return (
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <Input
            type={isNumeric ? 'number' : 'text'}
            placeholder={isNumeric ? 'Enter value...' : 'Enter your answer...'}
            value={isNumeric ? (partAnswer.numericAnswer ?? '') : (partAnswer.textAnswer ?? '')}
            onChange={(e) => {
              if (isNumeric) {
                const val = parseFloat(e.target.value);
                onAnswerChange(part.id, { ...partAnswer, numericAnswer: isNaN(val) ? undefined : val });
              } else {
                onAnswerChange(part.id, { ...partAnswer, textAnswer: e.target.value });
              }
            }}
            disabled={readOnly}
            className="max-w-xs"
          />
          
          {status && (
            <span>
              {status === 'correct' && <CheckCircle2 className="h-5 w-5 text-success" />}
              {status === 'incorrect' && <XCircle className="h-5 w-5 text-destructive" />}
              {status === 'partial' && <AlertCircle className="h-5 w-5 text-warning" />}
            </span>
          )}
        </div>
        
        {showCorrectAnswers && status !== 'correct' && (
          <p className="mt-1 text-sm text-success">
            Answer: {part.correctAnswer.textAnswer || part.correctAnswer.numericAnswer || part.correctAnswer.setAnswer}
          </p>
        )}
      </div>
    );
  };

  // Render a single part
  const renderPart = (part: TransformationPart, index: number) => {
    const status = getPartStatus(part.id);
    const markingResult = markingData?.perPartResults[part.id];
    
    return (
      <div 
        key={part.id} 
        className={cn(
          "p-4 rounded-lg border",
          status === 'correct' && 'bg-success/10 border-success/30',
          status === 'incorrect' && 'bg-destructive/10 border-destructive/30',
          status === 'partial' && 'bg-warning/10 border-warning/30',
          !status && 'bg-muted/30 border-border'
        )}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="font-mono" style={{ fontVariantLigatures: "none", fontFeatureSettings: "'liga' 0, 'calt' 0" }}>
                ({part.id})
              </Badge>
              <span className="text-sm text-muted-foreground">[{part.marks} mark{part.marks > 1 ? 's' : ''}]</span>
            </div>
            
            {/* Transformation notation */}
            <p className="font-medium mb-1">
              <MathRenderer content={part.transformation} inline />
            </p>
            
            {/* Question prompt */}
            <div className="text-sm">
              <MathRenderer content={part.prompt} />
            </div>
          </div>
          
          {markingResult && (
            <Badge 
              variant={status === 'correct' ? 'default' : 'outline'}
              className={cn(
                status === 'correct' && 'bg-success text-success-foreground',
                status === 'partial' && 'bg-warning text-warning-foreground'
              )}
            >
              {markingResult.earned}/{markingResult.max}
            </Badge>
          )}
        </div>
        
        {/* Render input by question type. Runtime guard: any part whose
            prompt says sketch/draw/plot gets the canvas even if the AI
            mis-typed it as a text part. */}
        {(() => {
          const wantsCanvas = /(sketch|draw|plot)/i.test(part.prompt || '');
          const effectiveType = part.questionType === 'sketch' || wantsCanvas ? 'sketch' : part.questionType;
          return (
            <>
              {effectiveType === 'sketch' && renderSketchPart(part)}
              {effectiveType === 'coordinates' && renderCoordinatePart(part)}
              {(effectiveType === 'equation' || effectiveType === 'value' || effectiveType === 'text' || effectiveType === 'set') && renderTextPart(part)}
            </>
          );
        })()}
        
        {/* Feedback */}
        {markingResult?.feedback && (
          <p className="mt-2 text-sm text-muted-foreground italic">
            {markingResult.feedback}
          </p>
        )}
      </div>
    );
  };

  if (!config) {
    return (
      <Card className="bg-warning/10 border-warning/30">
        <CardContent className="p-4">
          <p className="text-warning">Graph transformation configuration is missing.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Reference function diagram */}
      {renderReferenceDiagram()}
      
      {/* Question parts */}
      <div className="space-y-4">
        {config.parts.map((part, index) => renderPart(part, index))}
      </div>
      
      {/* Score summary */}
      {showCorrectAnswers && markingData && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Score:</span>
              <Badge 
                variant="default"
                className="text-lg px-3 py-1"
                style={{ backgroundColor: subjectColor }}
              >
                {markingData.totalScore}/{markingData.totalMarks}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
