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

    // Sync prop value to MathQuill whenever it changes
    useEffect(() => {
      if (mathFieldRef.current && typeof mathFieldRef.current.latex === 'function') {
        const current = mathFieldRef.current.latex();
        if ((value ?? '') !== current) {
          mathFieldRef.current.latex(value || '');
        }
      }
    }, [value]);

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
