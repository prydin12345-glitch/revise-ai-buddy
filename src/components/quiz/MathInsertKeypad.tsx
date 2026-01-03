import { useCallback } from "react";
import { X, Space, Delete, ArrowLeft, ArrowRight, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MathInsertKeypadProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (text: string) => void;
  onNavigate?: (direction: 'left' | 'right') => void;
  onDelete?: () => void;
  subjectColor?: string;
}

// Unicode math symbols organized by category
const SYMBOL_CATEGORIES = {
  superscripts: {
    label: "Powers",
    symbols: [
      { label: "x²", value: "²" },
      { label: "x³", value: "³" },
      { label: "x⁴", value: "⁴" },
      { label: "x⁵", value: "⁵" },
      { label: "x⁶", value: "⁶" },
      { label: "x⁷", value: "⁷" },
      { label: "x⁸", value: "⁸" },
      { label: "x⁹", value: "⁹" },
      { label: "x⁰", value: "⁰" },
      { label: "x¹", value: "¹" },
      { label: "xⁿ", value: "^()" },
      { label: "x⁻¹", value: "⁻¹" },
    ]
  },
  operators: {
    label: "Operators",
    symbols: [
      { label: "×", value: "×" },
      { label: "÷", value: "÷" },
      { label: "±", value: "±" },
      { label: "−", value: "−" },
      { label: "+", value: "+" },
      { label: "=", value: "=" },
      { label: "≠", value: "≠" },
      { label: "≤", value: "≤" },
      { label: "≥", value: "≥" },
      { label: "<", value: "<" },
      { label: ">", value: ">" },
      { label: "≈", value: "≈" },
    ]
  },
  symbols: {
    label: "Symbols",
    symbols: [
      { label: "√", value: "√" },
      { label: "∛", value: "∛" },
      { label: "∜", value: "∜" },
      { label: "π", value: "π" },
      { label: "θ", value: "θ" },
      { label: "∞", value: "∞" },
      { label: "°", value: "°" },
      { label: "′", value: "′" },
      { label: "″", value: "″" },
      { label: "∠", value: "∠" },
      { label: "△", value: "△" },
      { label: "∴", value: "∴" },
    ]
  },
  fractions: {
    label: "Fractions",
    symbols: [
      { label: "½", value: "½" },
      { label: "⅓", value: "⅓" },
      { label: "⅔", value: "⅔" },
      { label: "¼", value: "¼" },
      { label: "¾", value: "¾" },
      { label: "⅕", value: "⅕" },
      { label: "⅖", value: "⅖" },
      { label: "⅗", value: "⅗" },
      { label: "⅘", value: "⅘" },
      { label: "⅙", value: "⅙" },
      { label: "⅚", value: "⅚" },
      { label: "⅛", value: "⅛" },
      { label: "⅜", value: "⅜" },
      { label: "⅝", value: "⅝" },
      { label: "⅞", value: "⅞" },
      { label: "a/b", value: "/" },
    ]
  },
  brackets: {
    label: "Brackets",
    symbols: [
      { label: "(", value: "(" },
      { label: ")", value: ")" },
      { label: "[", value: "[" },
      { label: "]", value: "]" },
      { label: "{", value: "{" },
      { label: "}", value: "}" },
      { label: "|", value: "|" },
    ]
  },
  greek: {
    label: "Greek",
    symbols: [
      { label: "α", value: "α" },
      { label: "β", value: "β" },
      { label: "γ", value: "γ" },
      { label: "δ", value: "δ" },
      { label: "ε", value: "ε" },
      { label: "λ", value: "λ" },
      { label: "μ", value: "μ" },
      { label: "σ", value: "σ" },
      { label: "φ", value: "φ" },
      { label: "ω", value: "ω" },
      { label: "Δ", value: "Δ" },
      { label: "Σ", value: "Σ" },
    ]
  },
};

