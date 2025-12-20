import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import katex from 'katex';

interface TableCell {
  rowIndex: number;
  colIndex: number;
  key: string;
  isEditable: boolean;
  isHeader: boolean;
  originalContent: string;
  inputType: 'text' | 'numeric' | 'checkbox';
}

interface InteractiveExamTableProps {
  tableHtml: string;
  questionId: string;
  tableAnswers: Record<string, string | boolean>;
  onTableChange: (answers: Record<string, string | boolean>) => void;
  readOnly?: boolean;
  subjectColor?: string;
}

// Process LaTeX in cell content and convert to plain text or rendered HTML
const processLatexInCell = (content: string): string => {
  if (!content) return content;
  
  // Convert $\checkmark$ or \checkmark to ✓
  let processed = content.replace(/\$?\\checkmark\$?/gi, '✓');
  
  // Convert LaTeX units like "$0.4 \, mol \, dm^{-3}$" to plain text
  // Pattern: $number \, unit \, unit$ or variations
  processed = processed.replace(/\$([^$]+)\$/g, (match, latex) => {
    // Try to convert common LaTeX patterns to plain text
    let plain = latex
      // Remove \, spacing
      .replace(/\\,/g, ' ')
      // Convert superscripts like ^{-3} or ^3 to superscript characters
      .replace(/\^{?(-?\d+)}?/g, (m, num) => {
        const superscripts: Record<string, string> = {
          '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
          '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
          '-': '⁻'
        };
        return num.split('').map((c: string) => superscripts[c] || c).join('');
      })
      // Convert subscripts like _{2} to subscript characters
      .replace(/_{?(\d+)}?/g, (m, num) => {
        const subscripts: Record<string, string> = {
          '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
          '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
        };
        return num.split('').map((c: string) => subscripts[c] || c).join('');
      })
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    return plain;
  });
  
  return processed;
};

// Detect if a column should use numeric input based on header text
const isNumericColumn = (headerText: string): boolean => {
  const numericPatterns = [
    /volume/i, /cm³/i, /cm\^?3/i, /dm³/i, /dm\^?3/i,
    /mol/i, /concentration/i, /conc/i,
    /temp/i, /°C/i, /°F/i, /kelvin/i,
    /mass/i, /kg/i, /g\b/i, /mg/i,
    /time/i, /\bs\b/i, /seconds/i, /minutes/i,
    /count/i, /number/i, /quantity/i, /qty/i,
    /rate/i, /speed/i, /velocity/i,
    /pressure/i, /Pa/i, /atm/i,
    /energy/i, /joule/i, /J\b/i,
    /current/i, /voltage/i, /resistance/i, /A\b/i, /V\b/i, /Ω/i,
    /length/i, /width/i, /height/i, /distance/i, /m\b/i, /mm/i, /cm\b/i,
    /area/i, /m²/i, /cm²/i,
    /frequency/i, /Hz/i,
    /percentage/i, /%/i,
    /mL/i, /stock/i, /water/i, /dilut/i, /required/i,
  ];
  return numericPatterns.some(pattern => pattern.test(headerText));
};

// Detect if a column should use TEXT entry (short text/word answers, not numeric)
// These are columns where students type names, terms, descriptions
const isTextEntryColumn = (headerText: string): boolean => {
  const textEntryPatterns = [
    /\bstructure\b/i, /\borgan\b/i, /\btissue\b/i, /\bprocess\b/i,
    /\bname\b/i, /\bfunction\b/i, /\bdescription\b/i, /\bexample\b/i,
    /\bterm\b/i, /\bdefinition\b/i, /\btype\b/i, /\bclass\b/i,
    /\bcategory\b/i, /\bfeature\b/i, /\bproperty\b/i, /\bcharacteristic\b/i,
    /\bcomponent\b/i, /\bpart\b/i, /\belement\b/i, /\bitem\b/i,
    /\borganelle\b/i, /\bcell\b/i, /\bvessel\b/i, /\bbone\b/i,
    /\bmuscle\b/i, /\bnerve\b/i, /\bhormone\b/i, /\bprotein\b/i,
    /\benzyme\b/i, /\breagent\b/i, /\bproduct\b/i, /\bsubstrate\b/i,
    /\banswer\b/i, /\bvalue\b/i, /\bresult\b/i, /\bresponse\b/i,
    /\bidentify\b/i, /\bstate\b/i, /\bgive\b/i, /\bwrite\b/i,
    /\blabel\b/i, /\bspecies\b/i, /\bgenus\b/i, /\bcompound\b/i,
  ];
  return textEntryPatterns.some(pattern => pattern.test(headerText));
};

