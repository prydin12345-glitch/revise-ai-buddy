import { useEffect, useRef, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import 'mathlive';

// MathLive types
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        ref?: React.Ref<any>;
      }, HTMLElement>;
    }
  }
}

interface MathAnswerFieldProps {
  valueLatex: string;
  valuePlain?: string;
  mode: 'math' | 'text';
  onChange: (values: { valueLatex: string; valuePlain: string }) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  subjectColor?: string;
  questionId?: string; // For resetting when question changes
}

export interface MathAnswerFieldRef {
  insertLatex: (latex: string) => void;
  focus: () => void;
  executeCommand: (command: string) => void;
}

// Convert LaTeX to plain text for display/fallback
export function latexToPlainText(latex: string): string {
  if (!latex) return '';
  
  return latex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, 'sqrt($1)')
    .replace(/\\sqrt\[(\d+)\]\{([^}]*)\}/g, 'root[$1]($2)')
    .replace(/\^{([^}]*)}/g, '^($1)')
    .replace(/\^([a-zA-Z0-9])/g, '^$1')
    .replace(/_{([^}]*)}/g, '_($1)')
    .replace(/_([a-zA-Z0-9])/g, '_$1')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\infty/g, '∞')
    .replace(/\\pm/g, '±')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\left\[/g, '[')
    .replace(/\\right\]/g, ']')
    .replace(/\\left\{/g, '{')
    .replace(/\\right\}/g, '}')
    .replace(/\\ /g, ' ')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\!/g, '')
    .replace(/\{|\}/g, '')
    .replace(/\\\\/g, '')
    .trim();
}

export const MathAnswerField = forwardRef<MathAnswerFieldRef, MathAnswerFieldProps>(
  (
    {
      valueLatex,
      mode,
      onChange,
      onBlur,
      onFocus,
      disabled = false,
      placeholder = 'Enter your answer...',
      className = '',
      subjectColor = '#3B82F6',
      questionId,
    },
    ref
  ) => {
    const mathFieldRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const lastValueRef = useRef<string>(valueLatex);
    const isUpdatingRef = useRef(false);

    // Initialize MathLive field
    useEffect(() => {
      const mf = mathFieldRef.current;
      if (!mf) return;

      // Configure MathLive for smart typing and touch support
      mf.smartMode = true;
      mf.smartFence = true;
      mf.smartSuperscript = true;
      mf.removeExtraneousParentheses = true;
      mf.virtualKeyboardMode = 'manual'; // We control the keypad
      mf.keypressSound = null;
      mf.plonkSound = null;
      
      // Enhanced touch support
      mf.mathModeSpace = '\\:';
      
      // Keyboard shortcuts for common operations
      mf.inlineShortcuts = {
        ...mf.inlineShortcuts,
        'pi': '\\pi',
        'theta': '\\theta',
        'alpha': '\\alpha',
        'beta': '\\beta',
        'sqrt': '\\sqrt{#0}',
        'inf': '\\infty',
        'sum': '\\sum',
        'int': '\\int',
        'lim': '\\lim',
        'sin': '\\sin',
        'cos': '\\cos',
        'tan': '\\tan',
        'log': '\\log',
        'ln': '\\ln',
        '>=': '\\geq',
        '<=': '\\leq',
        '!=': '\\neq',
        '+-': '\\pm',
        'xx': '\\times',
        '...': '\\ldots',
      };

      // Handle input changes
      const handleInput = () => {
        if (isUpdatingRef.current) return;
        
        const newLatex = mf.value || '';
        if (newLatex !== lastValueRef.current) {
          lastValueRef.current = newLatex;
          const plainText = latexToPlainText(newLatex);
          onChange({ valueLatex: newLatex, valuePlain: plainText });
        }
      };

      mf.addEventListener('input', handleInput);
      
      return () => {
        mf.removeEventListener('input', handleInput);
      };
    }, [onChange]);

    // Sync value when it changes externally or question changes
    useEffect(() => {
      const mf = mathFieldRef.current;
      if (!mf) return;
      
      // Only update if value actually differs (prevents cursor jumping)
      const currentValue = mf.value || '';
      if (valueLatex !== currentValue) {
        isUpdatingRef.current = true;
        mf.value = valueLatex;
        lastValueRef.current = valueLatex;
        isUpdatingRef.current = false;
      }
    }, [valueLatex, questionId]);

    // Handle focus/blur
    const handleFocus = useCallback(() => {
      setIsFocused(true);
      onFocus?.();
    }, [onFocus]);

    const handleBlur = useCallback(() => {
      setIsFocused(false);
      onBlur?.();
    }, [onBlur]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      insertLatex: (latex: string) => {
        const mf = mathFieldRef.current;
        if (mf) {
          mf.executeCommand(['insert', latex]);
          mf.focus();
        }
      },
      focus: () => {
        const mf = mathFieldRef.current;
        if (mf) {
          mf.focus();
        }
      },
      executeCommand: (command: string) => {
        const mf = mathFieldRef.current;
        if (mf) {
          mf.executeCommand(command);
        }
      },
    }));

    return (
      <div 
        ref={containerRef}
        className={`math-answer-field-container ${className}`}
      >
        <div
          className={`
            relative rounded-lg border-2 transition-all duration-200 bg-background
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
          `}
          style={{
            borderColor: isFocused ? subjectColor : 'hsl(var(--border))',
            boxShadow: isFocused ? `0 0 0 3px ${subjectColor}20` : 'none',
          }}
          onClick={() => mathFieldRef.current?.focus()}
        >
          <math-field
            ref={mathFieldRef}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '16px',
              fontSize: '18px',
              fontFamily: 'inherit',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              caretColor: subjectColor,
              '--caret-color': subjectColor,
              '--selection-background-color': `${subjectColor}30`,
              '--placeholder-color': 'hsl(var(--muted-foreground))',
              '--highlight-inactive-background': `${subjectColor}15`,
              '--highlight-background': `${subjectColor}25`,
            } as React.CSSProperties}
          />
          
          {/* Placeholder when empty */}
          {!valueLatex && !isFocused && (
            <div 
              className="absolute inset-0 flex items-center px-4 pointer-events-none text-muted-foreground"
              style={{ paddingTop: '16px' }}
            >
              {placeholder}
            </div>
          )}
        </div>
        
        {/* Helper text */}
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-4">
          <span>Type naturally: x^2, sqrt, pi, 1/2 for fractions</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Use ↑↓←→ to navigate</span>
        </div>
      </div>
    );
  }
);

MathAnswerField.displayName = 'MathAnswerField';
