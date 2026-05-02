/**
 * QuestionItem - Renders a single question within a grouped question display.
 * Used by TakePracticeQuiz to display multiple sub-questions (e.g., 5a, 5b, 5c) on one page.
 */
import React, { useRef, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Calculator, CheckCircle2, Loader2 } from 'lucide-react';
import { MathRenderer } from '@/components/MathRenderer';
import { MathInsertKeypad, normalizeUnicodeForGrading } from '@/components/quiz/MathInsertKeypad';
import { 
  ReferenceDiagram,
  GraphInterpretationQuestion,
  GraphPlottingQuestion,
  BearingsQuestion,
  parseGraphQuestionData,
  serializeGraphInterpretationResponse,
  serializeGraphPlottingResponse,
  serializeBearingsResponse,
  type GraphInterpretationConfig,
  type GraphPlottingConfig,
  type GraphPoint,
  type GraphSeries,
  type BearingsQuestionConfig,
  type BearingsMarkingResult,
  type LineSegment,
  type DrawingPath,
} from '@/components/graph';
import {
  TableGridQuestion,
  parseMarkdownToTableGrid,
  isTickXTable,
  serializeTableGridAnswer,
  type TableGridData
} from '@/components/exam/TableGridQuestion';
import type { AngleMeasurement } from '@/components/graph/GraphPlottingQuestion';
import { generateCurveFromFormula, parseTransformFromQuestionText, applyFormulaTransform } from '@/lib/formula-evaluator';

interface Question {
  id: string;
  question_number: string;
  question_type: string;
  question_text: string;
  marks: number;
  options?: any;
  correct_answer?: string;
  has_math?: boolean;
  question_latex?: string;
  subtopic: string;
  worked_solution?: string;
}

interface UserAnswer {
  answer: string;
  answerLatex?: string;
  workingOut?: string;
  submitted: boolean;
  isCorrect?: boolean;
  score?: number;
  methodMarks?: number;
  accuracyMarks?: number;
  feedback?: string;
  useMathInput?: boolean;
  tableGridAnswers?: Record<string, number[]>;
  tableGridInputs?: Record<string, Record<number, string | number>>;
  markingData?: any;
  graphInterpretationAnswers?: Record<string, string | number | boolean>;
  graphPlottedPoints?: GraphPoint[];
  graphJoinMode?: 'straight' | 'curved' | 'freeform' | 'angle' | 'best_fit' | null;
  graphSegments?: LineSegment[];
  graphDrawnPaths?: DrawingPath[];
  graphBestFitLine?: import('@/components/graph').BestFitLine | null;
  graphMarkingData?: any;
  bearingsAnswer?: string;
  bearingsMarkingData?: BearingsMarkingResult;
  protractorState?: { x: number; y: number; rotationDeg: number; visible: boolean };
}

interface QuestionItemProps {
  question: Question;
  answer: UserAnswer;
  subjectColor: string;
  isFirst: boolean;
  showMathKeypad: boolean;
  onToggleMathKeypad: () => void;
  onAnswerChange: (questionId: string, answer: UserAnswer) => void;
  onSubmitAnswer: (questionId: string) => void;
  isGrading: boolean;
  workedSolutionVisible: boolean;
  referenceSeries?: { series: GraphSeries[]; domainX: [number, number]; domainY: [number, number] } | null;
  showProtractor?: boolean;
  selectedSegmentIds?: string[];
  onSelectedSegmentIdsChange?: (ids: string[]) => void;
  angleMeasurements?: AngleMeasurement[];
  onAngleMeasurementsChange?: (measurements: AngleMeasurement[]) => void;
  isReviewMode?: boolean;
}

// Helper to convert toggles for serialization
function convertTogglesForSerialization(
  toggles: Record<string, number[]>
): Record<string, Record<number, boolean>> {
  const result: Record<string, Record<number, boolean>> = {};
  for (const [rowId, colIndices] of Object.entries(toggles)) {
    result[rowId] = {};
    for (const idx of colIndices) {
      result[rowId][idx] = true;
    }
  }
  return result;
}

