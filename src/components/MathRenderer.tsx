import { InlineMath, BlockMath } from 'react-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';

interface MathRendererProps {
  content: string;
  latex?: string | null;
  hasMath?: boolean;
  className?: string;
  inline?: boolean; // For rendering inside labels/spans without block wrappers
}

// Convert markdown table lines to HTML table
const convertTableLinesToHtml = (lines: string[]): string => {
  if (lines.length < 2) return lines.join('\n');
  
  const rows = lines
    .filter(line => !line.match(/^\s*\|[\s:\-|]+\|\s*$/)) // Remove separator rows (|---|---|)
    .map(line => {
      // Split by | and handle edge cases
      const parts = line.split('|');
      // Remove empty first/last elements from leading/trailing pipes
      const cells = parts.slice(1, -1).map(c => c.trim());
      return cells;
    })
    .filter(row => row.length > 0);
  
  if (rows.length === 0) return '';
  
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  
  let html = '<table class="exam-table">\n<thead>\n<tr>';
  headerRow.forEach(cell => html += `<th>${cell}</th>`);
  html += '</tr>\n</thead>\n<tbody>\n';
  
  bodyRows.forEach(row => {
    html += '<tr>';
    row.forEach(cell => html += `<td>${cell}</td>`);
    html += '</tr>\n';
  });
  
  html += '</tbody>\n</table>';
  return html;
};

// Convert markdown table to HTML table
const convertMarkdownTableToHtml = (content: string): string => {
  const lines = content.split('\n');
  const tableLinePattern = /^\s*\|.*\|/;
  
  let inTable = false;
  let tableLines: string[] = [];
  let result: string[] = [];
  
  for (const line of lines) {
    if (tableLinePattern.test(line)) {
      inTable = true;
      tableLines.push(line);
    } else if (inTable && line.trim() === '') {
      // End of table - convert it
      result.push(convertTableLinesToHtml(tableLines));
      tableLines = [];
      inTable = false;
      result.push(line);
    } else if (inTable) {
      // Non-table line while in table - end table
      result.push(convertTableLinesToHtml(tableLines));
      tableLines = [];
      inTable = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }
  
  // Handle table at end of content
  if (tableLines.length > 0) {
    result.push(convertTableLinesToHtml(tableLines));
  }
  
  return result.join('\n');
};

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
              // Render LaTeX using KaTeX with XSS-safe options
              return katex.renderToString(latex, { 
                throwOnError: false,
                displayMode: false,
                trust: false,  // Disable trust mode to prevent XSS
                strict: true   // Strict mode for additional security
              });
            } catch (e) {
              // If rendering fails, return original (escaped)
              return DOMPurify.sanitize(match);
            }
          });
          
          // Sanitize processed content before setting innerHTML
          cell.innerHTML = DOMPurify.sanitize(processedContent, {
            ADD_TAGS: ['span', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mroot', 'msqrt'],
            ADD_ATTR: ['class', 'style', 'aria-hidden', 'xmlns']
          });
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

// Remove standalone "Marks: n" lines since marks are shown in the badge
const removeMarksLine = (content: string): string => {
  if (!content) return '';
  // Remove lines that are just "Marks: n" or similar patterns
  return content
    .split('\n')
    .filter(line => !/^\s*Marks:\s*\d+\s*$/i.test(line.trim()))
    .join('\n');
};

// Convert various blank formats to standardized [ BLANK ] format
const normalizeBlankFormat = (content: string): string => {
  let normalized = content;
  
  // Pattern to detect backslash-style blanks (5+ backslashes, with or without underscores)
  // Matches: \\\\\\, \\_\\_\\_, L\\L\\L (common OCR artifacts)
  const backslashPattern = /(?:[\\\/L_]{5,}|(?:[\\\/L]+[_\\\/L]*){5,})/g;
  normalized = normalized.replace(backslashPattern, '[ BLANK ]');
  
  // Replace 5+ underscores with [ BLANK ]
  normalized = normalized.replace(/_{5,}/g, '[ BLANK ]');
  
  // Replace LaTeX underline commands
  normalized = normalized.replace(/\\underline\{[^}]*\}/g, '[ BLANK ]');
  
  // Clean up any double blanks created
  normalized = normalized.replace(/\[\s*BLANK\s*\]\s*\[\s*BLANK\s*\]/g, '[ BLANK ]');
  
  return normalized;
};

// Style [ BLANK ] placeholders for display
const styleBlankPlaceholders = (content: string): string => {
  // Replace [ BLANK ] with styled span for display
  return content.replace(/\[\s*BLANK\s*\]/gi, '<span class="blank-placeholder">[ BLANK ]</span>');
};

export function MathRenderer({ content, latex, hasMath, className = "", inline = false }: MathRendererProps) {
  // First remove any standalone "Marks: n" lines
  const contentWithoutMarks = removeMarksLine(content);
  
  // Then normalize blank formats (convert underscores to [ BLANK ])
  const contentWithNormalizedBlanks = normalizeBlankFormat(contentWithoutMarks);
  
  // Then convert any markdown tables to HTML tables
  const contentWithHtmlTables = convertMarkdownTableToHtml(contentWithNormalizedBlanks);
  
  // Clean the content if it has letter prefix (for MCQ options)
  const cleanedContent = cleanOptionText(contentWithHtmlTables);
  
  // Check if content contains HTML tables
  const hasHtmlTable = /<table[^>]*class="exam-table"[^>]*>/i.test(cleanedContent);
  
  // Check if content contains math delimiters
  const hasInlineOrBlockMath = /\$\$[^$]+\$\$|\$(?!\d)[^$]+\$/g.test(cleanedContent);
  
  // Inline mode - render without block-level wrappers for use in labels/spans
  if (inline) {
    if (hasMath || hasInlineOrBlockMath) {
      const parts = cleanedContent.split(/(\$\$[^$]+\$\$|\$(?!\d)[^$]+\$)/g);
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
            // Sanitize the processed table before rendering
            const sanitizedTable = DOMPurify.sanitize(processedTable, {
              ADD_TAGS: ['span', 'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mroot', 'msqrt', 'table', 'thead', 'tbody', 'tr', 'td', 'th'],
              ADD_ATTR: ['class', 'style', 'aria-hidden', 'xmlns']
            });
            return (
              <div 
                key={i} 
                className="my-4"
                dangerouslySetInnerHTML={{ __html: sanitizedTable }}
              />
            );
          }
          
          // For non-table parts, check for math expressions
          const mathParts = part.split(/(\$\$[^$]+\$\$|\$(?!\d)[^$]+\$)/g);
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
    const parts = cleanedContent.split(/(\$\$[^$]+\$\$|\$(?!\d)[^$]+\$)/g);
    
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
