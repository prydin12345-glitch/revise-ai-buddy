import React, { useState, useCallback, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { 
  AlertCircle, 
  AlertTriangle, 
  ChevronDown, 
  Lightbulb, 
  RotateCcw,
  Check
} from 'lucide-react';
import { 
  sanitizeNotes, 
  validateNotesQuick, 
  MAX_NOTES_LENGTH, 
  NOTES_EXAMPLES,
  type NotesSanitizationResult 
} from '@/lib/notes-sanitizer';
import { cn } from '@/lib/utils';

interface NotesInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (result: NotesSanitizationResult) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NotesInput({
  value,
  onChange,
  onValidationChange,
  placeholder = "Add constraints like topics, style, difficulty, question types...",
  className,
  disabled = false,
}: NotesInputProps) {
  const [showExamples, setShowExamples] = useState(false);
  const [validationResult, setValidationResult] = useState<NotesSanitizationResult | null>(null);
  const [touched, setTouched] = useState(false);

  // Validate on blur or when value changes (debounced)
  const validateNotes = useCallback(() => {
    if (!value.trim()) {
      setValidationResult(null);
      onValidationChange?.({
        isValid: true,
        sanitizedNotes: '',
        warnings: [],
        blockedReasons: [],
        characterCount: 0,
        redactionsCount: 0,
      });
      return;
    }

    const result = sanitizeNotes(value);
    setValidationResult(result);
    onValidationChange?.(result);
  }, [value, onValidationChange]);

  useEffect(() => {
    if (touched) {
      const timer = setTimeout(validateNotes, 300);
      return () => clearTimeout(timer);
    }
  }, [value, touched, validateNotes]);

  const handleBlur = () => {
    setTouched(true);
    validateNotes();
  };

  const handleReset = () => {
    onChange('');
    setValidationResult(null);
    setTouched(false);
  };

  const handleExampleClick = (example: string) => {
    onChange(example);
    setTouched(true);
  };

  const hasErrors = validationResult && validationResult.blockedReasons.length > 0;
  const hasWarnings = validationResult && validationResult.warnings.length > 0;
  const characterCount = value.length;
  const isOverLimit = characterCount > MAX_NOTES_LENGTH;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Textarea with validation styling */}
      <div className="relative">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "min-h-[100px] pr-16 resize-none transition-colors",
            hasErrors && "border-destructive focus-visible:ring-destructive",
            hasWarnings && !hasErrors && "border-yellow-500 focus-visible:ring-yellow-500",
            isOverLimit && "border-destructive"
          )}
        />
        
        {/* Character counter */}
        <div 
          className={cn(
            "absolute bottom-2 right-2 text-xs",
            isOverLimit ? "text-destructive font-medium" : "text-muted-foreground"
          )}
        >
          {characterCount}/{MAX_NOTES_LENGTH}
        </div>
      </div>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Optional: Specify topics, style, difficulty, or question types. Do not include personal data.
      </p>

      {/* Validation messages */}
      {hasErrors && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            {validationResult.blockedReasons.map((reason, i) => (
              <p key={i} className="text-sm text-destructive">{reason}</p>
            ))}
          </div>
        </div>
      )}

      {hasWarnings && !hasErrors && (
        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            {validationResult.warnings.map((warning, i) => (
              <p key={i} className="text-sm text-yellow-700 dark:text-yellow-400">{warning}</p>
            ))}
          </div>
        </div>
      )}

      {/* Valid indicator */}
      {touched && validationResult?.isValid && value.trim() && !hasWarnings && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>Notes look good</span>
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2">
        {/* Examples dropdown */}
        <Collapsible open={showExamples} onOpenChange={setShowExamples}>
          <CollapsibleTrigger asChild>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm"
              className="text-xs gap-1 h-7 px-2"
            >
              <Lightbulb className="h-3 w-3" />
              Examples
              <ChevronDown className={cn(
                "h-3 w-3 transition-transform",
                showExamples && "rotate-180"
              )} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="flex flex-wrap gap-1.5">
              {NOTES_EXAMPLES.map((example, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="cursor-pointer hover:bg-accent text-xs font-normal py-1"
                  onClick={() => handleExampleClick(example)}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Reset button */}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs gap-1 h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
