import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  latex?: string | null;
  hasMath?: boolean;
  className?: string;
}

export function MathRenderer({ content, latex, hasMath, className = "" }: MathRendererProps) {
  // If LaTeX is explicitly provided, render it as block math
  if (latex) {
    return (
      <div className={className}>
        <BlockMath math={latex} />
      </div>
    );
  }

  // If hasMath flag is set but no LaTeX, try to detect inline math patterns
  if (hasMath) {
    // Split content by inline math delimiters (e.g., $...$)
    const parts = content.split(/(\$[^$]+\$)/g);
    
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        {parts.map((part, i) => {
          if (part.startsWith('$') && part.endsWith('$')) {
            const mathContent = part.slice(1, -1);
            return <InlineMath key={i} math={mathContent} />;
          }
          // Split by newlines to preserve paragraph structure
          return part.split('\n').map((line, j) => (
            line.trim() ? <p key={`${i}-${j}`}>{line}</p> : <br key={`${i}-${j}`} />
          ));
        })}
      </div>
    );
  }

  // No math detected - render as regular text
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {content.split('\n').map((line, i) => (
        line.trim() ? <p key={i}>{line}</p> : <br key={i} />
      ))}
    </div>
  );
}
