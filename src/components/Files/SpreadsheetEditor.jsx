import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, Minus, FunctionSquare } from 'lucide-react';
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

  // Function formulas: SUM, AVG, COUNT, MAX, MIN
  const funcMatch = expr.match(/^(SUM|AVG|AVERAGE|COUNT|MAX|MIN)\((.+)\)$/);
  if (funcMatch) {
    const func = funcMatch[1];
    const arg = funcMatch[2].trim();
    const values = arg.includes(':')
      ? getRangeValues(cells, arg)
      : [getCellValue(cells, arg)];

    switch (func) {
      case 'SUM':
        return values.reduce((a, b) => a + b, 0);
      case 'AVG':
      case 'AVERAGE':
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      case 'COUNT':
        return values.length;
      case 'MAX':
        return values.length ? Math.max(...values) : 0;
      case 'MIN':
        return values.length ? Math.min(...values) : 0;
      default:
        return '#ERR';
    }
  }

  // Single cell reference
  const singleRef = parseCellRef(expr);
  if (singleRef) {
    if (visited.has(expr)) return '#CIRC';
    visited.add(expr);
    return getCellValue(cells, expr);
  }

  // Simple arithmetic with cell references
  try {
    let replaced = expr.replace(/[A-Z]+\d+/g, (match) => {
      if (visited.has(match)) return '0';
      return getCellValue(cells, match);
    });
    // Only allow numbers and basic operators
    if (/^[\d\s+\-*/().]+$/.test(replaced)) {
      const result = Function('"use strict"; return (' + replaced + ')')();
      return typeof result === 'number' && isFinite(result) ? result : '#ERR';
    }
  } catch {
    // fall through
  }

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

