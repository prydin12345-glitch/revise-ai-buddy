import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Enhanced TableGridData with support for both toggle and input cells
export interface TableGridColumn {
  id: string;
  label: string;
  kind: 'toggle' | 'text' | 'number';
  toggleSymbol?: 'X' | '✓';
}

export interface TableGridRow {
  id: string;
  label: string;
  isExample?: boolean;
}

export interface TableGridData {
  headers: string[];
  rows: TableGridRow[];
  columns?: TableGridColumn[]; // Enhanced column definitions
  selectionMode: 'single' | 'multi' | 'text' | 'number' | 'number_text';
  markStyle?: 'x' | 'tick' | 'either';
  tableType?: 'tick_cross' | 'text_entry' | 'number_entry' | 'mixed'; // Explicit table type
  prefilled?: { rowId: string; colIndex: number; value: string; locked?: boolean }[];
  correctAnswers?: Record<string, number[] | string[]>; // For toggle columns (number[]) or text columns (string[])
  answerKey?: Record<string, Record<string, boolean | string | number>>; // New format: rowId -> colId -> value
  marksPerRow?: number;
  marks?: number;
}

// New response format that supports both toggles and inputs
export interface TableGridResponse {
  _type: 'table_grid';
  version: 2;
  cells: Record<string, Record<number, boolean>>; // rowId -> colIndex -> selected
  inputs?: Record<string, Record<number, string | number>>; // rowId -> colIndex -> value
}

// Legacy response format for backward compatibility
export interface LegacyTableGridResponse {
  _type: 'table_grid';
  answers: Record<string, number[]>; // rowId -> selected column indices
}

interface TableGridQuestionProps {
  tableData: TableGridData;
  questionId: string;
  answers: Record<string, number[]>; // rowId -> selected column indices (toggle)
  inputAnswers?: Record<string, Record<number, string | number>>; // rowId -> colIndex -> value (input)
  onAnswerChange: (answers: Record<string, number[]>, inputs?: Record<string, Record<number, string | number>>) => void;
  readOnly?: boolean;
  subjectColor?: string;
  showCorrectAnswers?: boolean;
  correctAnswers?: Record<string, number[]>;
  answerKey?: Record<string, Record<string, boolean | string | number>>;
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
  const rows: TableGridRow[] = [];
  const prefilled: { rowId: string; colIndex: number; value: string; locked?: boolean }[] = [];
  
  // Detect if first row is an example (has pre-filled X or ✓)
  const firstRowContent = dataRows[0]?.split('|').slice(1, -1).map(c => c.trim()) || [];
  const hasExampleRow = firstRowContent.some(cell => 
    cell.toLowerCase() === 'x' || cell === '✓' || cell === '✔'
  );
  
