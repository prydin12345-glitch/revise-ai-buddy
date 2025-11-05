import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  latex?: string | null;
  hasMath?: boolean;
  className?: string;
}

export function MathRenderer({ content, latex, hasMath, className = "" }: MathRendererProps) {
  // Check if content contains HTML tables
  const hasHtmlTable = /<table[^>]*class="exam-table"[^>]*>/i.test(content);
  
  // Check if content contains math delimiters
  const hasInlineOrBlockMath = /\$\$[^$]+\$\$|\$[^$]+\$/g.test(content);
  
  // If content has HTML tables, render with safe HTML parsing
  if (hasHtmlTable) {
    // Split by table tags to separate tables from regular content
    const tableRegex = /(<table class="exam-table">[\s\S]*?<\/table>)/gi;
    const parts = content.split(tableRegex);
    
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        {parts.map((part, i) => {
          // Check if this part is a table
          if (part.match(tableRegex)) {
            return (
              <div 
                key={i} 
                className="my-4"
                dangerouslySetInnerHTML={{ __html: part }}
              />
            );
          }
          
          // For non-table parts, check for math expressions
          const mathParts = part.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
          return mathParts.map((mathPart, j) => {
            if (mathPart.startsWith('$$') && mathPart.endsWith('$$')) {
              const mathContent = mathPart.slice(2, -2);
              return (
                <div key={`${i}-${j}`} className="my-4">
                  <BlockMath math={mathContent} />
                </div>
              );
            }
            if (mathPart.startsWith('$') && mathPart.endsWith('$')) {
              const mathContent = mathPart.slice(1, -1);
              return <InlineMath key={`${i}-${j}`} math={mathContent} />;
            }
            // Regular text
            return mathPart.split('\n').map((line, k) => (
              line.trim() ? <span key={`${i}-${j}-${k}`}>{line}</span> : <br key={`${i}-${j}-${k}`} />
            ));
          });
        })}
      </div>
    );
  }
  
  // If content has math delimiters, parse and render them
  if (hasMath || hasInlineOrBlockMath) {
    // Split content by both block ($$...$$) and inline ($...$) math delimiters
    const parts = content.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
    
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        {parts.map((part, i) => {
          // Block math: $$...$$
          if (part.startsWith('$$') && part.endsWith('$$')) {
            const mathContent = part.slice(2, -2);
            return (
              <div key={i} className="my-4">
                <BlockMath math={mathContent} />
              </div>
            );
          }
          // Inline math: $...$
          if (part.startsWith('$') && part.endsWith('$')) {
            const mathContent = part.slice(1, -1);
            return <InlineMath key={i} math={mathContent} />;
          }
          // Regular text - preserve whitespace and structure
          return part.split('\n').map((line, j) => (
            line.trim() ? <span key={`${i}-${j}`}>{line}</span> : <br key={`${i}-${j}`} />
          ));
        })}
      </div>
    );
  }

  // Fallback: if latex prop is provided but content doesn't have delimiters
  if (latex) {
    return (
      <div className={className}>
        <BlockMath math={latex} />
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