export function QuestionItem({
  question,
  answer,
  subjectColor,
  isFirst,
  showMathKeypad,
  onToggleMathKeypad,
  onAnswerChange,
  onSubmitAnswer,
  isGrading,
  workedSolutionVisible,
  referenceSeries,
  showProtractor = false,
  selectedSegmentIds = [],
  onSelectedSegmentIdsChange,
  angleMeasurements = [],
  onAngleMeasurementsChange,
  isReviewMode = false,
}: QuestionItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (newText: string) => {
    onAnswerChange(question.id, { ...answer, answer: newText });
  };

  const renderAnswerInput = () => {
    // Check if this is a table_grid question
    const isTableGrid = question.question_type === 'table_grid' || isTickXTable(question.question_text);
    
    if (isTableGrid) {
      let tableData: TableGridData | null = null;
      let correctAnswersData: Record<string, number[]> | undefined;
      let correctInputsData: Record<string, Record<number, string | number>> | undefined;
      
      if (question.correct_answer) {
        try {
          const parsed = JSON.parse(question.correct_answer);
          if (parsed.table_data) {
            tableData = parsed.table_data;
            if (parsed.correctAnswers) correctAnswersData = parsed.correctAnswers;
            if (parsed.correctInputs) correctInputsData = parsed.correctInputs;
          }
        } catch {}
      }
      
      if (!tableData) tableData = parseMarkdownToTableGrid(question.question_text);
      
      if (tableData) {
        const isInputTable = tableData.tableType === 'text_entry' || 
          tableData.tableType === 'number_entry' || 
          tableData.tableType === 'mixed' ||
          tableData.selectionMode === 'text' || 
          tableData.selectionMode === 'number' ||
          (tableData.columns && tableData.columns.some(c => c.kind === 'text' || c.kind === 'number'));
        
        const effectiveCorrectAnswers = answer.markingData?.correctAnswers || correctAnswersData;
        const effectiveCorrectInputs = (answer.markingData as any)?.correctInputs || correctInputsData;
        
        return (
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">
              {isInputTable ? 'Complete the table by typing your answers:' : 'Complete the table below:'}
            </span>
            <TableGridQuestion
              tableData={tableData}
              questionId={question.id}
              answers={answer.tableGridAnswers || {}}
              inputAnswers={answer.tableGridInputs || {}}
              onAnswerChange={(toggleAnswers, inputAnswers) => {
                const cellsForStorage = convertTogglesForSerialization(toggleAnswers);
                const serialized = serializeTableGridAnswer(cellsForStorage, inputAnswers);
                onAnswerChange(question.id, {
                  ...answer,
                  answer: serialized,
                  tableGridAnswers: toggleAnswers,
                  tableGridInputs: inputAnswers
                });
              }}
              readOnly={answer.submitted}
              subjectColor={subjectColor}
              showCorrectAnswers={answer.submitted && !!answer.feedback}
              correctAnswers={effectiveCorrectAnswers}
              correctInputs={effectiveCorrectInputs}
              markingData={answer.markingData}
            />
          </div>
        );
      }
    }
    
    // Check for graph questions
    const graphData = parseGraphQuestionData(
      question.correct_answer,
      (question as any).diagram_config ?? null,
      question.question_type ?? null,
    );
    const isGraphInterpretation = question.question_type === 'graph_interpretation' || 
      (question.question_type !== 'short_answer' && question.question_type !== 'extended' && graphData?.graphType === 'interpretation');
    const isGraphPlotting = question.question_type === 'graph_plotting' || 
      (question.question_type !== 'short_answer' && question.question_type !== 'extended' && graphData?.graphType === 'plotting');
    const isBearings = question.question_type === 'bearings' || 
      (question.question_type !== 'short_answer' && question.question_type !== 'extended' && graphData?.graphType === 'bearings');
    
    // Bearings question
    if (isBearings && graphData?.bearingsConfig) {
      return (
        <BearingsQuestion
          config={graphData.bearingsConfig as BearingsQuestionConfig}
          value={answer.bearingsAnswer || ''}
          onChange={(value) => {
            const serialized = serializeBearingsResponse(value);
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              bearingsAnswer: value,
            });
          }}
          readOnly={answer.submitted}
          showCorrectAnswers={answer.submitted && !!answer.feedback}
          markingData={answer.bearingsMarkingData}
        />
      );
    }
    
    // Graph interpretation
    if (isGraphInterpretation && graphData) {
      const config = graphData.graphConfig as GraphInterpretationConfig;
      const fields = graphData.interpretationFields || [];
      
      return (
        <GraphInterpretationQuestion
          config={config}
          fields={fields}
          answers={answer.graphInterpretationAnswers || {}}
          onAnswerChange={(newAnswers) => {
            const serialized = serializeGraphInterpretationResponse(newAnswers);
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphInterpretationAnswers: newAnswers,
            });
          }}
          readOnly={answer.submitted}
          showCorrectAnswers={answer.submitted && !!answer.feedback}
          markingData={answer.graphMarkingData?.perFieldResults ? {
            perFieldResults: answer.graphMarkingData.perFieldResults,
            totalScore: answer.score || 0,
            totalMarks: question.marks,
          } : undefined}
          subjectColor={subjectColor}
        />
      );
    }
    
    // Graph plotting
    if (isGraphPlotting && graphData) {
      const config = graphData.graphConfig as GraphPlottingConfig;
      const plottingAnswer = graphData.plottingAnswer;
      
      // Generate expectedCurveSeries for review mode
      const isInReview = answer.submitted && !!answer.feedback;
      const expectedCurveSeries: GraphSeries[] = (() => {
        if (!isInReview || !plottingAnswer) return [];
        
        // Priority: markingFormula (Desmos method)
        const pa = plottingAnswer as any;
        const formula = pa.markingFormula;
        const domainX = config.domainX || [-10, 10];
        const isBareRef = formula && /^[a-zA-Z]\(x\)$/.test(formula.trim());
        if (formula && !isBareRef) {
          const curves = generateCurveFromFormula(formula, domainX);
          if (curves.length > 0) return curves;
        }
        
        // Fallback: cached expectedCurve
        const expCurve = pa.expectedCurve;
        if (!expCurve) return [];
        if (Array.isArray(expCurve) && expCurve.length > 0 && typeof expCurve[0] === 'object' && 'data' in expCurve[0]) {
          return expCurve.map((branch: any, idx: number) => ({
            id: branch.id || `expected-branch-${idx}`,
            label: branch.label || '',
            data: branch.data || [],
            showLine: true,
            lineStyle: 'solid' as const,
            color: 'hsl(142, 76%, 36%)',
          }));
        }
        if (expCurve && typeof expCurve === 'object' && !Array.isArray(expCurve) && Array.isArray((expCurve as any).data)) {
          return [{
            id: 'expected-answer',
            label: 'Expected Answer',
            data: (expCurve as any).data,
            showLine: true,
            lineStyle: 'solid' as const,
            color: 'hsl(142, 76%, 36%)',
          }];
        }
        return [];
      })();

      // In review mode, hide reference series to avoid clutter with the answer line
      const effectiveRefSeries = isInReview ? [] : ((graphData.graphConfig as any)?.series || []);
      
      return (
        <GraphPlottingQuestion
          key={`graph-plotting-${question.id}`}
          questionId={question.id}
          config={{
            ...config,
            maxPoints: config.maxPoints === 1 ? undefined : config.maxPoints,
            joinPointsMode: {
              enabled: true,
              graded: config.joinPointsMode?.graded,
              correctMode: config.joinPointsMode?.correctMode,
            }
          }}
          expectedAnswer={plottingAnswer || { expectedPoints: [], toleranceUnits: 0.5 }}
          studentPoints={answer.graphPlottedPoints || []}
          showProtractor={showProtractor}
          selectedSegmentIds={selectedSegmentIds}
          onSelectedSegmentIdsChange={onSelectedSegmentIdsChange}
          referenceSeries={effectiveRefSeries}
          expectedCurveSeries={expectedCurveSeries}
          onPointsChange={(points) => {
            const serialized = serializeGraphPlottingResponse(
              points,
              answer.graphJoinMode,
              answer.graphSegments,
              answer.graphDrawnPaths,
              answer.graphBestFitLine
            );
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphPlottedPoints: points,
            });
          }}
          joinMode={answer.graphJoinMode}
          onJoinModeChange={(mode) => {
            const serialized = serializeGraphPlottingResponse(
              answer.graphPlottedPoints || [],
              mode,
              answer.graphSegments,
              answer.graphDrawnPaths,
              answer.graphBestFitLine
            );
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphJoinMode: mode,
            });
          }}
          segments={answer.graphSegments || []}
          onSegmentsChange={(segments) => {
            const serialized = serializeGraphPlottingResponse(
              answer.graphPlottedPoints || [],
              answer.graphJoinMode,
              segments,
              answer.graphDrawnPaths,
              answer.graphBestFitLine
            );
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphSegments: segments,
            });
          }}
          drawnPaths={answer.graphDrawnPaths}
          onDrawnPathsChange={(paths) => {
            const serialized = serializeGraphPlottingResponse(
              answer.graphPlottedPoints || [],
              answer.graphJoinMode,
              answer.graphSegments,
              paths,
              answer.graphBestFitLine
            );
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphDrawnPaths: paths,
            });
          }}
          bestFitLine={answer.graphBestFitLine ?? null}
          onBestFitLineChange={(line) => {
            const serialized = serializeGraphPlottingResponse(
              answer.graphPlottedPoints || [],
              answer.graphJoinMode,
              answer.graphSegments,
              answer.graphDrawnPaths,
              line
            );
            onAnswerChange(question.id, {
              ...answer,
              answer: serialized,
              graphBestFitLine: line,
            });
          }}
          readOnly={answer.submitted}
          showCorrectAnswers={isInReview}
          markingData={answer.graphMarkingData?.perPointResults ? {
            perPointResults: answer.graphMarkingData.perPointResults,
            totalScore: answer.score || 0,
            totalMarks: question.marks,
          } : undefined}
          subjectColor={subjectColor}
          angleMeasurements={angleMeasurements}
          onAngleMeasurementsChange={onAngleMeasurementsChange}
          questionText={question.question_text}
        />
      );
    }
    
    // Default: standard text input with reference diagram if needed
    return (
      <div className="space-y-4">
        {/* Show reference diagram if question mentions "shown in the diagram" */}
        {referenceSeries && referenceSeries.series.length > 0 && (
          <ReferenceDiagram
            series={referenceSeries.series}
            domainX={referenceSeries.domainX}
            domainY={referenceSeries.domainY}
            className="mx-auto"
          />
        )}
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Your Answer</span>
            <Button
              variant={showMathKeypad ? "secondary" : "ghost"}
              size="icon"
              onClick={onToggleMathKeypad}
              disabled={answer.submitted}
              title="Math symbols"
            >
              <Calculator className="w-4 h-4" />
            </Button>
          </div>
          <Textarea 
            ref={textareaRef}
            value={answer.answer} 
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={answer.submitted} 
            className="min-h-[120px] lg:min-h-[140px] text-base text-foreground" 
            placeholder={question.has_math ? "Type your answer here… (use the calculator icon for symbols)" : "Type your answer here…"}
          />
          
          {showMathKeypad && !answer.submitted && (
            <MathInsertKeypad
              isOpen={true}
              onClose={onToggleMathKeypad}
              onInsert={(text, caretOffset) => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const before = answer.answer.substring(0, start);
                const after = answer.answer.substring(end);
                const newValue = before + text + after;
                
                handleTextChange(newValue);
                
                requestAnimationFrame(() => {
                  textarea.focus();
                  const insertEnd = start + text.length;
                  const newPos = caretOffset ? insertEnd - caretOffset : insertEnd;
                  textarea.setSelectionRange(newPos, newPos);
                });
              }}
              onNavigate={(direction) => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                const pos = textarea.selectionStart;
                const newPos = direction === 'left' 
                  ? Math.max(0, pos - 1) 
                  : Math.min(answer.answer.length, pos + 1);
                textarea.focus();
                textarea.setSelectionRange(newPos, newPos);
              }}
              onDelete={() => {
                const textarea = textareaRef.current;
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                
                if (start === end && start > 0) {
                  const before = answer.answer.substring(0, start - 1);
                  const after = answer.answer.substring(end);
                  handleTextChange(before + after);
                  requestAnimationFrame(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start - 1, start - 1);
                  });
                } else if (start !== end) {
                  const before = answer.answer.substring(0, start);
                  const after = answer.answer.substring(end);
                  handleTextChange(before + after);
                  requestAnimationFrame(() => {
                    textarea.focus();
                    textarea.setSelectionRange(start, start);
                  });
                }
              }}
              subjectColor={subjectColor}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${!isFirst ? 'pt-6 border-t border-border' : ''}`}>
      {/* Question header */}
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm font-semibold">
            {question.question_number}
          </Badge>
        </div>
        <Badge style={{ backgroundColor: subjectColor, color: 'white' }} className="text-sm px-3 py-1 shrink-0">
          {question.marks} marks
        </Badge>
      </div>

      {/* Question text */}
      <div className="text-base lg:text-lg leading-relaxed">
        <MathRenderer content={question.question_text} hasMath={question.has_math} />
      </div>

      {/* Answer input */}
      {renderAnswerInput()}

      {/* Submit button for this sub-question (only if not in review mode and not already submitted) */}
      {!isReviewMode && !answer.submitted && (
        <div className="flex justify-end">
          <Button
            onClick={() => onSubmitAnswer(question.id)}
            disabled={isGrading || !answer.answer.trim()}
            size="sm"
            style={{ backgroundColor: subjectColor }}
          >
            {isGrading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Submit {question.question_number}
          </Button>
        </div>
      )}

      {/* Feedback section after submission */}
      {answer.submitted && (
        <Card className="border-l-4" style={{ borderLeftColor: (answer.score || 0) === question.marks ? 'hsl(var(--success))' : (answer.score || 0) > 0 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))' }}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-base">{answer.score?.toFixed(1)} / {question.marks} marks</span>
            </div>
            <div className="border-t pt-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Feedback</p>
              <div className="text-sm leading-relaxed">
                <MathRenderer content={answer.feedback || ""} />
              </div>
            </div>
            {workedSolutionVisible && question.worked_solution && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="font-medium text-sm">Worked Solution</p>
                </div>
                <div className="text-sm leading-relaxed">
                  <MathRenderer content={question.worked_solution} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default QuestionItem;
