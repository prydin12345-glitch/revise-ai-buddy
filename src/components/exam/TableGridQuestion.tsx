import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';

export interface TableGridData {
  headers: string[];
  rows: { id: string; label: string }[];
  selectionMode: 'single' | 'multi';
  markStyle: 'x' | 'tick' | 'either';
  prefilled?: { rowId: string; colIndex: number; value: string; locked?: boolean }[];
  correctAnswers?: Record<string, number[]>;
  marksPerRow?: number;
}

interface TableGridQuestionProps {
  tableData: TableGridData;
  questionId: string;
  answers: Record<string, number[]>; // rowId -> selected column indices
  onAnswerChange: (answers: Record<string, number[]>) => void;
  readOnly?: boolean;
  subjectColor?: string;
  showCorrectAnswers?: boolean; // For review mode
  correctAnswers?: Record<string, number[]>; // For review mode
}

// Parse markdown table to TableGridData
export function parseMarkdownToTableGrid(content: string): TableGridData | null {
  const lines = content.split('\n').filter(line => line.trim());
  
  // Find markdown table lines (lines with |)
  const tableLines = lines.filter(line => /^\s*\|/.test(line));
  if (tableLines.length < 2) return null;
  
  // Filter out separator rows
  const dataLines = tableLines.filter(line => !/^\s*\|[\s:\-|]+\|\s*$/.test(line));
  if (dataLines.length < 2) return null;
  
  // Parse headers
  const headerParts = dataLines[0].split('|').slice(1, -1).map(h => h.trim());
  if (headerParts.length < 2) return null;
  
  // Detect if this is a tick/X table based on question context
  const questionLower = content.toLowerCase();
  const isTickTable = questionLower.includes('tick') || 
                      questionLower.includes('cross') || 
                      questionLower.includes('(x)') ||
                      questionLower.includes('✓') ||
                      questionLower.includes('✔');
  
  if (!isTickTable) return null;
  
  // Parse rows
  const dataRows = dataLines.slice(1);
  const rows: { id: string; label: string }[] = [];
  const prefilled: { rowId: string; colIndex: number; value: string; locked?: boolean }[] = [];
  
  // Detect if first row is an example
  const firstRowContent = dataRows[0]?.split('|').slice(1, -1).map(c => c.trim()) || [];
  const hasExampleRow = firstRowContent.some(cell => 
    cell.toLowerCase() === 'x' || cell === '✓' || cell === '✔'
  );
  
  dataRows.forEach((line, rowIndex) => {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    const label = cells[0] || '';
    const rowId = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    rows.push({ id: rowId, label });
    
    // Check for prefilled cells (X or ✓)
    cells.slice(1).forEach((cell, colIdx) => {
      if (cell.toLowerCase() === 'x' || cell === '✓' || cell === '✔') {
        prefilled.push({
          rowId,
          colIndex: colIdx + 1, // +1 because first column is label
          value: cell.toLowerCase() === 'x' ? 'X' : '✓',
          locked: rowIndex === 0 && hasExampleRow // Lock example row
        });
      }
    });
  });
  
  // Determine mark style
  let markStyle: 'x' | 'tick' | 'either' = 'x';
  if (questionLower.includes('tick') && !questionLower.includes('cross')) {
    markStyle = 'tick';
  } else if (questionLower.includes('cross') || questionLower.includes('(x)')) {
    markStyle = 'x';
  }
  
  return {
    headers: headerParts,
    rows,
    selectionMode: 'multi', // Most tick/X tables allow multiple selections per row
    markStyle,
    prefilled: prefilled.length > 0 ? prefilled : undefined,
    marksPerRow: 1
  };
}

// Check if question text contains a tick/X table
export function isTickXTable(content: string): boolean {
  const result = parseMarkdownToTableGrid(content);
  return result !== null;
}

// Extract the text portion before the table
export function extractTextBeforeTable(content: string): string {
  const lines = content.split('\n');
  const nonTableLines: string[] = [];
  
  for (const line of lines) {
    if (/^\s*\|/.test(line)) break;
    nonTableLines.push(line);
  }
  
  return nonTableLines.join('\n').trim();
}

