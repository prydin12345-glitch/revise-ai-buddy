import { useEffect, useRef } from 'react';
import 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

interface MathFieldProps {
  value: string;
  onChange: (latex: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export function MathField({ 
  value, 
  onChange, 
  onFocus, 
  onBlur,
  placeholder,
  className 
}: MathFieldProps) {
  const mfRef = useRef<any>(null);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    // Configure mathfield
    mf.mathVirtualKeyboardPolicy = 'manual';
    
    // Custom keyboard layout for students
    mf.setOptions({
      virtualKeyboardMode: 'manual',
      keypressSound: null,
      plonkSound: null,
      customVirtualKeyboardLayers: {
        'student-basic': {
          rows: [
            [
              { latex: '\\frac{#@}{#?}', label: 'x/y', class: 'small' },
              { latex: '#@^{#?}', label: 'x^n', class: 'small' },
              { latex: '\\sqrt{#0}', label: '√', class: 'small' },
              { latex: '\\pi', class: 'small' },
              { latex: '\\times', class: 'small' },
              { latex: '\\div', class: 'small' },
              { latex: '=', class: 'small' },
              { latex: '\\geq', class: 'small' },
              { latex: '\\leq', class: 'small' },
              { latex: '\\neq', class: 'small' },
            ],
            [
              { latex: '7', class: 'small' }, 
              { latex: '8', class: 'small' }, 
              { latex: '9', class: 'small' },
              { latex: '+', class: 'small' },
              { latex: '-', class: 'small' },
              { latex: '(', class: 'small' },
              { latex: ')', class: 'small' },
              { label: '[left]', command: ['performWithFeedback', 'moveToPreviousChar'], class: 'small' },
              { label: '[right]', command: ['performWithFeedback', 'moveToNextChar'], class: 'small' },
              { label: '[backspace]', command: ['performWithFeedback', 'deleteBackward'], class: 'small' },
            ],
            [
              { latex: '4', class: 'small' }, 
              { latex: '5', class: 'small' }, 
              { latex: '6', class: 'small' },
              { latex: 'x', class: 'small' },
              { latex: 'y', class: 'small' },
              { latex: 'n', class: 'small' },
              { latex: '\\log_{#?}(#0)', label: 'log', class: 'small' },
              { latex: '\\sin', class: 'small' },
              { latex: '\\cos', class: 'small' },
              { latex: '\\tan', class: 'small' },
            ],
            [
              { latex: '1', class: 'small' }, 
              { latex: '2', class: 'small' }, 
              { latex: '3', class: 'small' },
              { latex: '0', class: 'small' },
              { latex: '.', class: 'small' },
              { latex: '\\alpha', class: 'small' },
              { latex: '\\beta', class: 'small' },
              { latex: '\\theta', class: 'small' },
              { latex: '\\degree', label: '°', class: 'small' },
              { label: '[hide]', command: 'hideVirtualKeyboard', class: 'small' },
            ],
          ]
        },
      },
      virtualKeyboards: 'student-basic',
      inlineShortcuts: {
        half: '\\frac{1}{2}',
        quarter: '\\frac{1}{4}',
        third: '\\frac{1}{3}',
        degrees: '^{\\circ}',
        squared: '^{2}',
        cubed: '^{3}',
      }
    });

    // Set initial value
    if (value && mf.value !== value) {
      mf.value = value;
    }

    // Handle input changes
    const handleInput = (evt: any) => {
      onChange(evt.target.value);
    };

    mf.addEventListener('input', handleInput);

    return () => {
      mf.removeEventListener('input', handleInput);
    };
  }, [value, onChange]);

  return (
    <math-field
      ref={mfRef}
      onFocus={() => {
        if (onFocus) onFocus();
        if (window.mathVirtualKeyboard) {
          window.mathVirtualKeyboard.show();
        }
      }}
      onBlur={() => {
        if (onBlur) onBlur();
        if (window.mathVirtualKeyboard) {
          window.mathVirtualKeyboard.hide();
        }
      }}
      className={className}
      style={{
        display: 'block',
        minHeight: '60px',
        padding: '8px 12px',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        fontSize: '16px',
        fontFamily: 'inherit',
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      {value || ''}
    </math-field>
  );
}
