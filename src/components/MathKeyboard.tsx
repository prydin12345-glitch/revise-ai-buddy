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
    { label: 'x²', value: '^2' },
    { label: 'x³', value: '^3' },
    { label: 'xⁿ', value: '^n' },
    { label: '⁰', value: '⁰' },
    { label: '¹', value: '¹' },
    { label: '²', value: '²' },
    { label: '³', value: '³' },
    { label: '₀', value: '₀' },
    { label: '₁', value: '₁' },
    { label: '₂', value: '₂' },
    { label: '₃', value: '₃' },
    { label: '√', value: '√' },
    { label: '∛', value: '∛' },
    { label: '∜', value: '∜' },
    { label: '½', value: '½' },
    { label: '⅓', value: '⅓' },
    { label: '¼', value: '¼' },
    { label: '⅔', value: '⅔' },
    { label: '¾', value: '¾' },
    { label: 'π', value: 'π' },
    { label: 'e', value: 'e' },
    { label: '∞', value: '∞' },
    { label: '°', value: '°' },
    { label: '±', value: '±' },
  ],
  operators: [
    { label: '×', value: '×' },
    { label: '÷', value: '÷' },
    { label: '≠', value: '≠' },
    { label: '≈', value: '≈' },
    { label: '≤', value: '≤' },
    { label: '≥', value: '≥' },
    { label: '<', value: '<' },
    { label: '>', value: '>' },
    { label: '∝', value: '∝' },
    { label: '∴', value: '∴' },
    { label: '∵', value: '∵' },
    { label: '⊥', value: '⊥' },
    { label: '∥', value: '∥' },
    { label: '∠', value: '∠' },
    { label: '△', value: '△' },
    { label: '∈', value: '∈' },
  ],
  greek: [
    { label: 'α', value: 'α' },
    { label: 'β', value: 'β' },
    { label: 'γ', value: 'γ' },
    { label: 'δ', value: 'δ' },
    { label: 'ε', value: 'ε' },
    { label: 'θ', value: 'θ' },
    { label: 'λ', value: 'λ' },
    { label: 'μ', value: 'μ' },
    { label: 'σ', value: 'σ' },
    { label: 'φ', value: 'φ' },
    { label: 'ω', value: 'ω' },
    { label: 'Δ', value: 'Δ' },
    { label: 'Σ', value: 'Σ' },
    { label: 'Φ', value: 'Φ' },
    { label: 'Ω', value: 'Ω' },
    { label: 'Π', value: 'Π' },
  ],
  calculus: [
    { label: '∫', value: '∫' },
    { label: '∂', value: '∂' },
    { label: '∇', value: '∇' },
    { label: 'lim', value: 'lim' },
    { label: 'd/dx', value: 'd/dx' },
    { label: 'Σ', value: 'Σ' },
    { label: '∏', value: '∏' },
    { label: '∪', value: '∪' },
    { label: '∩', value: '∩' },
    { label: '⊂', value: '⊂' },
    { label: '⊃', value: '⊃' },
    { label: '∅', value: '∅' },
  ],
  functions: [
    { label: 'sin', value: 'sin' },
    { label: 'cos', value: 'cos' },
    { label: 'tan', value: 'tan' },
    { label: 'log', value: 'log' },
    { label: 'ln', value: 'ln' },
    { label: 'exp', value: 'exp' },
    { label: 'abs', value: 'abs' },
    { label: 'sqrt', value: 'sqrt' },
  ],
  brackets: [
    { label: '( )', value: '()' },
    { label: '[ ]', value: '[]' },
    { label: '{ }', value: '{}' },
    { label: '⟨ ⟩', value: '⟨⟩' },
    { label: '| |', value: '||' },
    { label: '⌊ ⌋', value: '⌊⌋' },
    { label: '⌈ ⌉', value: '⌈⌉' },
  ],
  builders: [
    { label: 'x/y', value: '__FRACTION__' },
    { label: 'logₐ(x)', value: '__LOG_BASE__' },
    { label: 'xⁿ', value: '__POWER__' },
    { label: 'ⁿ√x', value: '__SQRT__' },
  ],
};

export function MathKeyboard({ isOpen, onInsertSymbol, onClose }: MathKeyboardProps) {
  if (!isOpen) return null;

  return (
    <Card className="w-full mt-4 p-4 shadow-lg border-2 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Math Keyboard</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-7 mb-4">
          <TabsTrigger value="basic" className="text-xs">Basic</TabsTrigger>
          <TabsTrigger value="operators" className="text-xs">Operators</TabsTrigger>
          <TabsTrigger value="greek" className="text-xs">Greek</TabsTrigger>
          <TabsTrigger value="calculus" className="text-xs">Calculus</TabsTrigger>
          <TabsTrigger value="functions" className="text-xs">Functions</TabsTrigger>
          <TabsTrigger value="brackets" className="text-xs">Brackets</TabsTrigger>
          <TabsTrigger value="builders" className="text-xs">Builders</TabsTrigger>
        </TabsList>

        {Object.entries(mathSymbols).map(([category, symbols]) => (
          <TabsContent key={category} value={category} className="mt-0">
            <div className="grid grid-cols-8 gap-2">
              {symbols.map((symbol, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  onClick={() => onInsertSymbol(symbol.value)}
                  className="h-10 text-base font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
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
        Click any symbol to insert it at your cursor position
      </p>
    </Card>
  );
}
