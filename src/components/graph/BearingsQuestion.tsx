// Bearings Question Component
// Numeric input for compass bearings with normalization and tolerance-based marking

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Compass } from 'lucide-react';
import type { BearingsQuestionConfig, BearingsMarkingResult } from './types';
import { normalizeBearing } from './types';

interface BearingsQuestionProps {
  config: BearingsQuestionConfig;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  showCorrectAnswers?: boolean;
  markingData?: BearingsMarkingResult;
}

// Status colors matching table logic
const statusColors = {
  correct: 'text-green-600 border-green-500 bg-green-50',
  incorrect: 'text-red-600 border-red-500 bg-red-50',
  missed: 'text-orange-600 border-orange-500 bg-orange-50'
};

export function BearingsQuestion({
  config,
  value,
  onChange,
  readOnly = false,
  showCorrectAnswers = false,
  markingData
}: BearingsQuestionProps) {
  const [localValue, setLocalValue] = useState(value || '');
  
  // Sync with external value
  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  // Get status for styling
  const getStatus = (): 'correct' | 'incorrect' | 'missed' | null => {
    if (!showCorrectAnswers || !markingData) return null;
    return markingData.status;
  };

  const status = getStatus();
  const normalizedInput = normalizeBearing(localValue);

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Compass className="w-5 h-5 mt-0.5 text-muted-foreground flex-shrink-0" />
        <p className="text-sm leading-relaxed">{config.prompt}</p>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <Label htmlFor="bearing-input" className="text-sm font-medium">
          Enter bearing (0° - 360°)
        </Label>
        <div className="flex items-center gap-3">
          <Input
            id="bearing-input"
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => handleChange(e.target.value)}
            disabled={readOnly}
            placeholder="Enter bearing (e.g. 045, 45°, N45E)"
            className={cn(
              'max-w-[200px]',
              status && statusColors[status]
            )}
          />
          <span className="text-sm text-muted-foreground">°</span>
          
          {/* Live preview of normalized value */}
          {!readOnly && localValue && normalizedInput !== null && (
            <span className="text-sm text-muted-foreground">
              = {normalizedInput.toFixed(1)}°
            </span>
          )}
        </div>
        
        {/* Help text */}
        <p className="text-xs text-muted-foreground">
          Accepted formats: 045, 45°, N45E, S30W
        </p>
      </div>

      {/* Result display in review mode */}
      {showCorrectAnswers && markingData && (
        <div className={cn(
          'p-4 rounded-lg border',
          status === 'correct' && 'bg-green-50 border-green-200 dark:bg-green-900/20',
          status === 'incorrect' && 'bg-red-50 border-red-200 dark:bg-red-900/20',
          status === 'missed' && 'bg-orange-50 border-orange-200 dark:bg-orange-900/20'
        )}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {status === 'correct' && '✓ Correct'}
                {status === 'incorrect' && '✗ Incorrect'}
                {status === 'missed' && '○ Unanswered'}
              </span>
              <span className="text-sm font-medium">
                {markingData.earned} / {markingData.max} marks
              </span>
            </div>
            
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your answer:</span>
                <span>
                  {markingData.studentBearing !== null 
                    ? `${markingData.studentBearing.toFixed(1)}°` 
                    : 'No answer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Correct answer:</span>
                <span className="font-medium">{markingData.correctBearing}°</span>
              </div>
              {markingData.difference !== null && status === 'incorrect' && (
                <div className="flex justify-between text-red-600">
                  <span>Difference:</span>
                  <span>±{markingData.difference.toFixed(1)}° (tolerance: ±{markingData.tolerance}°)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