// Check if the first column (row labels) contains numeric/unit content
const hasNumericRowLabels = (rows: string[][]): boolean => {
  if (rows.length === 0) return false;
  const numericLabelPatterns = [
    /mol/i, /dm/i, /cm/i, /mg/i, /kg/i, /mL/i, /L\b/i,
    /\d+(\.\d+)?/, // Any number
    /%/i, /°/i,
  ];
  return rows.some(row => {
    if (row.length === 0) return false;
    const firstCell = row[0];
    return numericLabelPatterns.some(pattern => pattern.test(firstCell));
  });
};

// Detect if a column should use checkbox based on header or content
// STRICT RULE: Only use checkbox when EXPLICITLY indicated with tick/checkmark language
// PRIORITY: Checkbox takes precedence when explicit checkmarks are present in content
const isCheckboxColumn = (headerText: string, sampleContent: string[], allHeaders: string[]): boolean => {
  // Process content to convert LaTeX checkmarks to actual checkmarks for detection
  const processedContent = sampleContent.map(c => processLatexInCell(c));
  
  // Check for actual checkmark symbols in content (not just empty cells)
  const hasCheckmarkContent = processedContent.some(c => /[✓✔]/.test(c));
  
  // PRIORITY RULE: If checkmarks are PRESENT in content, this IS a checkbox column
  // This takes priority over numeric/text-entry detection
  if (hasCheckmarkContent) {
    return true;
  }
  
  // STRICT: Only match checkbox if header explicitly mentions tick/check/checkmark symbols
  // These exact phrases: "tick", "check mark", "✓", "✔"
  const explicitCheckboxHeader = /\btick\b|\bcheck\s*mark\b|✓|✔/i.test(headerText);
  
  // If NO checkmarks in content, only use checkbox if header explicitly indicates it
  // AND the table doesn't have entry-type headers (numeric or text)
  if (explicitCheckboxHeader) {
    const tableHasEntryHeaders = allHeaders.some(h => isNumericColumn(h) || isTextEntryColumn(h));
    // Allow checkbox header to work unless there are numeric/text-entry headers
    return !tableHasEntryHeaders;
  }
  
  // Otherwise, NOT a checkbox column
  return false;
};

