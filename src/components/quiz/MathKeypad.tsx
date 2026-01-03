import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ChevronLeft, 
  ChevronRight, 
  Delete, 
  Space, 
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  X
} from 'lucide-react';

interface MathKeypadProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLatex: (latex: string) => void;
  onExecuteCommand: (command: string) => void;
  subjectColor?: string;
}

// Symbol definitions organized by category
const SYMBOL_CATEGORIES = {
  basic: {
    label: 'Basic',
    symbols: [
      { label: '+', latex: '+' },
      { label: '−', latex: '-' },
      { label: '×', latex: '\\times ' },
      { label: '÷', latex: '\\div ' },
      { label: '=', latex: '=' },
      { label: '≠', latex: '\\neq ' },
      { label: '<', latex: '<' },
      { label: '>', latex: '>' },
      { label: '≤', latex: '\\leq ' },
      { label: '≥', latex: '\\geq ' },
      { label: '±', latex: '\\pm ' },
      { label: '(', latex: '(' },
      { label: ')', latex: ')' },
      { label: '[', latex: '[' },
      { label: ']', latex: ']' },
      { label: ',', latex: ',' },
    ],
  },
  algebra: {
    label: 'Algebra',
    symbols: [
      { label: 'x²', latex: '^2' },
      { label: 'xⁿ', latex: '^{#0}', placeholder: true },
      { label: '√', latex: '\\sqrt{#0}', placeholder: true },
      { label: 'ⁿ√', latex: '\\sqrt[#0]{#0}', placeholder: true },
      { label: 'a/b', latex: '\\frac{#0}{#0}', placeholder: true },
      { label: 'xₙ', latex: '_{#0}', placeholder: true },
      { label: '|x|', latex: '\\left|#0\\right|', placeholder: true },
      { label: '∞', latex: '\\infty ' },
      { label: '≈', latex: '\\approx ' },
      { label: '∝', latex: '\\propto ' },
      { label: '→', latex: '\\to ' },
      { label: '⇒', latex: '\\Rightarrow ' },
    ],
  },
  greek: {
    label: 'Greek',
    symbols: [
      { label: 'π', latex: '\\pi ' },
      { label: 'θ', latex: '\\theta ' },
      { label: 'α', latex: '\\alpha ' },
      { label: 'β', latex: '\\beta ' },
      { label: 'γ', latex: '\\gamma ' },
      { label: 'δ', latex: '\\delta ' },
      { label: 'ε', latex: '\\epsilon ' },
      { label: 'λ', latex: '\\lambda ' },
      { label: 'μ', latex: '\\mu ' },
      { label: 'σ', latex: '\\sigma ' },
      { label: 'ω', latex: '\\omega ' },
      { label: 'Δ', latex: '\\Delta ' },
    ],
  },
  functions: {
    label: 'Functions',
    symbols: [
      { label: 'sin', latex: '\\sin(' },
      { label: 'cos', latex: '\\cos(' },
      { label: 'tan', latex: '\\tan(' },
      { label: 'sin⁻¹', latex: '\\arcsin(' },
      { label: 'cos⁻¹', latex: '\\arccos(' },
      { label: 'tan⁻¹', latex: '\\arctan(' },
      { label: 'log', latex: '\\log(' },
      { label: 'ln', latex: '\\ln(' },
      { label: 'log₁₀', latex: '\\log_{10}(' },
      { label: 'eˣ', latex: 'e^{#0}', placeholder: true },
      { label: '10ˣ', latex: '10^{#0}', placeholder: true },
      { label: 'n!', latex: '!' },
    ],
  },
  calculus: {
    label: 'Calculus',
    symbols: [
      { label: '∫', latex: '\\int ' },
      { label: '∫ₐᵇ', latex: '\\int_{#0}^{#0}', placeholder: true },
      { label: 'd/dx', latex: '\\frac{d}{dx}' },
      { label: '∂', latex: '\\partial ' },
      { label: 'Σ', latex: '\\sum ' },
      { label: 'Σₙ', latex: '\\sum_{n=#0}^{#0}', placeholder: true },
      { label: 'lim', latex: '\\lim_{x\\to #0}', placeholder: true },
      { label: '∏', latex: '\\prod ' },
      { label: '∇', latex: '\\nabla ' },
      { label: '∆', latex: '\\Delta ' },
      { label: 'dx', latex: '\\,dx' },
      { label: 'dy', latex: '\\,dy' },
    ],
  },
};

export function MathKeypad({ 
  isOpen, 
  onClose, 
  onInsertLatex, 
  onExecuteCommand,
  subjectColor = '#3B82F6' 
}: MathKeypadProps) {
  const [activeTab, setActiveTab] = useState('basic');

  const handleSymbolClick = useCallback((latex: string, hasPlaceholder?: boolean) => {
    onInsertLatex(latex);
  }, [onInsertLatex]);

  const handleNavigationClick = useCallback((command: string) => {
    onExecuteCommand(command);
  }, [onExecuteCommand]);

  if (!isOpen) return null;

  return (
    <Card className="math-keypad border-t-2 rounded-t-xl shadow-lg bg-card animate-in slide-in-from-bottom-4 duration-300">
      {/* Header with close button */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Math Keyboard</span>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-center gap-1 px-4 py-2 border-b bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('moveToPreviousChar')}
          className="h-9 w-9 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('moveToNextChar')}
          className="h-9 w-9 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('moveUp')}
          className="h-9 w-9 p-0"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('moveDown')}
          className="h-9 w-9 p-0"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSymbolClick('\\ ')}
          className="h-9 px-3 gap-1"
        >
          <Space className="h-4 w-4" />
          <span className="text-xs">Space</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('deleteBackward')}
          className="h-9 px-3 gap-1"
        >
          <Delete className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleNavigationClick('commit')}
          className="h-9 px-3 gap-1"
          style={{ 
            backgroundColor: `${subjectColor}15`,
            borderColor: subjectColor,
            color: subjectColor
          }}
        >
          <CornerDownLeft className="h-4 w-4" />
          <span className="text-xs">Done</span>
        </Button>
      </div>

      {/* Symbol tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent h-10 px-2">
          {Object.entries(SYMBOL_CATEGORIES).map(([key, category]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="text-xs px-3 py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-md"
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(SYMBOL_CATEGORIES).map(([key, category]) => (
          <TabsContent key={key} value={key} className="p-3 m-0">
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5">
              {category.symbols.map((symbol, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSymbolClick(symbol.latex, symbol.placeholder)}
                  className="h-10 min-w-[42px] text-base font-normal hover:bg-primary/10 hover:border-primary/50 transition-colors"
                >
                  {symbol.label}
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Number row (always visible) */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-3 border-t bg-muted/20">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '.', 'x', 'y', 'n'].map((num) => (
          <Button
            key={num}
            variant="secondary"
            size="sm"
            onClick={() => handleSymbolClick(num)}
            className="h-10 w-10 text-base font-medium"
          >
            {num}
          </Button>
        ))}
      </div>
    </Card>
  );
}
