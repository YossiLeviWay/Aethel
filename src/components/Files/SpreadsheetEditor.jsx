import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Minus, FunctionSquare, Maximize2, Minimize2, Calculator, Merge, Paintbrush, Palette } from 'lucide-react';
import './Editors.css';

function getColLetter(index) {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const row = parseInt(match[2], 10) - 1;
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1;
  return { col, row };
}

function parseRange(rangeStr) {
  const parts = rangeStr.split(':');
  if (parts.length !== 2) return null;
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return null;
  return { start, end };
}

function getCellValue(cells, cellRef) {
  const cell = cells[cellRef];
  if (!cell) return 0;
  if (cell.formula) {
    const result = evaluateFormula(cell.formula, cells);
    return typeof result === 'number' ? result : 0;
  }
  const num = parseFloat(cell.value);
  return isNaN(num) ? 0 : num;
}

function getRangeValues(cells, rangeStr) {
  const range = parseRange(rangeStr);
  if (!range) return [];
  const values = [];
  const minCol = Math.min(range.start.col, range.end.col);
  const maxCol = Math.max(range.start.col, range.end.col);
  const minRow = Math.min(range.start.row, range.end.row);
  const maxRow = Math.max(range.start.row, range.end.row);
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      const ref = getColLetter(c) + (r + 1);
      values.push(getCellValue(cells, ref));
    }
  }
  return values;
}

