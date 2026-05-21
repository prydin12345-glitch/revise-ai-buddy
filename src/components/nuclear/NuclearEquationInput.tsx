import { useState } from 'react';
import type { NuclearTerm } from './nuclear-equation-detector';

interface NuclearEquationInputProps {
  terms: NuclearTerm[];
  onAnswerChange?: (answer: string) => void;
  disabled?: boolean;
  correctAnswer?: {
    massNumber: number;
    atomicNumber: number;
    symbol: string;
  };
  showCorrect?: boolean;
}

const NuclearSymbolDisplay = ({
  massNumber,
  atomicNumber,
  symbol,
}: { massNumber?: number | string; atomicNumber?: number | string; symbol?: string }) => (
  <span className="inline-grid grid-cols-[auto_auto] items-center mx-1 font-mono text-foreground"
        style={{ gridTemplateRows: 'auto auto' }}>
    <span className="text-xs leading-none text-right pr-0.5">{massNumber ?? ''}</span>
    <span className="row-span-2 text-2xl font-bold leading-none">{symbol ?? '?'}</span>
    <span className="text-xs leading-none text-right pr-0.5">{atomicNumber ?? ''}</span>
  </span>
);

const NuclearBlankInput = ({
  onChange,
  disabled,
  correctAnswer,
  showCorrect,
}: {
  onChange: (mass: string, atomic: string, symbol: string) => void;
  disabled?: boolean;
  correctAnswer?: { massNumber: number; atomicNumber: number; symbol: string };
  showCorrect?: boolean;
}) => {
  const [mass, setMass] = useState('');
  const [atomic, setAtomic] = useState('');
  const [symbol, setSymbol] = useState('');

  const isCorrect = !!(showCorrect && correctAnswer &&
    parseInt(mass) === correctAnswer.massNumber &&
    parseInt(atomic) === correctAnswer.atomicNumber &&
    symbol.trim().toLowerCase() === correctAnswer.symbol.toLowerCase());

  const borderColor = showCorrect
    ? (isCorrect ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)')
    : 'hsl(var(--border))';

  const inputBase: React.CSSProperties = {
    border: 'none',
    borderBottom: `2px solid ${borderColor}`,
    background: 'transparent',
    textAlign: 'center',
    fontFamily: 'inherit',
    color: 'hsl(var(--foreground))',
    outline: 'none',
    padding: '2px 4px',
  };

  return (
    <span className="inline-flex items-center mx-1 gap-1">
      <span className="inline-grid grid-cols-[auto_auto] items-center" style={{ gridTemplateRows: 'auto auto' }}>
        <input
          type="text"
          value={mass}
          onChange={(e) => { setMass(e.target.value); onChange(e.target.value, atomic, symbol); }}
          disabled={disabled}
          placeholder="A"
          maxLength={3}
          style={{ ...inputBase, width: 32, fontSize: 12 }}
        />
        <input
          type="text"
          value={symbol}
          onChange={(e) => { setSymbol(e.target.value); onChange(mass, atomic, e.target.value); }}
          disabled={disabled}
          placeholder="X"
          maxLength={3}
          style={{ ...inputBase, width: 48, fontSize: 22, fontWeight: 700, gridRow: 'span 2' }}
        />
        <input
          type="text"
          value={atomic}
          onChange={(e) => { setAtomic(e.target.value); onChange(mass, e.target.value, symbol); }}
          disabled={disabled}
          placeholder="Z"
          maxLength={3}
          style={{ ...inputBase, width: 32, fontSize: 12 }}
        />
      </span>
      {showCorrect && !isCorrect && correctAnswer && (
        <span className="ml-2 text-sm text-muted-foreground">
          ✓ <NuclearSymbolDisplay
            massNumber={correctAnswer.massNumber}
            atomicNumber={correctAnswer.atomicNumber}
            symbol={correctAnswer.symbol}
          />
        </span>
      )}
    </span>
  );
};

export const NuclearEquationInput = ({
  terms,
  onAnswerChange,
  disabled = false,
  correctAnswer,
  showCorrect = false,
}: NuclearEquationInputProps) => {
  const handleChange = (mass: string, atomic: string, symbol: string) => {
    onAnswerChange?.(`${mass}|${atomic}|${symbol}`);
  };

  return (
    <div className="my-4 p-4 rounded-lg border bg-card flex flex-wrap items-center gap-1 text-foreground">
      {terms.map((term, i) => {
        if (term.type === 'operator') {
          return <span key={i} className="mx-2 text-2xl font-semibold">{term.operator}</span>;
        }
        if (term.type === 'particle') {
          return <span key={i} className="mx-1 text-xl font-mono">{term.label}</span>;
        }
        if (term.type === 'nucleus' && term.nucleus?.isBlank) {
          return (
            <NuclearBlankInput
              key={i}
              onChange={handleChange}
              disabled={disabled}
              correctAnswer={correctAnswer}
              showCorrect={showCorrect}
            />
          );
        }
        if (term.type === 'nucleus' && term.nucleus) {
          return (
            <NuclearSymbolDisplay
              key={i}
              massNumber={term.nucleus.massNumber}
              atomicNumber={term.nucleus.atomicNumber}
              symbol={term.nucleus.symbol}
            />
          );
        }
        return null;
      })}
    </div>
  );
};

export default NuclearEquationInput;
