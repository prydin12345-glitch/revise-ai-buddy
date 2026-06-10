import { InlineMath, BlockMath } from 'react-katex';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';

interface MathRendererProps {
  content: string | any;
  latex?: string | null;
  hasMath?: boolean;
  className?: string;
  inline?: boolean; // For rendering inside labels/spans without block wrappers
}

// Robust string coercion for any database content value
export const ensureString = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    // Handle cases where content is stored as {text: "..."} or similar
    if (value.text) return String(value.text);
    if (value.content) return String(value.content);
    if (value.question_text) return String(value.question_text);
    return JSON.stringify(value); // last resort
  }
  return String(value);
};

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
const removeMarksLine = (content: any): string => {
  const str = ensureString(content);
  if (!str) return '';
  return str
    .split('\n')
    .filter(line => !/^\s*Marks:\s*\d+\s*$/i.test(line.trim()))
    .join('\n');
};

// Strip mark scheme annotations like [M1, A1], [B1], [M1 A1 B1] from student-facing text
// These should only be visible in the marking/feedback phase, not during the exam
const stripMarkSchemeAnnotations = (content: string): string => {
  if (!content) return '';
  // Match patterns like [M1], [A1], [B1], [M1, A1], [M1 A1 B1], [M1, A1, B1] etc.
  // Also handles [2M1] or [M2] style
  return content.replace(/\s*\[(?:[MAB]\d+[,\s]*)+\]\s*/gi, ' ').trim();
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

// Convert bare subscripts/superscripts written in plain text (C_1, R_2, x^2, cm^3)
// into inline KaTeX so they render typographically (C with a small lowered 1)
// instead of showing literal underscores/carets. Only converts conservative
// patterns (short base + digits or a single letter) and never touches
// existing $...$ math segments, so prose like file_name is unaffected.
const convertBareSubSup = (content: string): string => {
  if (!content) return '';
  const segments = content.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
  return segments
    .map((seg) => {
      if (seg.startsWith('$')) return seg; // already math — leave untouched
      return seg
        // Subscripts: C_1, R_2, v_x  (base ≤3 letters; sub = digits or one letter)
        .replace(/\b([A-Za-z]{1,3})_(\d{1,3}|[A-Za-z])\b/g, (_m, base, sub) => `$${base}_{${sub}}$`)
        // Superscripts: x^2, cm^3, 10^-4  (sup = optional minus + digits, or one letter)
        .replace(/\b([A-Za-z]{1,4}|\d{1,4})\^(-?\d{1,3}|[A-Za-z])\b/g, (_m, base, sup) => `$${base}^{${sup}}$`);
    })
    .join('');
};

// Strip Markdown bold/italic emphasis the AI sometimes emits in question_text.
// MathRenderer only handles LaTeX (not Markdown), so **bold**, *italic*, __u__, _i_
// would otherwise render as literal asterisks/underscores.
const stripMarkdownEmphasis = (content: string): string => {
  if (!content) return '';
  return content
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1$2')
    .replace(/\|\s*([^|\n]+?)\s*\|/g, (m, inner) => `| ${inner.replace(/\*\*/g, '')} |`)
    .replace(/  +/g, ' ');
};

// Style [ BLANK ] placeholders for display
const styleBlankPlaceholders = (content: string): string => {
  // Replace [ BLANK ] with styled span for display
  return content.replace(/\[\s*BLANK\s*\]/gi, '<span class="blank-placeholder">[ BLANK ]</span>');
};

export function MathRenderer({ content, latex, hasMath, className = "", inline = false }: MathRendererProps) {
  // Ensure content is always a string using robust coercion
  const safeContent = ensureString(content);
  // First remove any standalone "Marks: n" lines
  const contentWithoutMarks = removeMarksLine(safeContent);
  
  // Strip mark scheme annotations [M1, A1, B1] from student-facing display
  const contentWithoutMarkSchemeRaw = stripMarkSchemeAnnotations(contentWithoutMarks);

  // Typeset bare sub/superscripts (C_1 → C₁, cm^3 → cm³) before any
  // markdown-emphasis stripping can eat the underscores.
  const contentWithoutMarkScheme = convertBareSubSup(contentWithoutMarkSchemeRaw);
  
  // Then normalize blank formats (convert underscores to [ BLANK ])
  const contentWithNormalizedBlanks = normalizeBlankFormat(contentWithoutMarkScheme);
  
  // Then convert any markdown tables to HTML tables
  const contentWithHtmlTables = convertMarkdownTableToHtml(contentWithNormalizedBlanks);

  // Strip Markdown bold/italic emphasis (renders as literal asterisks otherwise).
  // Skip stripping inside HTML tables — those are already converted markup.
  const contentWithoutMd = /<table[^>]*class="exam-table"[^>]*>/i.test(contentWithHtmlTables)
    ? contentWithHtmlTables
    : stripMarkdownEmphasis(contentWithHtmlTables);

  // Clean the content if it has letter prefix (for MCQ options)
  const cleanedContent = cleanOptionText(contentWithoutMd);
  
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
              // Skip pure currency amounts (e.g. "$30", "$5,000") — no LaTeX commands
              if (/^\d[\d,.]*$/.test(mathContent)) {
                return <span key={i}>{part}</span>;
              }
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
              if (/^\d[\d,.]*$/.test(mathContent)) {
                return <span key={`${i}-${j}`}>{mathPart}</span>;
              }
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
            if (/^\d[\d,.]*$/.test(mathContent)) {
              return <span key={i}>{part}</span>;
            }
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
