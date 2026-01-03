import { useRef, useEffect, useState, useCallback } from 'react';
import { addStyles, EditableMathField, MathFieldConfig } from 'react-mathquill';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Calculator } from 'lucide-react';
import '@/styles/mathquill-custom.css';

// Add MathQuill styles once
addStyles();

interface MathAnswerInputProps {
  value: string; // LaTeX string
  onChange: (latex: string, plainText: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  questionId: string; // Used as key for resetting
}

// Compact symbol keypad for GCSE math
const mathSymbols = {
  basic: [
    { label: 'x²', value: '^{2}' },
    { label: 'xⁿ', value: '^{}' },
    { label: '√', value: '\\sqrt{}' },
    { label: '∛', value: '\\sqrt[3]{}' },
    { label: 'π', value: '\\pi' },
    { label: '÷', value: '\\div' },
    { label: '×', value: '\\times' },
    { label: '±', value: '\\pm' },
    { label: '≠', value: '\\neq' },
    { label: '≈', value: '\\approx' },
    { label: '≤', value: '\\leq' },
    { label: '≥', value: '\\geq' },
    { label: '∞', value: '\\infty' },
    { label: '°', value: '^{\\circ}' },
    { label: 'a/b', value: '\\frac{}{}' },
  ],
  trig: [
    { label: 'sin', value: '\\sin()' },
    { label: 'cos', value: '\\cos()' },
    { label: 'tan', value: '\\tan()' },
    { label: 'sin⁻¹', value: '\\sin^{-1}()' },
    { label: 'cos⁻¹', value: '\\cos^{-1}()' },
    { label: 'tan⁻¹', value: '\\tan^{-1}()' },
    { label: 'θ', value: '\\theta' },
    { label: 'α', value: '\\alpha' },
    { label: 'β', value: '\\beta' },
    { label: 'γ', value: '\\gamma' },
  ],
  algebra: [
    { label: 'log', value: '\\log()' },
    { label: 'ln', value: '\\ln()' },
    { label: 'logₐ', value: '\\log_{}()' },
    { label: 'eˣ', value: 'e^{}' },
    { label: '|x|', value: '\\left|\\right|' },
    { label: 'x₁', value: '_{}' },
    { label: '()', value: '\\left(\\right)' },
    { label: '[]', value: '\\left[\\right]' },
    { label: '{}', value: '\\left\\{\\right\\}' },
    { label: '∴', value: '\\therefore' },
  ],
};

// Convert LaTeX to plain text for display/search
export function latexToPlainText(latex: string): string {
  if (!latex) return '';
  return latex
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\sqrt\[([^\]]*)\]\{([^}]*)\}/g, '$1√($2)')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\^{([^}]*)}/g, '^$1')
    .replace(/_{([^}]*)}/g, '_$1')
    .replace(/\\pi/g, 'π')
    .replace(/\\theta/g, 'θ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\infty/g, '∞')
    .replace(/\\circ/g, '°')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\log/g, 'log')
    .replace(/\\ln/g, 'ln')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\\therefore/g, '∴')
    .replace(/\\/g, '')
    .replace(/\{/g, '')
    .replace(/\}/g, '');
}

export function MathAnswerInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  placeholder = 'Enter your answer...',
  className = '',
  questionId,
}: MathAnswerInputProps) {
  const mathFieldRef = useRef<any>(null);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

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
        if (mathField && typeof mathField.latex === 'function') {
          const latexValue = mathField.latex();
          const plainText = latexToPlainText(latexValue);
          onChange(latexValue, plainText);
        }
      },
    },
  };

  // Sync prop value to MathQuill when question changes
  useEffect(() => {
    if (mathFieldRef.current && typeof mathFieldRef.current.latex === 'function') {
      const current = mathFieldRef.current.latex();
      const newValue = value ?? '';
      if (newValue !== current) {
        mathFieldRef.current.latex(newValue);
        if (newValue) {
          mathFieldRef.current.moveToRightEnd();
        }
      }
    }
  }, [value, questionId]);

  const insertSymbol = useCallback((symbolLatex: string) => {
    if (mathFieldRef.current && !disabled) {
      // Insert at cursor position
      mathFieldRef.current.write(symbolLatex);
      mathFieldRef.current.focus();
      
      // If the symbol has empty braces, move cursor into them
      if (symbolLatex.includes('{}')) {
        // Move left to get into the empty braces
        const emptySets = (symbolLatex.match(/\{\}/g) || []).length;
        for (let i = 0; i < emptySets; i++) {
          mathFieldRef.current.keystroke('Left');
        }
      }
    }
  }, [disabled]);

  const handleBlur = useCallback(() => {
    // Small delay to allow keyboard clicks to register
    setTimeout(() => {
      if (onBlur) {
        onBlur();
      }
    }, 100);
  }, [onBlur]);

  return (
    <div className={`math-answer-input-container ${className}`}>
      {/* Math Input Field */}
      <div className="math-final-answer relative">
        <EditableMathField
          latex={value || ''}
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
        
        {/* Toggle keyboard button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowKeyboard(!showKeyboard)}
          className="absolute bottom-2 right-2 h-8 gap-1.5 text-xs"
          disabled={disabled}
        >
          <Calculator className="w-3.5 h-3.5" />
          {showKeyboard ? 'Hide' : 'Math'}
        </Button>
      </div>

      {/* Collapsible Math Keyboard */}
      {showKeyboard && !disabled && (
        <Card className="mt-3 p-3 border-2 border-primary/20 bg-card shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Math Keyboard</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowKeyboard(false)}
              className="h-6 w-6"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 mb-2 h-8">
              <TabsTrigger value="basic" className="text-xs h-7">Basic</TabsTrigger>
              <TabsTrigger value="trig" className="text-xs h-7">Trig</TabsTrigger>
              <TabsTrigger value="algebra" className="text-xs h-7">Algebra</TabsTrigger>
            </TabsList>

            {Object.entries(mathSymbols).map(([category, symbols]) => (
              <TabsContent key={category} value={category} className="mt-0">
                <div className="grid grid-cols-5 gap-1.5">
                  {symbols.map((symbol, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => insertSymbol(symbol.value)}
                      className="h-9 text-sm font-medium hover:bg-primary/10 hover:border-primary/50"
                      title={`Insert ${symbol.label}`}
                    >
                      {symbol.label}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </Card>
      )}
    </div>
  );
}
