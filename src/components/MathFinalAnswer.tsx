import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { addStyles, EditableMathField, MathFieldConfig } from 'react-mathquill';

// Add MathQuill styles once
addStyles();

interface MathFinalAnswerProps {
  value: string; // LaTeX string
  onChange: (latex: string) => void; // Debounced onChange
  onBlur?: () => void; // Immediate save on blur
  placeholder?: string;
  className?: string;
}

export interface MathFinalAnswerRef {
  insertLatex: (latex: string) => void;
  focus: () => void;
}

export const MathFinalAnswer = forwardRef<MathFinalAnswerRef, MathFinalAnswerProps>(
  (
    {
      value,
      onChange,
      onBlur,
      placeholder = 'Enter your final answer...',
      className = '',
    },
    ref
  ) => {
    const mathFieldRef = useRef<any>(null);
    const isInternalUpdateRef = useRef(false);

    const config: MathFieldConfig = {
      spaceBehavesLikeTab: true,
      leftRightIntoCmdGoes: 'up',
      restrictMismatchedBrackets: true,
      sumStartsWithNEquals: true,
      supSubsRequireOperand: true,
      charsThatBreakOutOfSupSub: '+-=<>',
      autoSubscriptNumerals: true,
      handlers: {
        edit: (mathField) => {
          if (isInternalUpdateRef.current) {
            return;
          }
          if (mathField && mathField.latex) {
            const latexValue = mathField.latex();
            onChange(latexValue);
          }
        },
      },
    };

    // Sync external value changes to MathQuill
    useEffect(() => {
      if (mathFieldRef.current && typeof mathFieldRef.current.latex === 'function') {
        const current = mathFieldRef.current.latex();
        const newValue = value ?? '';
        
        // Only update if values differ
        if (newValue !== current) {
          isInternalUpdateRef.current = true;
          mathFieldRef.current.latex(newValue);
          isInternalUpdateRef.current = false;
        }
      }
    }, [value]);

    const handleBlur = useCallback(() => {
      if (onBlur) {
        onBlur();
      }
    }, [onBlur]);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      insertLatex: (latex: string) => {
        if (mathFieldRef.current) {
          mathFieldRef.current.write(latex);
          mathFieldRef.current.focus();
        }
      },
      focus: () => {
        if (mathFieldRef.current) {
          mathFieldRef.current.focus();
        }
      },
    }));

    return (
      <div className={`math-final-answer ${className}`}>
        <EditableMathField
          latex={value}
          config={config}
          mathquillDidMount={(mathField) => {
            mathFieldRef.current = mathField;
            if (mathField && typeof mathField.latex === 'function') {
              mathField.latex(value || '');
            }
          }}
          onBlur={handleBlur}
        />
        {!value && (
          <div className="math-placeholder">{placeholder}</div>
        )}
      </div>
    );
  }
);

MathFinalAnswer.displayName = 'MathFinalAnswer';