  dataRows.forEach((line, rowIndex) => {
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    const label = cells[0] || '';
    const rowId = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    rows.push({ 
      id: rowId, 
      label,
      isExample: rowIndex === 0 && hasExampleRow
    });
    
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
  
  // Generate columns with IDs
  const columns: TableGridColumn[] = headerParts.map((label, idx) => ({
    id: `col_${idx}`,
    label,
    kind: 'toggle' as const,
    toggleSymbol: markStyle === 'tick' ? '✓' : 'X'
  }));
  
  return {
    headers: headerParts,
    rows,
    columns,
    selectionMode: 'multi',
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

// Convert legacy answer format to new format
export function convertLegacyAnswers(
  answers: Record<string, number[]>
): { cells: Record<string, Record<number, boolean>>; inputs: Record<string, Record<number, string | number>> } {
  const cells: Record<string, Record<number, boolean>> = {};
  
  for (const [rowId, cols] of Object.entries(answers)) {
    cells[rowId] = {};
    for (const colIdx of cols) {
      cells[rowId][colIdx] = true;
    }
  }
  
  return { cells, inputs: {} };
}

// Convert new format back to legacy for backward compatibility
export function convertToLegacyAnswers(
  cells: Record<string, Record<number, boolean>>
): Record<string, number[]> {
  const answers: Record<string, number[]> = {};
  
  for (const [rowId, colMap] of Object.entries(cells)) {
    answers[rowId] = Object.entries(colMap)
      .filter(([_, selected]) => selected)
      .map(([colIdx]) => parseInt(colIdx, 10));
  }
  
  return answers;
}

// Parse stored answer (supports both legacy and new formats)
export function parseStoredTableGridAnswer(
  stored: string | null
): { cells: Record<string, Record<number, boolean>>; inputs: Record<string, Record<number, string | number>> } | null {
  if (!stored) return null;
  
  try {
    const parsed = JSON.parse(stored);
    
    // New format (version 2)
    if (parsed._type === 'table_grid' && parsed.version === 2) {
      return {
        cells: parsed.cells || {},
        inputs: parsed.inputs || {}
      };
    }
    
    // Legacy format with answers array
    if (parsed._type === 'table_grid' && parsed.answers) {
      return convertLegacyAnswers(parsed.answers);
    }
    
    // Very old format (just the answers object)
    if (typeof parsed === 'object' && !parsed._type) {
      return convertLegacyAnswers(parsed);
    }
    
    return null;
  } catch {
    return null;
  }
}

// Serialize answer for storage
export function serializeTableGridAnswer(
  cells: Record<string, Record<number, boolean>>,
  inputs?: Record<string, Record<number, string | number>>
): string {
  const response: TableGridResponse = {
    _type: 'table_grid',
    version: 2,
    cells,
    inputs
  };
  return JSON.stringify(response);
}

// Helper to convert TableGridQuestion answers to structured format for storage (legacy compat)
export function serializeTableGridAnswers(answers: Record<string, number[]>): string {
  return JSON.stringify({
    _type: 'table_grid',
    answers
  });
}

// Helper to deserialize stored answers (legacy compat)
export function deserializeTableGridAnswers(stored: string | Record<string, number[]> | null): Record<string, number[]> {
  if (!stored) return {};
  if (typeof stored === 'object' && !('_type' in stored)) return stored as Record<string, number[]>;
  
  try {
    const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
    
    // New format - convert back to legacy
    if (parsed._type === 'table_grid' && parsed.version === 2 && parsed.cells) {
      return convertToLegacyAnswers(parsed.cells);
    }
    
    // Legacy format
    if (parsed._type === 'table_grid' && parsed.answers) {
      return parsed.answers;
    }
    
    // Very old format
    if (typeof parsed === 'object' && !parsed._type) {
      return parsed;
    }
    
    return {};
  } catch {
    return {};
  }
}

// Generate correct answer display string from answer key
export function generateCorrectAnswerDisplay(
  tableData: TableGridData,
  answerKey?: Record<string, Record<string, boolean | string | number>>,
  legacyAnswers?: Record<string, number[]>
): string {
  if (!answerKey && !legacyAnswers) return '';
  
  const lines: string[] = [];
  
  // Use legacy format if no new answerKey
  if (!answerKey && legacyAnswers) {
    for (const row of tableData.rows) {
      if (row.isExample) continue;
      
      const selectedCols = legacyAnswers[row.id] || [];
      if (selectedCols.length > 0) {
        const colLabels = selectedCols.map(idx => tableData.headers[idx] || `Column ${idx}`);
        lines.push(`${row.label}: ${colLabels.join(', ')}`);
      }
    }
    return lines.join('\n');
  }
  
  // Use new answerKey format
  if (answerKey) {
    for (const row of tableData.rows) {
      if (row.isExample) continue;
      const rowAnswers = answerKey[row.id];
      if (!rowAnswers) continue;
      
      const correctCols: string[] = [];
      for (const [colId, value] of Object.entries(rowAnswers)) {
        if (value === true) {
          const colIdx = parseInt(colId.replace('col_', ''), 10);
          correctCols.push(tableData.headers[colIdx] || `Column ${colIdx}`);
        } else if (typeof value === 'string' || typeof value === 'number') {
          const colIdx = parseInt(colId.replace('col_', ''), 10);
          correctCols.push(`${tableData.headers[colIdx]}: ${value}`);
        }
      }
      
      if (correctCols.length > 0) {
        lines.push(`${row.label}: ${correctCols.join(', ')}`);
      }
    }
  }
  
  return lines.join('\n');
}

export function TableGridQuestion({
  tableData,
  questionId,
  answers,
  inputAnswers = {},
  onAnswerChange,
  readOnly = false,
  subjectColor = '#3B82F6',
  showCorrectAnswers = false,
  correctAnswers,
  answerKey
}: TableGridQuestionProps) {
  const { headers, rows, columns, selectionMode, prefilled, tableType } = tableData;
  
  // Determine if this is a toggle table or input table
  const isInputTable = tableType === 'text_entry' || tableType === 'number_entry' || tableType === 'mixed' ||
    selectionMode === 'text' || selectionMode === 'number' || selectionMode === 'number_text' ||
    (columns && columns.some(c => c.kind === 'text' || c.kind === 'number'));
  
  // Determine mark style - default to 'tick' for True/False tables
  const isTrueFalseTable = headers.some(h => h.toLowerCase() === 'true' || h.toLowerCase() === 'false');
  const markStyle = tableData.markStyle || (isTrueFalseTable ? 'tick' : 'x');
  
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
  
  // Determine column types
  const columnKinds = useMemo(() => {
    if (columns && columns.length > 0) {
      // Map columns to kinds, with first column being the label
      const kinds: Array<'label' | 'toggle' | 'text' | 'number'> = ['label'];
      columns.forEach((c: any) => {
        // Support both 'kind' (new) and 'type' (from generator) properties
        const kind = c.kind || c.type || 'toggle';
        // Normalize kind value
        if (kind === 'text' || kind === 'text_entry') {
          kinds.push('text');
        } else if (kind === 'number' || kind === 'number_entry') {
          kinds.push('number');
        } else {
          kinds.push('toggle');
        }
      });
      return kinds;
    }
    // Default: first column is label, rest depend on tableType/selectionMode
    return headers.map((_, idx) => {
      if (idx === 0) return 'label';
      if (isInputTable) return 'text';
      return 'toggle';
    });
  }, [columns, headers, isInputTable]);
  
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
  
  // Get input value for a cell
  const getInputValue = (rowId: string, colIndex: number): string | number => {
    return inputAnswers[rowId]?.[colIndex] ?? '';
  };
  
  // Toggle cell selection
  const toggleCell = useCallback((rowId: string, colIndex: number) => {
    if (readOnly || isCellLocked(rowId, colIndex)) return;
    
    const currentSelections = answers[rowId] || [];
    let newSelections: number[];
    
    if (selectionMode === 'single') {
      if (currentSelections.includes(colIndex)) {
        newSelections = [];
      } else {
        newSelections = [colIndex];
      }
    } else {
      if (currentSelections.includes(colIndex)) {
        newSelections = currentSelections.filter(c => c !== colIndex);
      } else {
        newSelections = [...currentSelections, colIndex];
      }
    }
    
    onAnswerChange({
      ...answers,
      [rowId]: newSelections
    }, inputAnswers);
  }, [answers, inputAnswers, onAnswerChange, readOnly, selectionMode]);
  
  // Update input cell value
  const updateInputCell = useCallback((rowId: string, colIndex: number, value: string | number) => {
    if (readOnly) return;
    
    const newInputs = {
      ...inputAnswers,
      [rowId]: {
        ...(inputAnswers[rowId] || {}),
        [colIndex]: value
      }
    };
    
    onAnswerChange(answers, newInputs);
  }, [answers, inputAnswers, onAnswerChange, readOnly]);
  
  // Check if answer is correct for a cell (review mode)
  const getCellStatus = (rowId: string, colIndex: number): 'correct' | 'incorrect' | 'missed' | null => {
    if (!showCorrectAnswers) return null;
    
    const studentSelected = isCellSelected(rowId, colIndex);
    
    // Use answerKey if available
    if (answerKey) {
      const colId = `col_${colIndex}`;
      const expected = answerKey[rowId]?.[colId];
      if (expected === true) {
        return studentSelected ? 'correct' : 'missed';
      } else if (expected === false || expected === undefined) {
        return studentSelected ? 'incorrect' : null;
      }
      return null;
    }
    
    // Fall back to legacy correctAnswers
    if (correctAnswers) {
      const shouldBeSelected = correctAnswers[rowId]?.includes(colIndex) || false;
      
      if (studentSelected && shouldBeSelected) return 'correct';
      if (studentSelected && !shouldBeSelected) return 'incorrect';
      if (!studentSelected && shouldBeSelected) return 'missed';
    }
    
    return null;
  };
  
  return (
    <div className="my-4 overflow-x-auto">
      {/* Legend - only show if not read-only */}
      {!readOnly && (
        <div className="mb-3 text-sm text-muted-foreground flex items-center gap-4">
          {isInputTable ? (
            <span>Complete the table by typing your answers in the cells.</span>
          ) : (
            <span>
              Tap a cell to add/remove {markStyle === 'tick' ? 'a tick (✓)' : 'an X'}
            </span>
          )}
          {prefilled && prefilled.some(p => p.locked) && (
            <span className="text-xs bg-muted px-2 py-1 rounded">
              Shaded cells are examples
            </span>
          )}
        </div>
      )}
      
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
          {rows.map((row) => {
            const isExampleRow = row.isExample || prefilled?.some(p => p.rowId === row.id && p.locked);
            
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
                  const colIndex = colIdx + 1;
                  const isSelected = isCellSelected(row.id, colIndex);
                  const isLocked = isCellLocked(row.id, colIndex);
                  const lockedValue = getLockedValue(row.id, colIndex);
                  const cellStatus = getCellStatus(row.id, colIndex);
                  const columnKind = columnKinds[colIndex] || 'toggle';
                  
                  // Input cell
                  if (columnKind === 'text' || columnKind === 'number') {
                    return (
                      <td 
                        key={`${row.id}-${colIndex}`}
                        className="border border-border p-1"
                      >
                        <Input
                          type={columnKind === 'number' ? 'number' : 'text'}
                          value={getInputValue(row.id, colIndex)}
                          onChange={(e) => updateInputCell(row.id, colIndex, 
                            columnKind === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
                          )}
                          disabled={readOnly || isExampleRow}
                          className={cn(
                            "h-10",
                            cellStatus === 'correct' && "border-green-500 bg-green-50 dark:bg-green-900/20",
                            cellStatus === 'incorrect' && "border-red-500 bg-red-50 dark:bg-red-900/20"
                          )}
                        />
                      </td>
                    );
                  }
                  
                  // Toggle cell (default)
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

// Deterministic grading for table_grid questions with partial marks
export function gradeTableGrid(
  studentAnswers: Record<string, number[]>,
  correctAnswers: Record<string, number[]>,
  totalMarks: number,
  gradingMode: 'perCell' | 'perRow' = 'perCell'
): {
  totalScore: number;
  maxMarks: number;
  perRowResults: Record<string, { correct: boolean; earned: number; max: number; details: string }>;
  feedback: string;
} {
  const perRowResults: Record<string, { correct: boolean; earned: number; max: number; details: string }> = {};
  const nonExampleRows = Object.keys(correctAnswers);
  
  if (nonExampleRows.length === 0) {
    return { totalScore: 0, maxMarks: totalMarks, perRowResults, feedback: 'No gradable rows found' };
  }
  
  if (gradingMode === 'perCell') {
    // Count total cells to grade
    let totalCells = 0;
    let correctCells = 0;
    
    for (const rowId of nonExampleRows) {
      const expected = correctAnswers[rowId] || [];
      const actual = studentAnswers[rowId] || [];
      
      // Count correct selections and incorrect extras
      for (const col of expected) {
        totalCells++;
        if (actual.includes(col)) {
          correctCells++;
        }
      }
      
      // Penalize extra selections (false positives)
      const extraSelections = actual.filter(col => !expected.includes(col));
      // Don't count extra selections as cells, but they make the row incorrect
      
      const rowExpected = new Set(expected);
      const rowActual = new Set(actual);
      const rowCorrect = rowExpected.size === rowActual.size && 
                         [...rowExpected].every(col => rowActual.has(col));
      
      perRowResults[rowId] = {
        correct: rowCorrect,
        earned: 0, // Will calculate later
        max: 0,
        details: rowCorrect ? 'Correct' : extraSelections.length > 0 
          ? `Incorrect (${extraSelections.length} extra selection${extraSelections.length > 1 ? 's' : ''})` 
          : `Incomplete (missing ${expected.filter(col => !actual.includes(col)).length} selection${expected.filter(col => !actual.includes(col)).length > 1 ? 's' : ''})`
      };
    }
    
    // Calculate score based on correct cells
    const marksPerCell = totalCells > 0 ? totalMarks / totalCells : 0;
    let totalScore = Math.round(correctCells * marksPerCell * 100) / 100;
    
    // Penalize for extra selections (reduce score)
    for (const rowId of nonExampleRows) {
      const expected = correctAnswers[rowId] || [];
      const actual = studentAnswers[rowId] || [];
      const extras = actual.filter(col => !expected.includes(col)).length;
      if (extras > 0) {
        // Deduct marks for false positives
        const penalty = Math.min(extras * marksPerCell * 0.5, totalScore);
        totalScore = Math.max(0, totalScore - penalty);
      }
    }
    
    const correctRowCount = Object.values(perRowResults).filter(r => r.correct).length;
    const feedback = `${correctCells}/${totalCells} correct selections. ${correctRowCount}/${nonExampleRows.length} rows fully correct. Score: ${totalScore}/${totalMarks}`;
    
    return { totalScore, maxMarks: totalMarks, perRowResults, feedback };
  }
  
  // Per-row grading (original behavior with enhancements)
  const marksPerRow = totalMarks / nonExampleRows.length;
  let totalScore = 0;
  
  for (const rowId of nonExampleRows) {
    const expected = new Set(correctAnswers[rowId] || []);
    const actual = new Set(studentAnswers[rowId] || []);
    
    const isCorrect = expected.size === actual.size && 
                      [...expected].every(col => actual.has(col));
    
    const earned = isCorrect ? marksPerRow : 0;
    totalScore += earned;
    
    perRowResults[rowId] = { 
      correct: isCorrect, 
      earned, 
      max: marksPerRow,
      details: isCorrect ? 'Correct' : `Expected columns: ${[...expected].join(', ')}`
    };
  }
  
  totalScore = Math.round(totalScore * 100) / 100;
  const correctRowCount = Object.values(perRowResults).filter(r => r.correct).length;
  const feedback = `${correctRowCount}/${nonExampleRows.length} rows correct. Score: ${totalScore}/${totalMarks}`;
  
  return { totalScore, maxMarks: totalMarks, perRowResults, feedback };
}

// Generate answer key from table data (for use in extraction)
export function generateAnswerKeyFromTableData(
  tableData: TableGridData,
  correctSelections: Record<string, number[]>
): Record<string, Record<string, boolean>> {
  const answerKey: Record<string, Record<string, boolean>> = {};
  
  for (const row of tableData.rows) {
    if (row.isExample) continue;
    
    answerKey[row.id] = {};
    const selectedCols = correctSelections[row.id] || [];
    
    // For each column (excluding the label column at index 0)
    for (let i = 1; i < tableData.headers.length; i++) {
      answerKey[row.id][`col_${i}`] = selectedCols.includes(i);
    }
  }
  
  return answerKey;
}
