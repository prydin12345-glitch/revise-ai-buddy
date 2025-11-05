import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { addStyles, EditableMathField, MathFieldConfig } from 'react-mathquill';

// Add MathQuill styles once
addStyles();

interface VisualMathInputProps {
  value: string; // LaTeX string
  onChange: (latex: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  resetKey?: string; // Optional key to force re-sync when question changes
}

export interface VisualMathInputRef {
  insertLatex: (latex: string) => void;
  focus: () => void;
}

export const VisualMathInput = forwardRef<VisualMathInputRef, VisualMathInputProps>(
  (
    {
      value,
      onChange,
      onFocus,
      onBlur,
      placeholder = 'Enter your answer...',
      className = '',
      disabled = false,
      resetKey,
    },
    ref
  ) => {
    const mathFieldRef = useRef<any>(null);

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
          if (disabled) return;
          if (mathField && mathField.latex) {
            const latexValue = mathField.latex();
            onChange(latexValue);
          }
        },
      },
    };

    // Sync prop value to MathQuill whenever it changes or resetKey changes
    useEffect(() => {
      if (mathFieldRef.current && typeof mathFieldRef.current.latex === 'function') {
        const current = mathFieldRef.current.latex();
        const newValue = value ?? '';
        if (newValue !== current) {
          mathFieldRef.current.latex(newValue);
          // Force cursor to end after setting value
          if (newValue) {
            mathFieldRef.current.moveToRightEnd();
          }
        }
      }
    }, [value, resetKey]);

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
      <div className={`visual-math-input ${className}`}>
        <EditableMathField
          latex={value}
          config={config}
          mathquillDidMount={(mathField) => {
            mathFieldRef.current = mathField;
            // Set initial latex explicitly
            if (mathField && typeof mathField.latex === 'function') {
              mathField.latex(value || '');
            }
          }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {!value && (
          <div className="math-placeholder">{placeholder}</div>
        )}
      </div>
    );
  }
);

VisualMathInput.displayName = 'VisualMathInput';