// Parse HTML table and extract structure
const parseTable = (html: string): {
  headers: string[];
  rows: string[][];
  cells: TableCell[];
} => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  
  if (!table) {
    return { headers: [], rows: [], cells: [] };
  }
  
  const headers: string[] = [];
  const rows: string[][] = [];
  const cells: TableCell[] = [];
  
  // Extract headers
  const headerRow = table.querySelector('thead tr');
  if (headerRow) {
    const ths = headerRow.querySelectorAll('th');
    ths.forEach((th, colIndex) => {
      headers.push(th.textContent?.trim() || '');
      cells.push({
        rowIndex: 0,
        colIndex,
        key: `header_${colIndex}`,
        isEditable: false,
        isHeader: true,
        originalContent: th.innerHTML,
        inputType: 'text'
      });
    });
  }
  
  // Collect sample content per column to help detect input type
  const columnSamples: string[][] = headers.map(() => []);
  
  // Extract body rows
  const bodyRows = table.querySelectorAll('tbody tr');
  bodyRows.forEach((tr, rowIndex) => {
    const rowData: string[] = [];
    const tds = tr.querySelectorAll('td');
    tds.forEach((td, colIndex) => {
      // Get raw content and process LaTeX
      const rawContent = td.textContent?.trim() || '';
      const processedContent = processLatexInCell(rawContent);
      rowData.push(processedContent);
      if (colIndex < columnSamples.length) {
        columnSamples[colIndex].push(processedContent);
      }
    });
    rows.push(rowData);
  });
  
  // Determine input types for each column
  // PRIORITY ORDER: 
  // 1) Checkbox FIRST - if explicit checkmarks are present in content, checkbox takes priority
  // 2) Numeric - columns with units  
  // 3) Text-entry - columns for naming/identifying
  // 4) Default text
  const columnInputTypes: ('text' | 'numeric' | 'checkbox')[] = headers.map((header, colIndex) => {
    const samples = columnSamples[colIndex] || [];
    const processedSamples = samples.map(s => processLatexInCell(s));
    const hasCheckmarkInContent = processedSamples.some(c => /[✓✔]/.test(c));
    
    // PRIORITY 1: If checkmarks are present in content, this IS a checkbox column
    // This takes priority over everything else
    if (hasCheckmarkInContent) return 'checkbox';
    
    // PRIORITY 2: Check numeric - columns with units
    if (isNumericColumn(header)) return 'numeric';
    
    // PRIORITY 3: Check text-entry columns (Structure, Name, Function, etc.)
    if (isTextEntryColumn(header)) return 'text';
    
    // PRIORITY 4: Check checkbox based on explicit header indicators (no checkmarks in content)
    if (isCheckboxColumn(header, samples, headers)) return 'checkbox';
    
    // Default to text input for any remaining columns with empty cells
    return 'text';
  });
  
  // Create cell objects for body
  rows.forEach((row, rowIndex) => {
    row.forEach((content, colIndex) => {
      const isEmpty = content.trim() === '';
      cells.push({
        rowIndex: rowIndex + 1, // +1 because header is row 0
        colIndex,
        key: `row${rowIndex + 1}_col${colIndex + 1}`,
        isEditable: isEmpty,
        isHeader: false,
        originalContent: content,
        inputType: columnInputTypes[colIndex] || 'text'
      });
    });
  });
  
  return { headers, rows, cells };
};

