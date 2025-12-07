import { InlineMath, BlockMath } from 'react-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
  latex?: string | null;
  hasMath?: boolean;
  className?: string;
  inline?: boolean; // For rendering inside labels/spans without block wrappers
}

// Process table HTML to render LaTeX in cells
const processTableWithMath = (tableHtml: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtml, 'text/html');
    const table = doc.querySelector('table');
    
    if (table) {
      // Process all <td> and <th> cells
      const cells = table.querySelectorAll('td, th');
      cells.forEach(cell => {
        const cellContent = cell.innerHTML;
        
        // Check for LaTeX delimiters ($...$)
        const hasLatex = /\$[^$]+\$/g.test(cellContent);
        
        if (hasLatex) {
          // Replace LaTeX expressions with rendered HTML
          const processedContent = cellContent.replace(/\$([^$]+)\$/g, (match, latex) => {
            try {
              // Render LaTeX using KaTeX
              return katex.renderToString(latex, { 
                throwOnError: false,
                displayMode: false 
              });
            } catch (e) {
              // If rendering fails, return original
              return match;
            }
          });
          
          cell.innerHTML = processedContent;
        }
      });
      
      return table.outerHTML;
    }
  } catch (e) {
    console.error('Error processing table with math:', e);
  }
  
  return tableHtml;
};

// Helper to clean option text - remove letter prefixes like "A) ", "B) "
const cleanOptionText = (text: string): string => {
  return text.replace(/^[A-Da-d]\)\s*/, '').trim();
};

export function MathRenderer({ content, latex, hasMath, className = "", inline = false }: MathRendererProps) {
  // Clean the content if it has letter prefix (for MCQ options)
  const cleanedContent = cleanOptionText(content);
  
  // Check if content contains HTML tables
  const hasHtmlTable = /<table[^>]*class="exam-table"[^>]*>/i.test(cleanedContent);
  
  // Check if content contains math delimiters
  const hasInlineOrBlockMath = /\$\$[^$]+\$\$|\$[^$]+\$/g.test(cleanedContent);
  
  // Inline mode - render without block-level wrappers for use in labels/spans
  if (inline) {
    if (hasMath || hasInlineOrBlockMath) {
      const parts = cleanedContent.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
      return (
        <span className={className}>
          {parts.map((part, i) => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
              const mathContent = part.slice(2, -2);
              return <InlineMath key={i} math={mathContent} />;
            }
            if (part.startsWith('$') && part.endsWith('$')) {
              const mathContent = part.slice(1, -1);
              return <InlineMath key={i} math={mathContent} />;
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    }
    return <span className={className}>{cleanedContent}</span>;
  }
  
  // If content has HTML tables, render with safe HTML parsing
  if (hasHtmlTable) {
    // Split by table tags to separate tables from regular content
    const tableRegex = /(<table class="exam-table">[\s\S]*?<\/table>)/gi;
    const parts = cleanedContent.split(tableRegex);
    
    return (
      <div className={`prose prose-sm max-w-none ${className}`}>
        {parts.map((part, i) => {
          // Check if this part is a table
          if (part.match(tableRegex)) {
            // Process LaTeX in table cells before rendering
            const processedTable = processTableWithMath(part);
            return (
              <div 
                key={i} 
                className="my-4"
                dangerouslySetInnerHTML={{ __html: processedTable }}
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
    const parts = cleanedContent.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
    
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
      {cleanedContent.split('\n').map((line, i) => (
        line.trim() ? <p key={i}>{line}</p> : <br key={i} />
      ))}
    </div>
  );
}