export function TableGridQuestion({
  tableData,
  questionId,
  answers,
  onAnswerChange,
  readOnly = false,
  subjectColor = '#3B82F6',
  showCorrectAnswers = false,
  correctAnswers
}: TableGridQuestionProps) {
  const { headers, rows, selectionMode, markStyle, prefilled } = tableData;
  
  // Create a map of locked cells from prefilled data
  const lockedCells = useMemo(() => {
    const map = new Map<string, string>();
    prefilled?.forEach(p => {
      if (p.locked) {
        map.set(`${p.rowId}_${p.colIndex}`, p.value);
      }
    });
    return map;
  }, [prefilled]);
  
  // Get display mark based on style
  const getMark = () => {
    return markStyle === 'tick' ? '✓' : 'X';
  };
  
  // Check if a cell is selected
  const isCellSelected = (rowId: string, colIndex: number) => {
    return answers[rowId]?.includes(colIndex) || false;
  };
  
  // Check if a cell is locked (prefilled example)
  const isCellLocked = (rowId: string, colIndex: number) => {
    return lockedCells.has(`${rowId}_${colIndex}`);
  };
  
  // Get locked cell value
  const getLockedValue = (rowId: string, colIndex: number) => {
    return lockedCells.get(`${rowId}_${colIndex}`);
  };
  
  // Toggle cell selection
  const toggleCell = useCallback((rowId: string, colIndex: number) => {
    if (readOnly || isCellLocked(rowId, colIndex)) return;
    
    const currentSelections = answers[rowId] || [];
    let newSelections: number[];
    
    if (selectionMode === 'single') {
      // Single selection: toggle current or clear and select new
      if (currentSelections.includes(colIndex)) {
        newSelections = [];
      } else {
        newSelections = [colIndex];
      }
    } else {
      // Multi selection: toggle the specific cell
      if (currentSelections.includes(colIndex)) {
        newSelections = currentSelections.filter(c => c !== colIndex);
      } else {
        newSelections = [...currentSelections, colIndex];
      }
    }
    
    onAnswerChange({
      ...answers,
      [rowId]: newSelections
    });
  }, [answers, onAnswerChange, readOnly, selectionMode]);
  
  // Check if answer is correct for a cell (review mode)
  const getCellStatus = (rowId: string, colIndex: number): 'correct' | 'incorrect' | 'missed' | null => {
    if (!showCorrectAnswers || !correctAnswers) return null;
    
    const studentSelected = isCellSelected(rowId, colIndex);
    const shouldBeSelected = correctAnswers[rowId]?.includes(colIndex) || false;
    
    if (studentSelected && shouldBeSelected) return 'correct';
    if (studentSelected && !shouldBeSelected) return 'incorrect';
    if (!studentSelected && shouldBeSelected) return 'missed';
    return null;
  };
  
  return (
    <div className="my-4 overflow-x-auto">
      {/* Legend */}
      <div className="mb-3 text-sm text-muted-foreground flex items-center gap-4">
        <span>
          Tap a cell to add/remove {markStyle === 'tick' ? 'a tick (✓)' : 'an X'}
        </span>
        {prefilled && prefilled.some(p => p.locked) && (
          <span className="text-xs bg-muted px-2 py-1 rounded">
            Shaded cells are examples
          </span>
        )}
      </div>
      
      <table className="w-full border-collapse border border-border">
        <thead>
          <tr>
            {headers.map((header, idx) => (
              <th 
                key={`header-${idx}`}
                className="border border-border bg-muted/50 px-4 py-3 text-left text-sm font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            // Check if this entire row is an example row (locked)
            const isExampleRow = prefilled?.some(p => p.rowId === row.id && p.locked);
            
            return (
              <tr 
                key={row.id}
                className={cn(
                  isExampleRow && 'bg-muted/30'
                )}
              >
                {/* Label cell */}
                <td className="border border-border px-4 py-3 text-sm font-medium">
                  {row.label}
                  {isExampleRow && (
                    <span className="ml-2 text-xs text-muted-foreground">(example)</span>
                  )}
                </td>
                
                {/* Data cells */}
                {headers.slice(1).map((_, colIdx) => {
                  const colIndex = colIdx + 1; // Actual column index (0 is label)
                  const isSelected = isCellSelected(row.id, colIndex);
                  const isLocked = isCellLocked(row.id, colIndex);
                  const lockedValue = getLockedValue(row.id, colIndex);
                  const cellStatus = getCellStatus(row.id, colIndex);
                  
                  return (
                    <td 
                      key={`${row.id}-${colIndex}`}
                      className="border border-border p-1"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCell(row.id, colIndex)}
                        disabled={readOnly || isLocked}
                        className={cn(
                          "w-full h-12 flex items-center justify-center text-xl font-bold rounded transition-all",
                          "focus:outline-none focus:ring-2 focus:ring-offset-2",
                          isLocked && "cursor-not-allowed bg-muted/50",
                          !isLocked && !readOnly && "hover:bg-accent cursor-pointer",
                          !isLocked && readOnly && "cursor-default",
                          // Review mode styling
                          cellStatus === 'correct' && "bg-green-100 dark:bg-green-900/30",
                          cellStatus === 'incorrect' && "bg-red-100 dark:bg-red-900/30",
                          cellStatus === 'missed' && "bg-amber-100 dark:bg-amber-900/30 border-2 border-dashed border-amber-500"
                        )}
                        style={{
                          ...(isSelected && !cellStatus && {
                            backgroundColor: `${subjectColor}15`,
                            color: subjectColor
                          }),
                          ...(isLocked && {
                            backgroundColor: '#f3f4f6',
                            color: '#374151'
                          }),
                          ...(!isLocked && !readOnly && {
                            focusRing: subjectColor
                          })
                        }}
                        aria-label={`${row.label} - ${headers[colIndex]}: ${isSelected || isLocked ? 'selected' : 'not selected'}`}
                      >
                        {isLocked ? (
                          <span className="text-lg">{lockedValue}</span>
                        ) : isSelected ? (
                          <span 
                            className={cn(
                              "text-2xl",
                              cellStatus === 'correct' && "text-green-600 dark:text-green-400",
                              cellStatus === 'incorrect' && "text-red-600 dark:text-red-400"
                            )}
                            style={!cellStatus ? { color: subjectColor } : undefined}
                          >
                            {getMark()}
                          </span>
                        ) : cellStatus === 'missed' ? (
                          <span className="text-amber-600 dark:text-amber-400 text-lg opacity-60">
                            {getMark()}
                          </span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      
      {/* Review mode legend */}
      {showCorrectAnswers && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded border border-green-300" />
            <span>Correct</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 dark:bg-red-900/30 rounded border border-red-300" />
            <span>Incorrect</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 rounded border-2 border-dashed border-amber-500" />
            <span>Missed (should have selected)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to convert TableGridQuestion answers to structured format for storage
export function serializeTableGridAnswers(answers: Record<string, number[]>): string {
  return JSON.stringify(answers);
}

// Helper to deserialize stored answers
export function deserializeTableGridAnswers(stored: string | Record<string, number[]> | null): Record<string, number[]> {
  if (!stored) return {};
  if (typeof stored === 'object') return stored as Record<string, number[]>;
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

// Deterministic grading for table_grid questions
export function gradeTableGrid(
  studentAnswers: Record<string, number[]>,
  correctAnswers: Record<string, number[]>,
  marksPerRow: number = 1
): {
  totalScore: number;
  maxMarks: number;
  perRowResults: Record<string, { correct: boolean; earned: number; max: number }>;
} {
  const perRowResults: Record<string, { correct: boolean; earned: number; max: number }> = {};
  let totalScore = 0;
  let maxMarks = 0;
  
  for (const rowId of Object.keys(correctAnswers)) {
    const expected = new Set(correctAnswers[rowId] || []);
    const actual = new Set(studentAnswers[rowId] || []);
    
    // Exact match required - must have exactly the correct selections
    const isCorrect = expected.size === actual.size && 
                      [...expected].every(col => actual.has(col));
    
    const earned = isCorrect ? marksPerRow : 0;
    totalScore += earned;
    maxMarks += marksPerRow;
    
    perRowResults[rowId] = { correct: isCorrect, earned, max: marksPerRow };
  }
  
  return { totalScore, maxMarks, perRowResults };
}