export default function SpreadsheetEditor({ data, onChange, readOnly = false }) {
  const initialData = data || { columns: 5, rows: 10, cells: {}, headers: {} };
  const [cells, setCells] = useState(initialData.cells || {});
  const [headers, setHeaders] = useState(initialData.headers || {});
  const [numCols, setNumCols] = useState(initialData.columns || 5);
  const [numRows, setNumRows] = useState(initialData.rows || 10);
  const [selectedCell, setSelectedCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [formulaValue, setFormulaValue] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimerRef = useRef(null);
  const cellInputRef = useRef(null);
  const formulaInputRef = useRef(null);

  const triggerSave = useCallback((newCells, newHeaders, cols, rows) => {
    setSaveStatus('pending');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onChange?.({
        columns: cols,
        rows: rows,
        cells: newCells,
        headers: newHeaders,
      });
      setSaveStatus('saved');
    }, 800);
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setFormulaValue(cell?.formula || cell?.value || '');
    } else {
      setFormulaValue('');
    }
  }, [selectedCell, cells]);

  function handleCellClick(cellRef) {
    if (readOnly) return;
    setSelectedCell(cellRef);
    setEditingCell(null);
  }

  function handleCellDoubleClick(cellRef) {
    if (readOnly) return;
    setSelectedCell(cellRef);
    setEditingCell(cellRef);
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
      newCells[cellRef] = { value: '', formula: trimmed };
    } else {
      newCells[cellRef] = { value: trimmed, formula: '' };
    }
    setCells(newCells);
    setEditingCell(null);
    triggerSave(newCells, headers, numCols, numRows);
  }

  function handleCellKeyDown(e, cellRef) {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCell(cellRef, formulaValue);
      // Move to cell below
      const ref = parseCellRef(cellRef);
      if (ref && ref.row + 1 < numRows) {
        const nextRef = getColLetter(ref.col) + (ref.row + 2);
        setSelectedCell(nextRef);
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      const cell = cells[cellRef];
      setFormulaValue(cell?.formula || cell?.value || '');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitCell(cellRef, formulaValue);
      const ref = parseCellRef(cellRef);
      if (ref) {
        const nextCol = e.shiftKey ? ref.col - 1 : ref.col + 1;
        if (nextCol >= 0 && nextCol < numCols) {
          const nextRef = getColLetter(nextCol) + (ref.row + 1);
          setSelectedCell(nextRef);
        }
      }
    }
  }

  function handleFormulaBarKeyDown(e) {
    if (e.key === 'Enter' && selectedCell) {
      e.preventDefault();
      commitCell(selectedCell, formulaValue);
    } else if (e.key === 'Escape') {
      const cell = cells[selectedCell];
      setFormulaValue(cell?.formula || cell?.value || '');
      formulaInputRef.current?.blur();
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
    for (let r = 1; r <= numRows; r++) {
      delete newCells[removedLetter + r];
    }
    const newHeaders = { ...headers };
    delete newHeaders[numCols - 1];
    const newCols = numCols - 1;
    setCells(newCells);
    setHeaders(newHeaders);
    setNumCols(newCols);
    if (selectedCell) {
      const ref = parseCellRef(selectedCell);
      if (ref && ref.col >= newCols) {
        setSelectedCell(null);
        setEditingCell(null);
      }
    }
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
    for (let c = 0; c < numCols; c++) {
      delete newCells[getColLetter(c) + numRows];
    }
    const newRows = numRows - 1;
    setCells(newCells);
    setNumRows(newRows);
    if (selectedCell) {
      const ref = parseCellRef(selectedCell);
      if (ref && ref.row >= newRows) {
        setSelectedCell(null);
        setEditingCell(null);
      }
    }
    triggerSave(newCells, headers, numCols, newRows);
  }

  return (
    <div className="spreadsheet-editor">
      {/* Toolbar */}
      {!readOnly && (
        <div className="spreadsheet-toolbar">
          <button className="toolbar-btn" onClick={addColumn} title="הוסף עמודה">
            <Plus size={14} /> עמודה
          </button>
          <button className="toolbar-btn toolbar-btn--danger" onClick={removeColumn} disabled={numCols <= 1} title="הסר עמודה">
            <Minus size={14} /> עמודה
          </button>
          <div className="toolbar-separator" />
          <button className="toolbar-btn" onClick={addRow} title="הוסף שורה">
            <Plus size={14} /> שורה
          </button>
          <button className="toolbar-btn toolbar-btn--danger" onClick={removeRow} disabled={numRows <= 1} title="הסר שורה">
            <Minus size={14} /> שורה
          </button>
        </div>
      )}

      {/* Formula Bar */}
      <div className="formula-bar">
        <span className="cell-ref">{selectedCell || '-'}</span>
        <FunctionSquare size={14} className="formula-icon" />
        <input
          ref={formulaInputRef}
          className="formula-input"
          value={formulaValue}
          onChange={(e) => setFormulaValue(e.target.value)}
          onKeyDown={handleFormulaBarKeyDown}
          onFocus={handleFormulaBarFocus}
          onBlur={() => {
            if (selectedCell && editingCell) {
              commitCell(selectedCell, formulaValue);
            }
          }}
          placeholder="נוסחה או ערך..."
          disabled={readOnly || !selectedCell}
          dir="ltr"
        />
      </div>

      {/* Spreadsheet Grid */}
      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              <th className="corner-header">#</th>
              {Array.from({ length: numCols }, (_, ci) => (
                <th key={ci} className="col-header">
                  <span className="col-letter">{getColLetter(ci)}</span>
                  <input
                    value={headers[ci] || ''}
                    onChange={(e) => handleHeaderChange(ci, e.target.value)}
                    placeholder={getColLetter(ci)}
                    disabled={readOnly}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: numRows }, (_, ri) => (
              <tr key={ri}>
                <td className="row-header">{ri + 1}</td>
                {Array.from({ length: numCols }, (_, ci) => {
                  const cellRef = getColLetter(ci) + (ri + 1);
                  const isSelected = selectedCell === cellRef;
                  const isEditing = editingCell === cellRef;
                  const cell = cells[cellRef];
                  const displayVal = getDisplayValue(cell, cells);
                  const isFormula = !!cell?.formula;
                  const isError = displayVal === '#ERR' || displayVal === '#CIRC';

                  return (
                    <td
                      key={ci}
                      className={`cell${isSelected ? ' cell--selected' : ''}`}
                      onClick={() => handleCellClick(cellRef)}
                      onDoubleClick={() => handleCellDoubleClick(cellRef)}
                    >
                      {isEditing ? (
                        <input
                          ref={cellInputRef}
                          className="cell-input"
                          value={formulaValue}
                          onChange={(e) => setFormulaValue(e.target.value)}
                          onKeyDown={(e) => handleCellKeyDown(e, cellRef)}
                          onBlur={() => commitCell(cellRef, formulaValue)}
                          autoFocus
                          dir="ltr"
                        />
                      ) : (
                        <div
                          className={`cell-display${isFormula ? ' cell-display--formula' : ''}${isError ? ' cell-display--error' : ''}`}
                        >
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
        <span>{numCols} x {numRows}</span>
      </div>
    </div>
  );
}