export function MathInsertKeypad({ 
  isOpen, 
  onClose, 
  onInsert, 
  onNavigate, 
  onDelete,
  subjectColor = "#3B82F6" 
}: MathInsertKeypadProps) {
  if (!isOpen) return null;

  const handleSymbolClick = useCallback((value: string) => {
    onInsert(value);
  }, [onInsert]);

  return (
    <Card className="w-full mt-3 p-3 shadow-lg border-2 border-border bg-card animate-in slide-in-from-bottom-2 duration-200">
      {/* Header with navigation controls */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div className="flex items-center gap-1">
          {/* Navigation buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('left')}
            className="h-8 w-8 p-0"
            title="Move cursor left"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate?.('right')}
            className="h-8 w-8 p-0"
            title="Move cursor right"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onInsert(" ")}
            className="h-8 px-3"
            title="Insert space"
          >
            <Space className="h-4 w-4 mr-1" />
            Space
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete?.()}
            className="h-8 w-8 p-0"
            title="Delete"
          >
            <Delete className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onInsert("\n")}
            className="h-8 w-8 p-0"
            title="New line"
          >
            <CornerDownLeft className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="superscripts" className="w-full">
        <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-muted/50 p-1 mb-2">
          {Object.entries(SYMBOL_CATEGORIES).map(([key, category]) => (
            <TabsTrigger 
              key={key} 
              value={key}
              className="text-xs px-2 py-1 data-[state=active]:bg-background"
              style={{ 
                '--active-color': subjectColor 
              } as React.CSSProperties}
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(SYMBOL_CATEGORIES).map(([key, category]) => (
          <TabsContent key={key} value={key} className="mt-0">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
              {category.symbols.map((symbol, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  onClick={() => handleSymbolClick(symbol.value)}
                  className="h-10 text-lg font-medium hover:bg-accent active:scale-95 transition-transform"
                  title={`Insert ${symbol.label}`}
                >
                  {symbol.label}
                </Button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Tap a symbol to insert it at your cursor position
      </p>
    </Card>
  );
}

// Utility function to normalize Unicode math for AI grading
export function normalizeUnicodeForGrading(text: string): string {
  if (!text) return '';
  
  let normalized = text;
  
  // Superscripts to caret notation
  const superscriptMap: Record<string, string> = {
    '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
    '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
    '⁻': '^-', '⁺': '^+', 'ⁿ': '^n',
  };
  
  // Replace consecutive superscripts as a group (e.g., x²³ → x^23)
  let result = '';
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (superscriptMap[char]) {
      // Start of superscript sequence
      let superscriptDigits = '';
      while (i < normalized.length && superscriptMap[normalized[i]]) {
        superscriptDigits += superscriptMap[normalized[i]].replace('^', '');
        i++;
      }
      result += '^' + superscriptDigits;
    } else {
      result += char;
      i++;
    }
  }
  normalized = result;
  
  // Operators
  normalized = normalized.replace(/×/g, '*');
  normalized = normalized.replace(/÷/g, '/');
  normalized = normalized.replace(/−/g, '-');
  normalized = normalized.replace(/±/g, '+-');
  
  // Symbols
  normalized = normalized.replace(/√/g, 'sqrt');
  normalized = normalized.replace(/∛/g, 'cbrt');
  normalized = normalized.replace(/∜/g, '4thrt');
  normalized = normalized.replace(/π/g, 'pi');
  normalized = normalized.replace(/θ/g, 'theta');
  normalized = normalized.replace(/∞/g, 'infinity');
  normalized = normalized.replace(/°/g, ' degrees');
  normalized = normalized.replace(/′/g, "'"); // prime → apostrophe
  normalized = normalized.replace(/″/g, "''"); // double prime
  normalized = normalized.replace(/∠/g, 'angle ');
  normalized = normalized.replace(/△/g, 'triangle ');
  normalized = normalized.replace(/∴/g, 'therefore ');
  
  // Fractions
  normalized = normalized.replace(/½/g, '1/2');
  normalized = normalized.replace(/⅓/g, '1/3');
  normalized = normalized.replace(/⅔/g, '2/3');
  normalized = normalized.replace(/¼/g, '1/4');
  normalized = normalized.replace(/¾/g, '3/4');
  normalized = normalized.replace(/⅕/g, '1/5');
  normalized = normalized.replace(/⅖/g, '2/5');
  normalized = normalized.replace(/⅗/g, '3/5');
  normalized = normalized.replace(/⅘/g, '4/5');
  normalized = normalized.replace(/⅙/g, '1/6');
  normalized = normalized.replace(/⅚/g, '5/6');
  normalized = normalized.replace(/⅛/g, '1/8');
  normalized = normalized.replace(/⅜/g, '3/8');
  normalized = normalized.replace(/⅝/g, '5/8');
  normalized = normalized.replace(/⅞/g, '7/8');
  
  // Comparison operators
  normalized = normalized.replace(/≤/g, '<=');
  normalized = normalized.replace(/≥/g, '>=');
  normalized = normalized.replace(/≠/g, '!=');
  normalized = normalized.replace(/≈/g, '~=');
  
  // Greek letters
  normalized = normalized.replace(/α/g, 'alpha');
  normalized = normalized.replace(/β/g, 'beta');
  normalized = normalized.replace(/γ/g, 'gamma');
  normalized = normalized.replace(/δ/g, 'delta');
  normalized = normalized.replace(/ε/g, 'epsilon');
  normalized = normalized.replace(/λ/g, 'lambda');
  normalized = normalized.replace(/μ/g, 'mu');
  normalized = normalized.replace(/σ/g, 'sigma');
  normalized = normalized.replace(/φ/g, 'phi');
  normalized = normalized.replace(/ω/g, 'omega');
  normalized = normalized.replace(/Δ/g, 'Delta');
  normalized = normalized.replace(/Σ/g, 'Sum');
  
  return normalized;
}