function evaluateFormula(formula, cells, visited = new Set()) {
  if (!formula || !formula.startsWith('=')) return formula;
  const expr = formula.substring(1).trim().toUpperCase();

  const funcMatch = expr.match(/^(SUM|AVG|AVERAGE|COUNT|MAX|MIN|MEDIAN|MULTIPLY|DIVIDE|SUB|SUBTRACT)\((.+)\)$/);
  if (funcMatch) {
    const func = funcMatch[1];
    const arg = funcMatch[2].trim();
    const values = arg.includes(':')
      ? getRangeValues(cells, arg)
      : arg.split(',').map(a => {
          const trimmed = a.trim();
          const ref = parseCellRef(trimmed);
          if (ref) return getCellValue(cells, trimmed);
          const n = parseFloat(trimmed);
          return isNaN(n) ? 0 : n;
        });

    switch (func) {
      case 'SUM': return values.reduce((a, b) => a + b, 0);
      case 'AVG': case 'AVERAGE': return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'COUNT': return values.length;
      case 'MAX': return values.length ? Math.max(...values) : 0;
      case 'MIN': return values.length ? Math.min(...values) : 0;
      case 'MEDIAN': {
        if (!values.length) return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'MULTIPLY': return values.length ? values.reduce((a, b) => a * b, 1) : 0;
      case 'DIVIDE': {
        if (values.length < 2) return '#ERR';
        if (values[1] === 0) return '#DIV/0';
        return values[0] / values[1];
      }
      case 'SUB': case 'SUBTRACT': return values.length < 2 ? '#ERR' : values[0] - values[1];
      default: return '#ERR';
    }
  }

  const singleRef = parseCellRef(expr);
  if (singleRef) {
    if (visited.has(expr)) return '#CIRC';
    visited.add(expr);
    return getCellValue(cells, expr);
  }

  try {
    let replaced = expr.replace(/[A-Z]+\d+/g, (match) => {
      if (visited.has(match)) return '0';
      return getCellValue(cells, match);
    });
    if (/^[\d\s+\-*/().]+$/.test(replaced)) {
      const result = Function('"use strict"; return (' + replaced + ')')();
      return typeof result === 'number' && isFinite(result) ? result : '#ERR';
    }
  } catch { /* fall through */ }

  return '#ERR';
}

function getDisplayValue(cell, cells) {
  if (!cell) return '';
  if (cell.formula) {
    const result = evaluateFormula(cell.formula, cells);
    if (typeof result === 'number') {
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    }
    return String(result);
  }
  return cell.value || '';
}

const CALC_FUNCTIONS = [
  { id: 'sum', label: 'סכום', syntax: 'SUM', icon: '+' },
  { id: 'sub', label: 'חיסור', syntax: 'SUBTRACT', icon: '−' },
  { id: 'avg', label: 'ממוצע', syntax: 'AVERAGE', icon: 'x̄' },
  { id: 'median', label: 'חציון', syntax: 'MEDIAN', icon: 'M' },
  { id: 'multiply', label: 'כפל', syntax: 'MULTIPLY', icon: '×' },
  { id: 'divide', label: 'חילוק', syntax: 'DIVIDE', icon: '÷' },
  { id: 'min', label: 'מינימום', syntax: 'MIN', icon: '↓' },
  { id: 'max', label: 'מקסימום', syntax: 'MAX', icon: '↑' },
  { id: 'count', label: 'ספירה', syntax: 'COUNT', icon: '#' },
];

const CELL_COLORS = [
  '#ffffff', '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4', '#ecfdf5',
  '#f0f9ff', '#eff6ff', '#f5f3ff', '#fdf2f8', '#f1f5f9', '#e2e8f0',
];

const TEXT_COLORS = [
  '#1e293b', '#ef4444', '#f59e0b', '#16a34a', '#2563eb', '#8b5cf6',
  '#ec4899', '#14b8a6', '#64748b', '#a16207',
];

export default function SpreadsheetEditor({ data, onChange, readOnly = false, onToggleFullscreen, isFullscreen }) {
  const initialData = data || { columns: 5, rows: 10, cells: {}, headers: {}, columnWidths: {}, rowHeights: {}, mergedCells: [], cellStyles: {} };
  const [cells, setCells] = useState(initialData.cells || {});
  const [headers, setHeaders] = useState(initialData.headers || {});
  const [numCols, setNumCols] = useState(initialData.columns || 5);
  const [numRows, setNumRows] = useState(initialData.rows || 10);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [formulaValue, setFormulaValue] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const [columnWidths, setColumnWidths] = useState(initialData.columnWidths || {});
  const [rowHeights, setRowHeights] = useState(initialData.rowHeights || {});
  const [showCalcMenu, setShowCalcMenu] = useState(false);
  const [selection, setSelection] = useState(null);
  const [mergedCells, setMergedCells] = useState(initialData.mergedCells || []);
  const [cellStyles, setCellStyles] = useState(initialData.cellStyles || {});
  const [showCellColorPicker, setShowCellColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [formulaSelectMode, setFormulaSelectMode] = useState(false); // true when user is building formula by clicking cells
  const [isDragging, setIsDragging] = useState(false);
  const saveTimerRef = useRef(null);
  const cellInputRef = useRef(null);
  const formulaInputRef = useRef(null);
  const tableRef = useRef(null);

  const triggerSave = useCallback((newCells, newHeaders, cols, rows, colWidths, rHeights, merged, styles) => {
    setSaveStatus('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onChange?.({
        columns: cols,
        rows: rows,
        cells: newCells,
        headers: newHeaders,
        columnWidths: colWidths || columnWidths,
        rowHeights: rHeights || rowHeights,
        mergedCells: merged || mergedCells,
        cellStyles: styles || cellStyles,
      });
      setSaveStatus('saved');
    }, 800);
  }, [onChange, columnWidths, rowHeights, mergedCells, cellStyles]);

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  useEffect(() => {
    if (selectedCell && !formulaSelectMode) {
      const cell = cells[selectedCell];
      setFormulaValue(cell?.formula || cell?.value || '');
    } else if (!selectedCell) {
      setFormulaValue('');
    }
  }, [selectedCell, cells]);

  // Check if a cell is part of a merge (but not the origin)
  function getMergeForCell(ri, ci) {
    return mergedCells.find(m =>
      ri >= m.startRow && ri <= m.endRow && ci >= m.startCol && ci <= m.endCol
    );
  }

  function isMergeOrigin(ri, ci) {
    return mergedCells.some(m => m.startRow === ri && m.startCol === ci);
  }

  function isMergedButNotOrigin(ri, ci) {
    const merge = getMergeForCell(ri, ci);
    if (!merge) return false;
    return !(merge.startRow === ri && merge.startCol === ci);
  }

  function handleCellClick(cellRef, ri, ci, e) {
    if (readOnly) return;

    // If in formula select mode, append cell ref to formula
    if (formulaSelectMode && editingCell) {
      const currentVal = formulaValue;
      // Check last char - if it's an operator or open paren, just append ref
      const lastChar = currentVal.slice(-1);
      let newVal;
      if (lastChar === '(' || lastChar === ',' || lastChar === '+' || lastChar === '-' || lastChar === '*' || lastChar === '/') {
        newVal = currentVal + cellRef;
      } else {
        newVal = currentVal + ',' + cellRef;
      }
      setFormulaValue(newVal);
      return;
    }

    setSelectedCell(cellRef);
    setEditingCell(null);
    if (e?.shiftKey && selection) {
      setSelection(prev => ({ ...prev, endRow: ri, endCol: ci }));
    } else {
      setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    }
    setTimeout(() => {
      tableRef.current?.querySelector(`td[data-ref="${cellRef}"]`)?.focus();
    }, 0);
  }

  function handleCellDoubleClick(cellRef) {
    if (readOnly) return;
    setSelectedCell(cellRef);
    setEditingCell(cellRef);
    setFormulaSelectMode(false);
    const cell = cells[cellRef];
    setFormulaValue(cell?.formula || cell?.value || '');
    setTimeout(() => cellInputRef.current?.focus(), 0);
  }

  function commitCell(cellRef, rawValue) {
    const newCells = { ...cells };
    const trimmed = (rawValue || '').trim();
    if (!trimmed) {
      delete newCells[cellRef];
    } else if (trimmed.startsWith('=')) {
      newCells[cellRef] = { ...newCells[cellRef], value: '', formula: trimmed };
    } else {
      newCells[cellRef] = { ...newCells[cellRef], value: trimmed, formula: '' };
    }
    setCells(newCells);
    setEditingCell(null);
    setFormulaSelectMode(false);
    triggerSave(newCells, headers, numCols, numRows);
  }

  function navigateTo(row, col, extendSelection = false) {
    if (row < 0 || col < 0 || row >= numRows || col >= numCols) return;
    const ref = getColLetter(col) + (row + 1);
    setSelectedCell(ref);
    setEditingCell(null);
    if (extendSelection && selection) {
      setSelection(prev => ({ ...prev, endRow: row, endCol: col }));
    } else {
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
    }
    setTimeout(() => {
      tableRef.current?.querySelector(`td[data-ref="${ref}"]`)?.focus();
    }, 0);
  }

  function handleCellKeyDown(e, cellRef) {
    const ref = parseCellRef(cellRef);
    if (!ref) return;

    if (editingCell === cellRef) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitCell(cellRef, formulaValue);
        if (ref.row + 1 < numRows) navigateTo(ref.row + 1, ref.col);
      } else if (e.key === 'Escape') {
        setEditingCell(null);
        setFormulaSelectMode(false);
        const cell = cells[cellRef];
        setFormulaValue(cell?.formula || cell?.value || '');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitCell(cellRef, formulaValue);
        const nextCol = e.shiftKey ? ref.col - 1 : ref.col + 1;
        if (nextCol >= 0 && nextCol < numCols) navigateTo(ref.row, nextCol);
      }
    } else {
      const shift = e.shiftKey;
      if (e.key === 'ArrowDown') { e.preventDefault(); navigateTo(ref.row + 1, ref.col, shift); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); navigateTo(ref.row - 1, ref.col, shift); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); navigateTo(ref.row, ref.col - 1, shift); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); navigateTo(ref.row, ref.col + 1, shift); }
      else if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        setEditingCell(cellRef);
        const cell = cells[cellRef];
        setFormulaValue(cell?.formula || cell?.value || '');
        setTimeout(() => cellInputRef.current?.focus(), 0);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const nextCol = e.shiftKey ? ref.col - 1 : ref.col + 1;
        if (nextCol >= 0 && nextCol < numCols) navigateTo(ref.row, nextCol);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        commitCell(cellRef, '');
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setEditingCell(cellRef);
        // If typing '=', enter formula select mode
        if (e.key === '=') {
          setFormulaSelectMode(true);
        }
        setFormulaValue(e.key);
        setTimeout(() => cellInputRef.current?.focus(), 0);
      }
    }
  }

  function handleFormulaBarKeyDown(e) {
    if (e.key === 'Enter' && selectedCell) {
      e.preventDefault();
      commitCell(selectedCell, formulaValue);
    } else if (e.key === 'Escape') {
      setFormulaSelectMode(false);
      const cell = cells[selectedCell];
      setFormulaValue(cell?.formula || cell?.value || '');
      formulaInputRef.current?.blur();
    }
  }

  function handleFormulaBarChange(e) {
    const val = e.target.value;
    setFormulaValue(val);
    // Enable formula select mode when typing starts with '='
    if (val.startsWith('=') && val.length > 1) {
      setFormulaSelectMode(true);
    } else {
      setFormulaSelectMode(false);
    }
  }

  function handleFormulaBarFocus() {
    if (selectedCell) {
      setEditingCell(selectedCell);
    }
  }

  function handleHeaderChange(colIndex, value) {
    const newHeaders = { ...headers, [colIndex]: value };
    setHeaders(newHeaders);
    triggerSave(cells, newHeaders, numCols, numRows);
  }

  function addColumn() {
    const newCols = numCols + 1;
    setNumCols(newCols);
    triggerSave(cells, headers, newCols, numRows);
  }
  function removeColumn() {
    if (numCols <= 1) return;
    const removedLetter = getColLetter(numCols - 1);
    const newCells = { ...cells };
    for (let r = 1; r <= numRows; r++) delete newCells[removedLetter + r];
    const newHeaders = { ...headers };
    delete newHeaders[numCols - 1];
    const newCols = numCols - 1;
    setCells(newCells);
    setHeaders(newHeaders);
    setNumCols(newCols);
    if (selectedCell) { const ref = parseCellRef(selectedCell); if (ref && ref.col >= newCols) { setSelectedCell(null); setEditingCell(null); } }
    triggerSave(newCells, newHeaders, newCols, numRows);
  }
  function addRow() {
    const newRows = numRows + 1;
    setNumRows(newRows);
    triggerSave(cells, headers, numCols, newRows);
  }
  function removeRow() {
    if (numRows <= 1) return;
    const newCells = { ...cells };
    for (let c = 0; c < numCols; c++) delete newCells[getColLetter(c) + numRows];
    const newRows = numRows - 1;
    setCells(newCells);
    setNumRows(newRows);
    if (selectedCell) { const ref = parseCellRef(selectedCell); if (ref && ref.row >= newRows) { setSelectedCell(null); setEditingCell(null); } }
    triggerSave(newCells, headers, numCols, newRows);
  }

  // Column/Row resize
  const handleColumnResize = useCallback((colIndex, e) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[colIndex] || 100;
    function onMouseMove(ev) { setColumnWidths(prev => ({ ...prev, [colIndex]: Math.max(40, startWidth - (ev.clientX - startX)) })); }
    function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
      setColumnWidths(prev => { triggerSave(cells, headers, numCols, numRows, prev, rowHeights); return prev; }); }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths, cells, headers, numCols, numRows, rowHeights, triggerSave]);

  const handleRowResize = useCallback((rowIndex, e) => {
    e.preventDefault(); e.stopPropagation();
    const startY = e.clientY;
    const startHeight = rowHeights[rowIndex] || 32;
    function onMouseMove(ev) { setRowHeights(prev => ({ ...prev, [rowIndex]: Math.max(20, startHeight + (ev.clientY - startY)) })); }
    function onMouseUp() { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);
      setRowHeights(prev => { triggerSave(cells, headers, numCols, numRows, columnWidths, prev); return prev; }); }
    document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);
  }, [rowHeights, cells, headers, numCols, numRows, columnWidths, triggerSave]);

  // Mouse drag selection
  function handleCellMouseDown(ri, ci, e) {
    if (readOnly || e.button !== 0 || formulaSelectMode) return;
    if (!e.shiftKey) {
      setIsDragging(true);
      setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    }
  }

  function handleCellMouseEnter(ri, ci) {
    if (!isDragging) return;
    setSelection(prev => prev ? { ...prev, endRow: ri, endCol: ci } : null);
  }

  useEffect(() => {
    if (!isDragging) return;
    function onMouseUp() { setIsDragging(false); }
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [isDragging]);

  // Merge cells
  function handleMergeCells() {
    if (!selection) return;
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    if (minR === maxR && minC === maxC) return; // single cell

    // Check if already merged - if so, unmerge
    const existingIdx = mergedCells.findIndex(m =>
      m.startRow === minR && m.endRow === maxR && m.startCol === minC && m.endCol === maxC
    );
    let newMerged;
    if (existingIdx >= 0) {
      newMerged = mergedCells.filter((_, i) => i !== existingIdx);
    } else {
      // Remove any overlapping merges
      newMerged = mergedCells.filter(m => {
        return m.endRow < minR || m.startRow > maxR || m.endCol < minC || m.startCol > maxC;
      });
      newMerged.push({ startRow: minR, endRow: maxR, startCol: minC, endCol: maxC });
    }
    setMergedCells(newMerged);
    triggerSave(cells, headers, numCols, numRows, columnWidths, rowHeights, newMerged, cellStyles);
  }

  // Cell background color
  function applyCellColor(color) {
    if (!selection) return;
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    const newStyles = { ...cellStyles };
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r}-${c}`;
        newStyles[key] = { ...(newStyles[key] || {}), bg: color };
      }
    }
    setCellStyles(newStyles);
    setShowCellColorPicker(false);
    triggerSave(cells, headers, numCols, numRows, columnWidths, rowHeights, mergedCells, newStyles);
  }

  // Text color
  function applyTextColor(color) {
    if (!selection) return;
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    const newStyles = { ...cellStyles };
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${r}-${c}`;
        newStyles[key] = { ...(newStyles[key] || {}), color: color };
      }
    }
    setCellStyles(newStyles);
    setShowTextColorPicker(false);
    triggerSave(cells, headers, numCols, numRows, columnWidths, rowHeights, mergedCells, newStyles);
  }

  function insertCalcFormula(calcId) {
    if (!selectedCell) return;
    const fn = CALC_FUNCTIONS.find(c => c.id === calcId);
    if (!fn) return;
    if (selection && (selection.startRow !== selection.endRow || selection.startCol !== selection.endCol)) {
      const startRef = getColLetter(Math.min(selection.startCol, selection.endCol)) + (Math.min(selection.startRow, selection.endRow) + 1);
      const endRef = getColLetter(Math.max(selection.startCol, selection.endCol)) + (Math.max(selection.startRow, selection.endRow) + 1);
      const formula = `=${fn.syntax}(${startRef}:${endRef})`;
      setFormulaValue(formula);
      setEditingCell(selectedCell);
    } else {
      setFormulaValue(`=${fn.syntax}(`);
      setEditingCell(selectedCell);
      setFormulaSelectMode(true);
      setTimeout(() => formulaInputRef.current?.focus(), 0);
    }
    setShowCalcMenu(false);
  }

  function getSelectionStats() {
    if (!selection) return null;
    const nums = [];
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const ref = getColLetter(c) + (r + 1);
        const cell = cells[ref];
        if (cell) {
          const val = cell.formula ? evaluateFormula(cell.formula, cells) : parseFloat(cell.value);
          if (typeof val === 'number' && !isNaN(val)) nums.push(val);
        }
      }
    }
    if (nums.length < 2) return null;
    const sum = nums.reduce((a, b) => a + b, 0);
    return { sum: sum.toFixed(2), avg: (sum / nums.length).toFixed(2), count: nums.length };
  }

  const stats = getSelectionStats();

  return (
    <div className={`spreadsheet-editor ${isFullscreen ? 'spreadsheet-editor--fullscreen' : ''}`}>
      {!readOnly && (
        <div className="spreadsheet-toolbar">
          <button className="toolbar-btn" onClick={addColumn} title="הוסף עמודה"><Plus size={14} /> עמודה</button>
          <button className="toolbar-btn toolbar-btn--danger" onClick={removeColumn} disabled={numCols <= 1} title="הסר עמודה"><Minus size={14} /> עמודה</button>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={addRow} title="הוסף שורה"><Plus size={14} /> שורה</button>
          <button className="toolbar-btn toolbar-btn--danger" onClick={removeRow} disabled={numRows <= 1} title="הסר שורה"><Minus size={14} /> שורה</button>
          <div className="toolbar-separator" />
          <div style={{ position: 'relative' }}>
            <button className="toolbar-btn" onClick={() => { setShowCalcMenu(!showCalcMenu); setShowCellColorPicker(false); setShowTextColorPicker(false); }} title="חישובים">
              <Calculator size={14} /> חישובים
            </button>
            {showCalcMenu && (
              <div className="calc-menu">
                {CALC_FUNCTIONS.map(fn => (
                  <button key={fn.id} className="calc-menu-item" onClick={() => insertCalcFormula(fn.id)}>
                    <span className="calc-menu-icon">{fn.icon}</span>
                    <span>{fn.label}</span>
                    <span className="calc-menu-syntax">{fn.syntax}()</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={handleMergeCells} title="מזג/בטל מיזוג תאים" disabled={!selection}>
            <Merge size={14} /> מיזוג
          </button>
          <div className="toolbar-separator" />
          <div style={{ position: 'relative' }}>
            <button className="toolbar-btn" onClick={() => { setShowCellColorPicker(!showCellColorPicker); setShowCalcMenu(false); setShowTextColorPicker(false); }} title="צבע רקע תא">
              <Paintbrush size={14} />
            </button>
            {showCellColorPicker && (
              <div className="color-picker-popup">
                {CELL_COLORS.map(c => (
                  <button key={c} className="color-swatch-btn" style={{ background: c }} onClick={() => applyCellColor(c)} />
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="toolbar-btn" onClick={() => { setShowTextColorPicker(!showTextColorPicker); setShowCalcMenu(false); setShowCellColorPicker(false); }} title="צבע טקסט">
              <Palette size={14} />
            </button>
            {showTextColorPicker && (
              <div className="color-picker-popup">
                {TEXT_COLORS.map(c => (
                  <button key={c} className="color-swatch-btn" style={{ background: c }} onClick={() => applyTextColor(c)} />
                ))}
              </div>
            )}
          </div>
          {onToggleFullscreen && (
            <>
              <div className="toolbar-separator" />
              <button className="toolbar-btn" onClick={onToggleFullscreen} title={isFullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}>
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </>
          )}
        </div>
      )}

      {/* Formula Bar */}
      <div className="formula-bar">
        <span className="cell-ref">{selectedCell || '-'}</span>
        <FunctionSquare size={14} className="formula-icon" />
        <input
          ref={formulaInputRef}
          className={`formula-input ${formulaSelectMode ? 'formula-input--selecting' : ''}`}
          value={formulaValue}
          onChange={handleFormulaBarChange}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={handleFormulaBarFocus}
          onBlur={() => {
            if (selectedCell && editingCell && !formulaSelectMode) {
              commitCell(selectedCell, formulaValue);
            }
          }}
          placeholder="נוסחה או ערך... (=SUM, =AVERAGE, =MEDIAN...)"
          disabled={readOnly || !selectedCell}
          dir="ltr"
        />
        {formulaSelectMode && (
          <button className="formula-confirm-btn" onClick={() => { if (selectedCell) commitCell(selectedCell, formulaValue); }}>
            ✓
          </button>
        )}
      </div>

      {/* Spreadsheet Grid */}
      <div className="spreadsheet-container" dir="rtl">
        <table className="spreadsheet-table" ref={tableRef}>
          <thead>
            <tr>
              <th className="corner-header">#</th>
              {Array.from({ length: numCols }, (_, ci) => (
                <th key={ci} className="col-header" style={{ width: columnWidths[ci] || 100 }}>
                  <span className="col-letter">{getColLetter(ci)}</span>
                  <input value={headers[ci] || ''} onChange={(e) => handleHeaderChange(ci, e.target.value)} placeholder={getColLetter(ci)} disabled={readOnly} />
                  <div className="col-resize-handle" onMouseDown={(e) => handleColumnResize(ci, e)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }, (_, ri) => (
              <tr key={ri} style={{ height: rowHeights[ri] || 32 }}>
                <td className="row-header" style={{ position: 'relative' }}>
                  {ri + 1}
                  <div className="row-resize-handle" onMouseDown={(e) => handleRowResize(ri, e)} />
                </td>
                {Array.from({ length: numCols }, (_, ci) => {
                  // Skip merged cells that aren't the origin
                  if (isMergedButNotOrigin(ri, ci)) return null;

                  const merge = getMergeForCell(ri, ci);
                  const colSpan = merge ? (merge.endCol - merge.startCol + 1) : 1;
                  const rowSpan = merge ? (merge.endRow - merge.startRow + 1) : 1;

                  const cellRefStr = getColLetter(ci) + (ri + 1);
                  const isSelected = selectedCell === cellRefStr;
                  const isEditing = editingCell === cellRefStr;
                  const cell = cells[cellRefStr];
                  const displayVal = getDisplayValue(cell, cells);
                  const isFormula = !!cell?.formula;
                  const isError = displayVal === '#ERR' || displayVal === '#CIRC' || displayVal === '#DIV/0';
                  const inSelection = selection && ri >= Math.min(selection.startRow, selection.endRow) &&
                    ri <= Math.max(selection.startRow, selection.endRow) &&
                    ci >= Math.min(selection.startCol, selection.endCol) &&
                    ci <= Math.max(selection.startCol, selection.endCol);

                  const style = cellStyles[`${ri}-${ci}`] || {};

                  return (
                    <td
                      key={ci}
                      className={`cell${isSelected ? ' cell--selected' : ''}${inSelection && !isSelected ? ' cell--in-selection' : ''}`}
                      data-ref={cellRefStr}
                      colSpan={colSpan > 1 ? colSpan : undefined}
                      rowSpan={rowSpan > 1 ? rowSpan : undefined}
                      onClick={(e) => handleCellClick(cellRefStr, ri, ci, e)}
                      onDoubleClick={() => handleCellDoubleClick(cellRefStr)}
                      onKeyDown={(e) => handleCellKeyDown(e, cellRefStr)}
                      onMouseDown={(e) => handleCellMouseDown(ri, ci, e)}
                      onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                      tabIndex={isSelected ? 0 : -1}
                      style={{
                        width: columnWidths[ci] || 100,
                        height: rowHeights[ri] || 32,
                        background: style.bg || undefined,
                        color: style.color || undefined,
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={cellInputRef}
                          className="cell-input"
                          value={formulaValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormulaValue(val);
                            if (val.startsWith('=') && val.length > 1) setFormulaSelectMode(true);
                          }}
                          onKeyDown={(e) => handleCellKeyDown(e, cellRefStr)}
                          onBlur={() => { if (!formulaSelectMode) commitCell(cellRefStr, formulaValue); }}
                          autoFocus
                          dir="ltr"
                        />
                      ) : (
                        <div className={`cell-display${isFormula ? ' cell-display--formula' : ''}${isError ? ' cell-display--error' : ''}`}>
                          {displayVal}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Bar */}
      <div className="spreadsheet-status">
        <div className="autosave-indicator">
          <span className={`autosave-dot${saveStatus === 'pending' ? ' autosave-dot--pending' : ''}`} />
          <span>{saveStatus === 'pending' ? 'שומר...' : 'נשמר'}</span>
        </div>
        {stats && (
          <div className="selection-stats">
            <span>סכום: {stats.sum}</span>
            <span>ממוצע: {stats.avg}</span>
            <span>ספירה: {stats.count}</span>
          </div>
        )}
        <span>{numCols} x {numRows}</span>
      </div>
    </div>
  );
}
