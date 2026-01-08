// Graph Interpretation Question Component
// Renders a pre-generated graph with answer inputs (numeric, text, MCQ, T/F)

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { GraphRenderer } from './GraphRenderer';
import type {
  GraphInterpretationConfig,
  GraphInterpretationField,
  GraphInterpretationMarkingResult
} from './types';

interface GraphInterpretationQuestionProps {
  config: GraphInterpretationConfig;
  fields: GraphInterpretationField[];
  answers: Record<string, string | number | boolean>;
  onAnswerChange: (answers: Record<string, string | number | boolean>) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: GraphInterpretationMarkingResult;
  subjectColor?: string;
}

// Status color classes (matches table logic exactly)
const statusClasses = {
  correct: 'bg-green-100 border-green-500 dark:bg-green-900/30',
  incorrect: 'bg-red-100 border-red-500 dark:bg-red-900/30',
  missed: 'bg-orange-100 border-orange-500 dark:bg-orange-900/30'
};

const statusTextClasses = {
  correct: 'text-green-700 dark:text-green-400',
  incorrect: 'text-red-700 dark:text-red-400',
  missed: 'text-orange-700 dark:text-orange-400'
};

export function GraphInterpretationQuestion({
  config,
  fields,
  answers,
  onAnswerChange,
  readOnly = false,
  showCorrectAnswers = false,
  markingData,
  subjectColor = '#3B82F6'
}: GraphInterpretationQuestionProps) {
  
  // Get field status from marking data
  const getFieldStatus = (fieldId: string): 'correct' | 'incorrect' | 'missed' | null => {
    if (!showCorrectAnswers || !markingData?.perFieldResults?.[fieldId]) return null;
    return markingData.perFieldResults[fieldId].status;
  };

  // Handle field value change
  const handleFieldChange = (fieldId: string, value: string | number | boolean) => {
    if (readOnly) return;
    onAnswerChange({
      ...answers,
      [fieldId]: value
    });
  };

  // Render a single answer field based on its type
  const renderField = (field: GraphInterpretationField) => {
    const status = getFieldStatus(field.id);
    const currentValue = answers[field.id];
    const markingResult = markingData?.perFieldResults?.[field.id];
    
    const containerClass = cn(
      'p-3 rounded-lg border transition-colors',
      status ? statusClasses[status] : 'border-border bg-background'
    );

    switch (field.type) {
      case 'numeric':
        return (
          <div key={field.id} className={containerClass}>
            <Label className="text-sm font-medium mb-2 block">
              {field.question}
              {field.marks && <span className="text-muted-foreground ml-1">({field.marks} mark{field.marks > 1 ? 's' : ''})</span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={typeof currentValue === 'boolean' ? '' : String(currentValue ?? '')}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={readOnly}
                className={cn(
                  'max-w-[200px]',
                  status && statusTextClasses[status]
                )}
                placeholder={field.decimals ? `e.g., 3.${'0'.repeat(field.decimals)}` : 'Enter value (e.g. 2, y=2x)'}
              />
              {showCorrectAnswers && status && markingResult && (
                <span className={cn('text-sm font-medium', statusTextClasses[status])}>
                  {status === 'correct' ? '✓' : status === 'missed' ? '—' : '✗'}
                  {status !== 'correct' && (
                    <span className="ml-1 text-muted-foreground">
                      (Answer: {markingResult.correctAnswer})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={field.id} className={containerClass}>
            <Label className="text-sm font-medium mb-2 block">
              {field.question}
              {field.marks && <span className="text-muted-foreground ml-1">({field.marks} mark{field.marks > 1 ? 's' : ''})</span>}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={typeof currentValue === 'boolean' ? '' : String(currentValue ?? '')}
                onChange={(e) => handleFieldChange(field.id, e.target.value)}
                disabled={readOnly}
                className={cn(
                  'max-w-[250px]',
                  status && statusTextClasses[status]
                )}
                placeholder="Enter answer"
              />
              {showCorrectAnswers && status && markingResult && (
                <span className={cn('text-sm font-medium', statusTextClasses[status])}>
                  {status === 'correct' ? '✓' : status === 'missed' ? '—' : '✗'}
                  {status !== 'correct' && (
                    <span className="ml-1 text-muted-foreground">
                      (Answer: {markingResult.correctAnswer})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
        );

      case 'mcq':
        return (
          <div key={field.id} className={containerClass}>
            <Label className="text-sm font-medium mb-2 block">
              {field.question}
              {field.marks && <span className="text-muted-foreground ml-1">({field.marks} mark{field.marks > 1 ? 's' : ''})</span>}
            </Label>
            <RadioGroup
              value={currentValue != null ? String(currentValue) : ''}
              onValueChange={(val) => handleFieldChange(field.id, val)}
              disabled={readOnly}
              className="space-y-1"
            >
              {field.options?.map((option, idx) => {
                const isSelected = currentValue === option;
                const isCorrect = showCorrectAnswers && option === field.correctAnswer;
                
                return (
                  <div key={idx} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`${field.id}-${idx}`} />
                    <Label
                      htmlFor={`${field.id}-${idx}`}
                      className={cn(
                        'cursor-pointer',
                        showCorrectAnswers && isCorrect && 'text-green-600 font-medium',
                        showCorrectAnswers && isSelected && !isCorrect && 'text-red-600 line-through'
                      )}
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );

      case 'boolean':
        return (
          <div key={field.id} className={containerClass}>
            <Label className="text-sm font-medium mb-2 block">
              {field.question}
              {field.marks && <span className="text-muted-foreground ml-1">({field.marks} mark{field.marks > 1 ? 's' : ''})</span>}
            </Label>
            <RadioGroup
              value={currentValue === true ? 'true' : currentValue === false ? 'false' : undefined}
              onValueChange={(val) => handleFieldChange(field.id, val === 'true')}
              disabled={readOnly}
              className="flex gap-4"
            >
              {['True', 'False'].map((option) => {
                const boolValue = option === 'True';
                const isSelected = currentValue === boolValue;
                const isCorrect = showCorrectAnswers && boolValue === field.correctAnswer;
                
                return (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.toLowerCase()} id={`${field.id}-${option}`} />
                    <Label
                      htmlFor={`${field.id}-${option}`}
                      className={cn(
                        'cursor-pointer',
                        showCorrectAnswers && isCorrect && 'text-green-600 font-medium',
                        showCorrectAnswers && isSelected && !isCorrect && 'text-red-600 line-through'
                      )}
                    >
                      {option}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Graph display */}
      <div className="border rounded-lg p-4 bg-card">
        <GraphRenderer
          config={config}
          series={config.series}
          height={280}
        />
      </div>

      {/* Optional data table */}
      {config.dataTable && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {config.dataTable.headers.map((header, idx) => (
                  <th key={idx} className="px-3 py-2 text-left font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {config.dataTable.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className="border-t">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  {row.values.map((val, colIdx) => (
                    <td key={colIdx} className="px-3 py-2">{val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Answer fields */}
      <div className="space-y-3">
        <span className="text-sm font-medium text-muted-foreground">Answer the following:</span>
        {fields.map(renderField)}
      </div>

      {/* Score summary in review mode */}
      {showCorrectAnswers && markingData && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm font-medium">
            Score: {markingData.totalScore} / {markingData.totalMarks} marks
          </span>
        </div>
      )}
    </div>
  );
}