export function InteractiveExamTable({
  tableHtml,
  questionId,
  tableAnswers,
  onTableChange,
  readOnly = false,
  subjectColor = '#3B82F6'
}: InteractiveExamTableProps) {
  const { headers, rows, cells } = useMemo(() => parseTable(tableHtml), [tableHtml]);
  
  const handleCellChange = useCallback((key: string, value: string | boolean) => {
    const newAnswers = { ...tableAnswers, [key]: value };
    onTableChange(newAnswers);
  }, [tableAnswers, onTableChange]);
  
  const getCellValue = (key: string, inputType: string): string | boolean => {
    const value = tableAnswers[key];
    if (inputType === 'checkbox') {
      return value === true || value === 'true';
    }
    return typeof value === 'string' ? value : '';
  };
  
  if (headers.length === 0 || rows.length === 0) {
    // Fallback to static rendering
    return <div dangerouslySetInnerHTML={{ __html: tableHtml }} />;
  }
  
  return (
    <div className="my-4 overflow-x-auto">
      <table className="exam-table w-full border-collapse">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th 
                key={`header-${idx}`}
                className="border border-border bg-muted/50 px-3 py-2 text-left text-sm font-semibold"
              >
                {processLatexInCell(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((content, colIndex) => {
                const cell = cells.find(
                  c => c.rowIndex === rowIndex + 1 && c.colIndex === colIndex && !c.isHeader
                );
                const cellKey = cell?.key || `row${rowIndex + 1}_col${colIndex + 1}`;
                const isEditable = cell?.isEditable || false;
                const inputType = cell?.inputType || 'text';
                
                if (!isEditable || readOnly) {
                  // Non-editable cell - render checkmarks as visual indicators
                  const displayContent = content;
                  const hasCheckmark = displayContent === '✓' || displayContent === '✔';
                  
                  return (
                    <td 
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="border border-border px-3 py-2 text-sm"
                    >
                      {hasCheckmark ? (
                        <div className="flex items-center justify-center">
                          <span className="text-primary font-bold text-lg">✓</span>
                        </div>
                      ) : (
                        displayContent
                      )}
                    </td>
                  );
                }
                
                // Editable cell
                return (
                  <td 
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="border border-border px-1 py-1"
                  >
                    {inputType === 'checkbox' ? (
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={getCellValue(cellKey, inputType) as boolean}
                          onCheckedChange={(checked) => handleCellChange(cellKey, checked === true)}
                          style={{
                            borderColor: subjectColor,
                            backgroundColor: getCellValue(cellKey, inputType) ? subjectColor : undefined
                          }}
                          className="h-5 w-5"
                        />
                      </div>
                    ) : (
                      <Input
                        type={inputType === 'numeric' ? 'text' : 'text'}
                        inputMode={inputType === 'numeric' ? 'decimal' : 'text'}
                        value={getCellValue(cellKey, inputType) as string}
                        onChange={(e) => handleCellChange(cellKey, e.target.value)}
                        placeholder={inputType === 'numeric' ? '0' : '...'}
                        className="h-8 text-sm text-center border-0 focus:ring-2"
                        style={{
                          outline: 'none',
                          boxShadow: 'none'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = subjectColor;
                          e.target.style.borderWidth = '2px';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '';
                          e.target.style.borderWidth = '';
                        }}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Convert markdown table to HTML table (same logic as MathRenderer)
function convertMarkdownTableToHtml(content: string): string {
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
      result.push(convertTableLinesToHtml(tableLines));
      tableLines = [];
      inTable = false;
      result.push(line);
    } else if (inTable) {
      result.push(convertTableLinesToHtml(tableLines));
      tableLines = [];
      inTable = false;
      result.push(line);
    } else {
      result.push(line);
    }
  }
  
  if (tableLines.length > 0) {
    result.push(convertTableLinesToHtml(tableLines));
  }
  
  return result.join('\n');
}

function convertTableLinesToHtml(lines: string[]): string {
  if (lines.length < 2) return lines.join('\n');
  
  const rows = lines
    .filter(line => !line.match(/^\s*\|[\s:\-|]+\|\s*$/))
    .map(line => {
      const parts = line.split('|');
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
}

// Helper to detect if content has an interactive table (table with empty cells)
// Checks both HTML format AND markdown format
export function hasInteractiveTable(content: string): boolean {
  // Check for HTML table format
  if (content.includes('<table class="exam-table">')) {
    const emptyTdPattern = /<td>\s*<\/td>/gi;
    if (emptyTdPattern.test(content)) return true;
  }
  
  // Check for markdown table format with empty cells
  // Pattern matches lines like: | text | | | (empty cells between pipes)
  const markdownTablePattern = /^\s*\|.*\|/m;
  if (markdownTablePattern.test(content)) {
    // Check if there are empty cells (two consecutive pipes with only whitespace between)
    const emptyMarkdownCellPattern = /\|\s*\|/;
    if (emptyMarkdownCellPattern.test(content)) return true;
  }
  
  return false;
}

// Extract table HTML from content (converts markdown to HTML if needed)
export function extractTableHtml(content: string): string | null {
  // First try HTML format
  const htmlTableMatch = content.match(/<table class="exam-table">[\s\S]*?<\/table>/i);
  if (htmlTableMatch) {
    return htmlTableMatch[0];
  }
  
  // Try markdown format - convert to HTML
  const markdownTablePattern = /^\s*\|.*\|/m;
  if (markdownTablePattern.test(content)) {
    const convertedContent = convertMarkdownTableToHtml(content);
    const convertedMatch = convertedContent.match(/<table class="exam-table">[\s\S]*?<\/table>/i);
    return convertedMatch ? convertedMatch[0] : null;
  }
  
  return null;
}

// Remove table from content for separate rendering
export function removeTableFromContent(content: string): string {
  // Remove HTML table format
  let cleaned = content.replace(/<table class="exam-table">[\s\S]*?<\/table>/gi, '').trim();
  
  // Remove markdown table format (lines starting and ending with |)
  const lines = cleaned.split('\n');
  const nonTableLines = lines.filter(line => {
    // Skip lines that are part of markdown table (start with | or are separator rows)
    const isTableRow = /^\s*\|/.test(line);
    const isSeparator = /^\s*\|[\s:\-|]+\|\s*$/.test(line);
    return !isTableRow && !isSeparator;
  });
  
  return nonTableLines.join('\n').trim();
}
