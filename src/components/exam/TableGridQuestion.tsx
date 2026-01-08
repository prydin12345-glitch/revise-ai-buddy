import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

// Enhanced TableGridData with support for both toggle and input cells
export interface TableGridColumn {
  id: string;
  label: string;
  kind: 'toggle' | 'text' | 'number' | 'display'; // 'display' = read-only prefilled values
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
  tableType?: 'tf_single' | 'grid_single' | 'grid_multi' | 'tick_cross' | 'text_entry' | 'number_entry' | 'mixed'; // Explicit table type with validation rules
  prefilled?: { rowId: string; colIndex: number; value: string; locked?: boolean }[];
  correctAnswers?: Record<string, number[] | string[]>; // For toggle columns (number[]) or text columns (string[])
  answerKey?: Record<string, Record<string, boolean | string | number>>; // New format: rowId -> colId -> value
  marksPerRow?: number;
  marks?: number;
  perRowMaxSelections?: number; // For grid_multi: max allowed selections per row
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
  correctInputs?: Record<string, Record<number, string | number>>; // For text/numeric entry tables
  answerKey?: Record<string, Record<string, boolean | string | number>>;
  markingData?: { // Persisted marking results for hydration
    perRowResults?: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }>;
    correctAnswers?: Record<string, number[]>;
    correctInputs?: Record<string, Record<number, string | number>>;
  };
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
  
  // Detect True/False table (requires single selection per row)
  const isTrueFalseTable = headerParts.some(h => 
    h.toLowerCase() === 'true' || h.toLowerCase() === 'false'
  );
  
  // Determine tableType based on structure
  // tf_single: True/False columns (exactly one per row)
  // grid_single: Other binary choice tables
  // grid_multi: Multiple selections allowed (default for tick/cross)
  const tableType: 'tf_single' | 'grid_single' | 'grid_multi' = 
    isTrueFalseTable ? 'tf_single' : 
    (headerParts.length === 3 && (headerParts[1].toLowerCase() === 'yes' || headerParts[1].toLowerCase() === 'no')) ? 'grid_single' :
    'grid_multi';
  
  // Generate columns with IDs
  const columns: TableGridColumn[] = headerParts.map((label, idx) => ({
    id: `col_${idx}`,
    label,
    kind: 'toggle' as const,
    toggleSymbol: isTrueFalseTable || markStyle === 'tick' ? '✓' : 'X'
  }));
  
  return {
    headers: headerParts,
    rows,
    columns,
    selectionMode: tableType === 'grid_multi' ? 'multi' : 'single',
    tableType,
    markStyle: isTrueFalseTable ? 'tick' : markStyle,
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
  correctInputs,
  answerKey,
  markingData
}: TableGridQuestionProps) {
  const { headers, rows, columns, selectionMode, prefilled, tableType, perRowMaxSelections } = tableData;
  
  // Determine if this is a toggle table or input table
  const isInputTable = tableType === 'text_entry' || tableType === 'number_entry' || tableType === 'mixed' ||
    selectionMode === 'text' || selectionMode === 'number' || selectionMode === 'number_text' ||
    (columns && columns.some(c => c.kind === 'text' || c.kind === 'number'));
  
  // Detect True/False table (requires exactly one selection per row - radio behavior)
  const isTrueFalseTable = headers.some(h => h.toLowerCase() === 'true' || h.toLowerCase() === 'false');
  
  // Determine effective selection mode with hard validation rules:
  // - tf_single / grid_single: exactly ONE selection per row (radio)
  // - grid_multi: multiple selections allowed (up to perRowMaxSelections if set)
  const effectiveSelectionMode = useMemo(() => {
    // Explicit tableType takes precedence
    if (tableType === 'tf_single' || tableType === 'grid_single') return 'single';
    if (tableType === 'grid_multi') return 'multi';
    
    // Infer from table structure
    if (isTrueFalseTable) return 'single'; // True/False = radio behavior
    if (selectionMode) return selectionMode;
    
    // Default to multi for generic tick/cross tables
    return 'multi';
  }, [tableType, isTrueFalseTable, selectionMode]);
  
  // Determine mark style - default to 'tick' for True/False tables
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
      const kinds: Array<'label' | 'toggle' | 'text' | 'number' | 'display'> = ['label'];
      columns.forEach((c: any) => {
        // Support both 'kind' (new) and 'type' (from generator) properties
        const kind = c.kind || c.type || 'toggle';
        // Normalize kind value
        if (kind === 'text' || kind === 'text_entry') {
          kinds.push('text');
        } else if (kind === 'number' || kind === 'number_entry') {
          kinds.push('number');
        } else if (kind === 'display') {
          kinds.push('display'); // Read-only prefilled values
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
  
  // Toggle cell selection with hard validation
  const toggleCell = useCallback((rowId: string, colIndex: number) => {
    if (readOnly || isCellLocked(rowId, colIndex)) return;
    
    const currentSelections = answers[rowId] || [];
    let newSelections: number[];
    
    // HARD VALIDATION: Enforce selection mode rules
    if (effectiveSelectionMode === 'single') {
      // Radio behavior: selecting any cell clears all others in that row
      // Clicking already-selected cell deselects it
      if (currentSelections.includes(colIndex)) {
        newSelections = []; // Allow deselection
      } else {
        newSelections = [colIndex]; // Replace any existing selection
      }
    } else {
      // Multi-select mode
      if (currentSelections.includes(colIndex)) {
        newSelections = currentSelections.filter(c => c !== colIndex);
      } else {
        // Check perRowMaxSelections limit
        if (perRowMaxSelections && currentSelections.length >= perRowMaxSelections) {
          // At max - don't add more
          return;
        }
        newSelections = [...currentSelections, colIndex];
      }
    }
    
    onAnswerChange({
      ...answers,
      [rowId]: newSelections
    }, inputAnswers);
  }, [answers, inputAnswers, onAnswerChange, readOnly, effectiveSelectionMode, perRowMaxSelections]);
  
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
  // CRITICAL: UI stores colIndex as 1-indexed (1 = first data column after label)
  // Grader/correctAnswers uses 0-indexed (0 = first data column after label)
  // We must align these for correct comparison
  const getCellStatus = (rowId: string, colIndex: number): 'correct' | 'incorrect' | 'missed' | 'partial' | null => {
    if (!showCorrectAnswers) return null;
    
    // Student selection uses 1-indexed colIndex (from UI)
    const studentSelected = isCellSelected(rowId, colIndex);
    
    // Correct answers from grader are 0-indexed, but UI colIndex is 1-indexed
    // Convert colIndex to 0-indexed for comparison with correctAnswers
    const correctAnswerColIndex = colIndex - 1;
    
    // First check markingData.perRowResults for explicit cell-level status
    if (markingData?.perRowResults?.[rowId]) {
      const rowResult = markingData.perRowResults[rowId];
      
      // Get correct answer indices (0-indexed from grader)
      const correctCols = markingData.correctAnswers?.[rowId] || correctAnswers?.[rowId] || [];
      const shouldBeSelected = correctCols.includes(correctAnswerColIndex);
      
      // Debug logging (remove after confirming fix)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[getCellStatus] Row:${rowId} Col:${colIndex} (0-idx:${correctAnswerColIndex})`, {
          studentSelected,
          shouldBeSelected,
          correctCols,
          rowStatus: rowResult.status
        });
      }
      
      if (studentSelected && shouldBeSelected) return 'correct';
      if (studentSelected && !shouldBeSelected) return 'incorrect';
      if (!studentSelected && shouldBeSelected) return 'missed';
      return null;
    }
    
    // Use answerKey if available (new format - typically uses 0-indexed)
    if (answerKey) {
      // answerKey uses col_X format where X is 0-indexed
      const colId = `col_${correctAnswerColIndex}`;
      const expected = answerKey[rowId]?.[colId];
      if (expected === true) {
        return studentSelected ? 'correct' : 'missed';
      } else if (expected === false || expected === undefined) {
        return studentSelected ? 'incorrect' : null;
      }
      return null;
    }
    
    // Fall back to legacy correctAnswers (0-indexed from grader)
    if (correctAnswers) {
      const shouldBeSelected = correctAnswers[rowId]?.includes(correctAnswerColIndex) || false;
      
      if (studentSelected && shouldBeSelected) return 'correct';
      if (studentSelected && !shouldBeSelected) return 'incorrect';
      if (!studentSelected && shouldBeSelected) return 'missed';
    }
    
    return null;
  };
  
  // Get input cell status for text/numeric entry tables
  // Same indexing fix: UI uses 1-indexed, grader uses 0-indexed
  const getInputCellStatus = (rowId: string, colIndex: number): 'correct' | 'incorrect' | 'missed' | null => {
    if (!showCorrectAnswers) return null;
    
    // UI colIndex is 1-indexed, correctInputs from grader is 0-indexed
    const correctInputColIndex = colIndex - 1;
    
    const studentValue = getInputValue(rowId, colIndex);
    const hasAnswer = studentValue !== '' && studentValue !== null && studentValue !== undefined;
    
    // Use markingData for hydrated status
    if (markingData?.perRowResults?.[rowId]) {
      const rowResult = markingData.perRowResults[rowId];
      
      // Check against correct inputs (0-indexed)
      const expectedValue = (markingData.correctInputs || correctInputs)?.[rowId]?.[correctInputColIndex];
      
      // Debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log(`[getInputCellStatus] Row:${rowId} Col:${colIndex} (0-idx:${correctInputColIndex})`, {
          studentValue,
          expectedValue,
          hasAnswer,
          rowStatus: rowResult.status
        });
      }
      
      if (expectedValue !== undefined) {
        // Normalize and compare
        const normalizedStudent = String(studentValue).trim().toLowerCase();
        const normalizedExpected = Array.isArray(expectedValue) 
          ? expectedValue.map(v => String(v).trim().toLowerCase())
          : [String(expectedValue).trim().toLowerCase()];
        
        const isMatch = normalizedExpected.some(exp => 
          normalizedStudent === exp || 
          normalizedStudent.includes(exp) || 
          exp.includes(normalizedStudent)
        );
        
        if (isMatch) return 'correct';
        if (hasAnswer) return 'incorrect';
        return 'missed';
      }
      
      // If row is correct but no specific expected value for this cell, 
      // and student has answer, consider it correct
      if (rowResult.status === 'correct' && hasAnswer) return 'correct';
      if (rowResult.status === 'missed' && !hasAnswer) return 'missed';
      if (hasAnswer) return 'incorrect';
      return null;
    }
    
    // Check against correctInputs directly (0-indexed)
    if (correctInputs) {
      const expectedValue = correctInputs[rowId]?.[correctInputColIndex];
      if (expectedValue !== undefined) {
        const normalizedStudent = String(studentValue).trim().toLowerCase();
        const normalizedExpected = Array.isArray(expectedValue)
          ? expectedValue.map(v => String(v).trim().toLowerCase())
          : [String(expectedValue).trim().toLowerCase()];
        
        const isMatch = normalizedExpected.some(exp => normalizedStudent === exp);
        if (isMatch) return 'correct';
        if (hasAnswer) return 'incorrect';
        return 'missed';
      }
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
                  
                  // Display cell - read-only prefilled value (for given data in calculation tables)
                  if (columnKind === 'display' || isLocked) {
                    const displayValue = lockedValue || getInputValue(row.id, colIndex) || '';
                    return (
                      <td 
                        key={`${row.id}-${colIndex}`}
                        className="border border-border px-4 py-3 bg-muted/30"
                      >
                        <span className="text-sm font-medium text-foreground/90">
                          {displayValue}
                        </span>
                      </td>
                    );
                  }
                  
                  // Input cell (text or number)
                  if (columnKind === 'text' || columnKind === 'number') {
                    const inputStatus = getInputCellStatus(row.id, colIndex);
                    return (
                      <td 
                        key={`${row.id}-${colIndex}`}
                        className="border border-border p-1"
                      >
                        <Input
                          type={columnKind === 'number' ? 'number' : 'text'}
                          step={columnKind === 'number' ? '0.01' : undefined}
                          value={getInputValue(row.id, colIndex)}
                          onChange={(e) => updateInputCell(row.id, colIndex, 
                            columnKind === 'number' ? e.target.value : e.target.value
                          )}
                          disabled={readOnly || isExampleRow}
                          className={cn(
                            "h-10",
                            inputStatus === 'correct' && "border-green-500 bg-green-50 dark:bg-green-900/20 border-2",
                            inputStatus === 'incorrect' && "border-red-500 bg-red-50 dark:bg-red-900/20 border-2",
                            inputStatus === 'missed' && "border-amber-500 bg-amber-50 dark:bg-amber-900/20 border-2 border-dashed"
                          )}
                          placeholder="..."
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

// Table type definitions for validation
export type TableQuestionType = 'tf_single' | 'grid_single' | 'grid_multi' | 'text_entry' | 'numeric_entry';

// Validate and sanitize table grid answers based on table type
// Returns sanitized answers and any validation errors
export function validateTableGridAnswers(
  answers: Record<string, number[]>,
  tableType: TableQuestionType,
  headers: string[]
): { sanitized: Record<string, number[]>; errors: string[] } {
  const sanitized: Record<string, number[]> = {};
  const errors: string[] = [];
  const numCols = headers.length - 1; // Exclude label column
  
  for (const [rowId, selections] of Object.entries(answers)) {
    // Filter out invalid column indices
    const validSelections = selections.filter(col => col >= 1 && col <= numCols);
    
    if (tableType === 'tf_single' || tableType === 'grid_single') {
      // HARD VALIDATION: Only one selection allowed per row
      if (validSelections.length > 1) {
        errors.push(`Row "${rowId}": Multiple selections not allowed, keeping only first`);
        sanitized[rowId] = [validSelections[0]]; // Keep only the first selection
      } else {
        sanitized[rowId] = validSelections;
      }
    } else {
      // Multi-select: keep all valid selections
      sanitized[rowId] = validSelections;
    }
  }
  
  return { sanitized, errors };
}

// Detect table type from question content and structure
export function detectTableType(
  headers: string[],
  questionText: string
): TableQuestionType {
  const headerLower = headers.map(h => h.toLowerCase());
  const questionLower = questionText.toLowerCase();
  
  // True/False detection
  if (headerLower.includes('true') && headerLower.includes('false')) {
    return 'tf_single';
  }
  
  // Yes/No or other binary choices (2 data columns)
  if (headers.length === 3) { // label + 2 options
    const col1 = headerLower[1];
    const col2 = headerLower[2];
    if ((col1 === 'yes' && col2 === 'no') || 
        (col1 === 'no' && col2 === 'yes') ||
        (col1 === 'a' && col2 === 'b')) {
      return 'grid_single';
    }
  }
  
  // Text entry detection
  if (questionLower.includes('type your answer') || 
      questionLower.includes('enter the') ||
      questionLower.includes('write the')) {
    return 'text_entry';
  }
  
  // Numeric entry detection
  if (questionLower.includes('calculate') || 
      questionLower.includes('numerical')) {
    return 'numeric_entry';
  }
  
  // Default to grid_multi for tick/cross tables
  return 'grid_multi';
}

// Deterministic grading for table_grid questions with partial marks
// Supports different table types with appropriate scoring rules
export function gradeTableGrid(
  studentAnswers: Record<string, number[]>,
  correctAnswers: Record<string, number[]>,
  totalMarks: number,
  options: {
    tableType?: TableQuestionType;
    gradingMode?: 'perCell' | 'perRow';
    headers?: string[];
  } = {}
): {
  totalScore: number;
  maxMarks: number;
  perRowResults: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }>;
  feedback: string;
} {
  const { tableType = 'grid_multi', gradingMode = 'perRow', headers = [] } = options;
  const perRowResults: Record<string, { correct: boolean; earned: number; max: number; details: string; status: 'correct' | 'incorrect' | 'missed' | 'partial' }> = {};
  const nonExampleRows = Object.keys(correctAnswers);
  
  if (nonExampleRows.length === 0) {
    return { totalScore: 0, maxMarks: totalMarks, perRowResults, feedback: 'No gradable rows found' };
  }
  
  // Validate and sanitize student answers first
  const { sanitized: sanitizedAnswers, errors } = validateTableGridAnswers(
    studentAnswers, 
    tableType, 
    headers.length > 0 ? headers : ['Label', 'Col1', 'Col2'] // Fallback
  );
  
  if (errors.length > 0) {
    console.warn('Table answer validation errors:', errors);
  }
  
  const marksPerRow = totalMarks / nonExampleRows.length;
  let totalScore = 0;
  
  // TF_SINGLE and GRID_SINGLE: Exactly one selection per row (radio behavior)
  // Each row: correct = full marks, wrong = 0, unanswered = missed (0)
  if (tableType === 'tf_single' || tableType === 'grid_single') {
    for (const rowId of nonExampleRows) {
      const expected = correctAnswers[rowId] || [];
      const actual = sanitizedAnswers[rowId] || [];
      
      if (actual.length === 0) {
        // Unanswered
        perRowResults[rowId] = {
          correct: false,
          earned: 0,
          max: marksPerRow,
          details: 'No selection made',
          status: 'missed'
        };
      } else if (expected.length === 1 && actual.length === 1 && expected[0] === actual[0]) {
        // Correct single selection
        totalScore += marksPerRow;
        perRowResults[rowId] = {
          correct: true,
          earned: marksPerRow,
          max: marksPerRow,
          details: 'Correct',
          status: 'correct'
        };
      } else {
        // Wrong selection
        perRowResults[rowId] = {
          correct: false,
          earned: 0,
          max: marksPerRow,
          details: 'Incorrect selection',
          status: 'incorrect'
        };
      }
    }
  }
  // GRID_MULTI: Multiple selections with anti-"select all" scoring
  // score = max(0, correctSelected - incorrectSelected) / correctCount * rowMarks
  else if (tableType === 'grid_multi') {
    for (const rowId of nonExampleRows) {
      const expected = new Set(correctAnswers[rowId] || []);
      const actual = new Set(sanitizedAnswers[rowId] || []);
      
      if (actual.size === 0 && expected.size > 0) {
        // Unanswered but expected selections
        perRowResults[rowId] = {
          correct: false,
          earned: 0,
          max: marksPerRow,
          details: 'No selections made',
          status: 'missed'
        };
        continue;
      }
      
      // Count correct and incorrect selections
      let correctCount = 0;
      let incorrectCount = 0;
      
      for (const col of actual) {
        if (expected.has(col)) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
      
      // F1-like scoring: penalize incorrect selections
      const rawScore = Math.max(0, correctCount - incorrectCount);
      const normalizedScore = expected.size > 0 ? (rawScore / expected.size) * marksPerRow : 0;
      const cappedScore = Math.min(normalizedScore, marksPerRow);
      const roundedScore = Math.round(cappedScore * 100) / 100;
      
      totalScore += roundedScore;
      
      const isFullyCorrect = correctCount === expected.size && incorrectCount === 0;
      const isPartial = correctCount > 0 && (correctCount < expected.size || incorrectCount > 0);
      
      perRowResults[rowId] = {
        correct: isFullyCorrect,
        earned: roundedScore,
        max: marksPerRow,
        details: isFullyCorrect ? 'Correct' : 
                 isPartial ? `Partial: ${correctCount} correct, ${incorrectCount} incorrect` :
                 'Incorrect',
        status: isFullyCorrect ? 'correct' : isPartial ? 'partial' : 'incorrect'
      };
    }
  }
  // Default per-row grading for other types
  else {
    for (const rowId of nonExampleRows) {
      const expected = new Set(correctAnswers[rowId] || []);
      const actual = new Set(sanitizedAnswers[rowId] || []);
      
      const isCorrect = expected.size === actual.size && 
                        [...expected].every(col => actual.has(col));
      
      const earned = isCorrect ? marksPerRow : 0;
      totalScore += earned;
      
      perRowResults[rowId] = { 
        correct: isCorrect, 
        earned, 
        max: marksPerRow,
        details: isCorrect ? 'Correct' : `Expected columns: ${[...expected].join(', ')}`,
        status: isCorrect ? 'correct' : actual.size === 0 ? 'missed' : 'incorrect'
      };
    }
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
