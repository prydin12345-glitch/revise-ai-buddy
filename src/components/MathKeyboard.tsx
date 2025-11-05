import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MathKeyboardProps {
  isOpen: boolean;
  onInsertSymbol: (symbol: string) => void;
  onClose: () => void;
}

const mathSymbols = {
  basic: [
    { label: 'x²', value: 'x^{2}' },
    { label: 'x³', value: 'x^{3}' },
    { label: 'xⁿ', value: 'x^{□}' },
    { label: 'x₂', value: 'x_{□}' },
    { label: '√', value: '\\sqrt{□}' },
    { label: '∛', value: '\\sqrt[3]{□}' },
    { label: 'ⁿ√', value: '\\sqrt[□]{□}' },
    { label: '½', value: '\\frac{1}{2}' },
    { label: '⅓', value: '\\frac{1}{3}' },
    { label: '¼', value: '\\frac{1}{4}' },
    { label: '⅔', value: '\\frac{2}{3}' },
    { label: '¾', value: '\\frac{3}{4}' },
    { label: 'π', value: '\\pi' },
    { label: 'e', value: 'e' },
    { label: '∞', value: '\\infty' },
    { label: '°', value: '°' },
    { label: '±', value: '\\pm' },
  ],
  operators: [
    { label: '×', value: '\\times' },
    { label: '÷', value: '\\div' },
    { label: '≠', value: '\\neq' },
    { label: '≈', value: '\\approx' },
    { label: '≤', value: '\\leq' },
    { label: '≥', value: '\\geq' },
    { label: '<', value: '<' },
    { label: '>', value: '>' },
    { label: '∝', value: '\\propto' },
    { label: '∴', value: '\\therefore' },
    { label: '∵', value: '\\because' },
    { label: '⊥', value: '\\perp' },
    { label: '∥', value: '\\parallel' },
    { label: '∠', value: '\\angle' },
    { label: '△', value: '\\triangle' },
    { label: '∈', value: '\\in' },
  ],
  greek: [
    { label: 'α', value: '\\alpha' },
    { label: 'β', value: '\\beta' },
    { label: 'γ', value: '\\gamma' },
    { label: 'δ', value: '\\delta' },
    { label: 'ε', value: '\\epsilon' },
    { label: 'θ', value: '\\theta' },
    { label: 'λ', value: '\\lambda' },
    { label: 'μ', value: '\\mu' },
    { label: 'σ', value: '\\sigma' },
    { label: 'φ', value: '\\phi' },
    { label: 'ω', value: '\\omega' },
    { label: 'Δ', value: '\\Delta' },
    { label: 'Σ', value: '\\Sigma' },
    { label: 'Φ', value: '\\Phi' },
    { label: 'Ω', value: '\\Omega' },
    { label: 'Π', value: '\\Pi' },
  ],
  calculus: [
    { label: '∫', value: '\\int_{□}^{□} □ \\, dx' },
    { label: '∂', value: '\\partial' },
    { label: '∇', value: '\\nabla' },
    { label: 'lim', value: '\\lim_{□ \\to □}' },
    { label: 'd/dx', value: '\\frac{d}{dx}[□]' },
    { label: 'Σ', value: '\\sum_{□}^{□} □' },
    { label: '∏', value: '\\prod_{□}^{□} □' },
    { label: '∪', value: '\\cup' },
    { label: '∩', value: '\\cap' },
    { label: '⊂', value: '\\subset' },
    { label: '⊃', value: '\\supset' },
    { label: '∅', value: '\\emptyset' },
  ],
  functions: [
    { label: 'sin(□)', value: '\\sin(□)' },
    { label: 'cos(□)', value: '\\cos(□)' },
    { label: 'tan(□)', value: '\\tan(□)' },
    { label: 'log(□)', value: '\\log(□)' },
    { label: 'ln(□)', value: '\\ln(□)' },
    { label: 'exp(□)', value: '\\exp(□)' },
    { label: '|□|', value: '|□|' },
    { label: '√(□)', value: '\\sqrt{□}' },
  ],
  brackets: [
    { label: '(□)', value: '(□)' },
    { label: '[□]', value: '[□]' },
    { label: '{□}', value: '\\{□\\}' },
    { label: '⟨□⟩', value: '\\langle □ \\rangle' },
    { label: '|□|', value: '|□|' },
    { label: '⌊□⌋', value: '\\lfloor □ \\rfloor' },
    { label: '⌈□⌉', value: '\\lceil □ \\rceil' },
  ],
  builders: [
    { label: '□/□', value: '\\frac{□}{□}' },
    { label: 'x^□', value: 'x^{□}' },
    { label: '√(□)', value: '\\sqrt{□}' },
    { label: 'ⁿ√(□)', value: '\\sqrt[□]{□}' },
    { label: 'log□(□)', value: '\\log_{□}(□)' },
    { label: 'Σ□', value: '\\sum_{□}^{□} □' },
    { label: '∫□', value: '\\int_{□}^{□} □ \\, dx' },
    { label: 'lim', value: '\\lim_{□ \\to □} □' },
    { label: '(□)', value: '(□)' },
    { label: '[□]', value: '[□]' },
  ],
};

export function MathKeyboard({ isOpen, onInsertSymbol, onClose }: MathKeyboardProps) {
  if (!isOpen) return null;

  return (
    <Card className="w-full mt-4 p-4 shadow-2xl border-2 border-slate-700 bg-slate-900 text-white animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">Math Keyboard</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-4 bg-slate-800 p-1">
          <TabsTrigger value="basic" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Basic</TabsTrigger>
          <TabsTrigger value="operators" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Operators</TabsTrigger>
          <TabsTrigger value="greek" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Greek</TabsTrigger>
          <TabsTrigger value="calculus" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Calculus</TabsTrigger>
          <TabsTrigger value="functions" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Functions</TabsTrigger>
          <TabsTrigger value="brackets" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Brackets</TabsTrigger>
          <TabsTrigger value="builders" className="text-xs data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400">Builders</TabsTrigger>
        </TabsList>

        {Object.entries(mathSymbols).map(([category, symbols]) => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="grid grid-cols-5 gap-2">
              {symbols.map((symbol, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  onClick={() => onInsertSymbol(symbol.value)}
                  className="h-12 text-base font-medium bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:border-slate-600 transition-all"
                  title={`Insert ${symbol.label}`}
                >
                  {symbol.label}
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Click any symbol to insert visual math template at cursor position
      </p>
    </Card>
  );
}
