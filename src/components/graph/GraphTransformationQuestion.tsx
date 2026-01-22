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
  const referenceSeries = useMemo(() => {
    const series: GraphSeries[] = [];
    
    // Primary: use provided reference curve
    if (config.originalFunction.referenceCurve) {
      series.push(config.originalFunction.referenceCurve);
    } else if (config.originalFunction.keyPoints?.length >= 3) {
      // Fallback: generate curve from key points via interpolation
      const sortedPoints = [...config.originalFunction.keyPoints]
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
        data: config.originalFunction.keyPoints.map(kp => ({
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
    const { originalFunction, domainX, domainY } = config;

    return (
      <Card className="mb-6 border-2" style={{ borderColor: `${subjectColor}40` }}>
        <CardContent className="p-4">
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-1">Given:</p>
            <p className="font-medium">
              <MathRenderer content={originalFunction.description} />
            </p>
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
          {originalFunction.keyPoints?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {originalFunction.keyPoints.map((kp) => (
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
      domainX: config.domainX,
      domainY: config.domainY,
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

    return (
      <div className="mt-3">
        <p className="text-sm text-muted-foreground mb-2">
          Sketch your answer on the grid below. Plot key points and connect them.
        </p>
        <div className="border rounded-lg p-2 bg-background">
          <GraphPlottingQuestion
            config={sketchConfig}
            studentPoints={partAnswer.sketchPoints || []}
            segments={partAnswer.sketchSegments || []}
            drawnPaths={partAnswer.sketchCurve || []}
            joinMode={null}
            onPointsChange={(points) => {
              onAnswerChange(part.id, { ...partAnswer, sketchPoints: points });
            }}
            onJoinModeChange={() => {}}
            onSegmentsChange={(segments) => {
              onAnswerChange(part.id, { ...partAnswer, sketchSegments: segments });
            }}
            onDrawnPathsChange={(paths) => {
              onAnswerChange(part.id, { ...partAnswer, sketchCurve: paths });
            }}
            readOnly={readOnly}
            showCorrectAnswers={showCorrectAnswers}
            subjectColor={subjectColor}
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
              <Badge variant="outline" className="font-mono">
                ({part.id})
              </Badge>
              <span className="text-sm text-muted-foreground">[{part.marks} mark{part.marks > 1 ? 's' : ''}]</span>
            </div>
            
            {/* Transformation notation */}
            <p className="font-medium mb-1">
              <MathRenderer content={part.transformation} inline />
            </p>
            
            {/* Question prompt */}
            <p className="text-sm">
              <MathRenderer content={part.prompt} />
            </p>
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
        
        {/* Render appropriate input based on question type */}
        {part.questionType === 'sketch' && renderSketchPart(part)}
        {part.questionType === 'coordinates' && renderCoordinatePart(part)}
        {(part.questionType === 'equation' || part.questionType === 'value' || part.questionType === 'text' || part.questionType === 'set') && renderTextPart(part)}
        
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
