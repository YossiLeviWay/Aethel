import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import Header from '../Layout/Header';
import { Plus, Trash2, Save, Table2, X, Search, Calculator, Type } from 'lucide-react';
import '../Gantt/Gantt.css';
import './DataMapper.css';

function colLabel(i) {
  let s = '';
  let n = i;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function cellRef(ri, ci) {
  return `${colLabel(ci)}${ri + 1}`;
}

function parseNumber(val) {
  if (val === '' || val === null || val === undefined) return NaN;
  return Number(String(val).replace(/,/g, ''));
}

function calcSum(nums) { return nums.reduce((a, b) => a + b, 0); }
function calcAvg(nums) { return nums.length ? calcSum(nums) / nums.length : 0; }
function calcMedian(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function calcMin(nums) { return nums.length ? Math.min(...nums) : 0; }
function calcMax(nums) { return nums.length ? Math.max(...nums) : 0; }
function calcCount(nums) { return nums.length; }

const CALC_FUNCTIONS = [
  { id: 'sum', label: 'סכום', fn: calcSum, icon: '+' },
  { id: 'avg', label: 'ממוצע', fn: calcAvg, icon: 'x̄' },
  { id: 'median', label: 'חציון', fn: calcMedian, icon: 'M' },
  { id: 'min', label: 'מינימום', fn: calcMin, icon: '↓' },
  { id: 'max', label: 'מקסימום', fn: calcMax, icon: '↑' },
  { id: 'count', label: 'ספירה', fn: calcCount, icon: '#' },
];

function parseCellRef(ref) {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const letters = match[1];
  const row = parseInt(match[2], 10) - 1;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { ri: row, ci: col - 1 };
}

function parseRange(range) {
  const parts = range.split(':');
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return [];
  const cells = [];
  for (let r = Math.min(start.ri, end.ri); r <= Math.max(start.ri, end.ri); r++) {
    for (let c = Math.min(start.ci, end.ci); c <= Math.max(start.ci, end.ci); c++) {
      cells.push({ ri: r, ci: c });
    }
  }
  return cells;
}

function evaluateFormula(value, rows) {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (!v.startsWith('=')) return v;
  const expr = v.slice(1).trim().toUpperCase();

  const fnMatch = expr.match(/^(SUM|AVG|AVERAGE|MEDIAN|MIN|MAX|COUNT)\((.+)\)$/);
  if (fnMatch) {
    const fnName = fnMatch[1];
    const cells = parseRange(fnMatch[2]);
    const nums = cells.map(c => parseNumber(rows[c.ri]?.[c.ci])).filter(n => !isNaN(n));
    if (nums.length === 0) return 0;
    switch (fnName) {
      case 'SUM': return calcSum(nums);
      case 'AVG': case 'AVERAGE': return calcAvg(nums);
      case 'MEDIAN': return calcMedian(nums);
      case 'MIN': return calcMin(nums);
      case 'MAX': return calcMax(nums);
      case 'COUNT': return calcCount(nums);
    }
  }

  try {
    let mathExpr = v.slice(1);
    mathExpr = mathExpr.replace(/[A-Z]+\d+/gi, (ref) => {
      const cell = parseCellRef(ref.toUpperCase());
      if (!cell) return '0';
      const val = rows[cell.ri]?.[cell.ci];
      const num = parseNumber(val);
      return isNaN(num) ? '0' : String(num);
    });
    const safe = mathExpr.replace(/[^0-9+\-*/().%\s]/g, '');
    if (!safe.trim()) return 'שגיאה';
    // eslint-disable-next-line no-new-func
    const result = new Function('return ' + safe)();
    return isNaN(result) || !isFinite(result) ? 'שגיאה' : Math.round(result * 10000) / 10000;
  } catch {
    return 'שגיאה';
  }
}

export default function ExcelWriter() {
  const { userData, selectedSchool } = useAuth();
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(null);
  const [sheetData, setSheetData] = useState({ columns: [], rows: [] });
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [columnWidths, setColumnWidths] = useState({});
  const [rowHeights, setRowHeights] = useState({});
  const [editingCell, setEditingCell] = useState(null);
  const [formulaBar, setFormulaBar] = useState('');
  const [selection, setSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showFnPicker, setShowFnPicker] = useState(false);
  const [rangeSelecting, setRangeSelecting] = useState(false);
  const [formulaPrefix, setFormulaPrefix] = useState('');
  const tableRef = useRef(null);

  const schoolId = selectedSchool || userData?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, `sheets_${schoolId}`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setSheets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId]);

  useEffect(() => {
    if (activeSheet) {
      const sheet = sheets.find(s => s.id === activeSheet);
      if (sheet) {
        let rows;
        try {
          rows = sheet.rowsJson ? JSON.parse(sheet.rowsJson) : (sheet.rows || [['', '', '']]);
        } catch {
          rows = [['', '', '']];
        }
        setSheetData({
          columns: sheet.columns || ['עמודה 1', 'עמודה 2', 'עמודה 3'],
          rows
        });
      }
    }
  }, [activeSheet, sheets]);

  useEffect(() => {
    function handleUp() {
      if (isSelecting && rangeSelecting && editingCell) {
        // Finish range selection - close the parenthesis
        const currentVal = formulaBar;
        if (currentVal && !currentVal.endsWith(')')) {
          const finalVal = currentVal + ')';
          setFormulaBar(finalVal);
          updateCell(editingCell.ri, editingCell.ci, finalVal);
        }
        setRangeSelecting(false);
        setFormulaPrefix('');
      }
      setIsSelecting(false);
    }
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, [isSelecting, rangeSelecting, editingCell, formulaBar]);

  async function createSheet(e) {
    e.preventDefault();
    e.stopPropagation();
    const name = newSheetName.trim();
    if (!name || !schoolId) return;
    try {
      const newDoc = await addDoc(collection(db, `sheets_${schoolId}`), {
        name,
        columns: ['עמודה 1', 'עמודה 2', 'עמודה 3'],
        rowsJson: JSON.stringify([['', '', '']]),
        createdBy: userData?.fullName || '',
        createdAt: new Date().toISOString()
      });
      setActiveSheet(newDoc.id);
      setNewSheetName('');
      setShowNewSheet(false);
    } catch (err) {
      alert('שגיאה ביצירת הטבלה: ' + err.message);
    }
  }

  async function saveSheet() {
    if (!activeSheet || !schoolId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, `sheets_${schoolId}`, activeSheet), {
        columns: sheetData.columns,
        rowsJson: JSON.stringify(sheetData.rows)
      });
    } catch (err) {
      alert('שגיאה בשמירה: ' + err.message);
    }
    setSaving(false);
  }

  async function deleteSheet(sheetId) {
    if (!confirm('האם למחוק טבלה זו?')) return;
    await deleteDoc(doc(db, `sheets_${schoolId}`, sheetId));
    if (activeSheet === sheetId) {
      setActiveSheet(null);
      setSheetData({ columns: [], rows: [] });
    }
  }

  function updateColumn(index, value) {
    setSheetData(prev => {
      const cols = [...prev.columns];
      cols[index] = value;
      return { ...prev, columns: cols };
    });
  }

  function updateCell(rowIndex, colIndex, value) {
    setSheetData(prev => {
      const rows = prev.rows.map(r => [...r]);
      rows[rowIndex][colIndex] = value;
      return { ...prev, rows };
    });
  }

  function getCellDisplay(value) {
    if (typeof value === 'string' && value.trim().startsWith('=')) {
      const result = evaluateFormula(value, sheetData.rows);
      return result === 'שגיאה' ? 'שגיאה' : String(result);
    }
    return value;
  }

  function addColumn() {
    setSheetData(prev => ({
      columns: [...prev.columns, `עמודה ${prev.columns.length + 1}`],
      rows: prev.rows.map(r => [...r, ''])
    }));
  }

  function addRow() {
    setSheetData(prev => ({
      ...prev,
      rows: [...prev.rows, new Array(prev.columns.length).fill('')]
    }));
  }

  function removeColumn(index) {
    if (sheetData.columns.length <= 1) return;
    setSheetData(prev => ({
      columns: prev.columns.filter((_, i) => i !== index),
      rows: prev.rows.map(r => r.filter((_, i) => i !== index))
    }));
  }

  function removeRow(index) {
    if (sheetData.rows.length <= 1) return;
    setSheetData(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index)
    }));
  }

  const handleColumnResize = useCallback((colIndex, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[colIndex] || 120;
    function onMouseMove(ev) {
      setColumnWidths(prev => ({ ...prev, [colIndex]: Math.max(60, startWidth + (ev.clientX - startX)) }));
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  const handleRowResize = useCallback((rowIndex, e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = rowHeights[rowIndex] || 32;
    function onMouseMove(ev) {
      setRowHeights(prev => ({ ...prev, [rowIndex]: Math.max(24, startHeight + (ev.clientY - startY)) }));
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [rowHeights]);

  function handleCellMouseDown(ri, ci, e) {
    if (e.button !== 0) return;

    if (rangeSelecting && editingCell) {
      // In range selection mode - build the range reference
      setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
      setIsSelecting(true);
      // Update formula with start cell
      const ref = cellRef(ri, ci);
      const val = formulaPrefix + ref;
      setFormulaBar(val);
      updateCell(editingCell.ri, editingCell.ci, val);
      return;
    }

    setSelection({ startRow: ri, startCol: ci, endRow: ri, endCol: ci });
    setIsSelecting(true);
    setEditingCell({ ri, ci });
    setFormulaBar(sheetData.rows[ri]?.[ci] || '');
    setRangeSelecting(false);
    setFormulaPrefix('');
  }

  function handleCellMouseEnter(ri, ci) {
    if (!isSelecting) return;
    setSelection(prev => prev ? { ...prev, endRow: ri, endCol: ci } : null);

    if (rangeSelecting && editingCell) {
      const startRef = cellRef(
        Math.min(selection.startRow, ri),
        Math.min(selection.startCol, ci)
      );
      const endRef = cellRef(
        Math.max(selection.startRow, ri),
        Math.max(selection.startCol, ci)
      );
      const rangeStr = startRef === endRef ? startRef : `${startRef}:${endRef}`;
      const val = formulaPrefix + rangeStr;
      setFormulaBar(val);
      updateCell(editingCell.ri, editingCell.ci, val);
    }
  }

  function isInSelection(ri, ci) {
    if (!selection) return false;
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    return ri >= minR && ri <= maxR && ci >= minC && ci <= maxC;
  }

  function getSelectedNumbers() {
    if (!selection) return [];
    const minR = Math.min(selection.startRow, selection.endRow);
    const maxR = Math.max(selection.startRow, selection.endRow);
    const minC = Math.min(selection.startCol, selection.endCol);
    const maxC = Math.max(selection.startCol, selection.endCol);
    const nums = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const n = parseNumber(getCellDisplay(sheetData.rows[r]?.[c]));
        if (!isNaN(n)) nums.push(n);
      }
    }
    return nums;
  }

  function getSelectionLabel() {
    if (!selection) return '';
    const s = cellRef(selection.startRow, selection.startCol);
    const e = cellRef(selection.endRow, selection.endCol);
    return s === e ? s : `${s}:${e}`;
  }

  function handleFormulaBarChange(e) {
    const val = e.target.value;
    setFormulaBar(val);
    if (editingCell) {
      updateCell(editingCell.ri, editingCell.ci, val);
    }
    // Show function picker when typing = at the start
    if (val === '=' || val === '=') {
      setShowFnPicker(true);
    } else {
      setShowFnPicker(false);
    }
  }

  function selectFunction(fnId) {
    const fnName = fnId.toUpperCase();
    if (fnName === 'COUNT') {
      // COUNT doesn't need special handling
    }
    const prefix = `=${fnName}(`;
    setFormulaPrefix(prefix);
    setShowFnPicker(false);
    setRangeSelecting(true);
    if (editingCell) {
      const val = prefix;
      setFormulaBar(val);
      updateCell(editingCell.ri, editingCell.ci, val);
    }
  }

  function handleFormulaBarKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editingCell && editingCell.ri < sheetData.rows.length - 1) {
        const nextRi = editingCell.ri + 1;
        setEditingCell({ ri: nextRi, ci: editingCell.ci });
        setFormulaBar(sheetData.rows[nextRi]?.[editingCell.ci] || '');
        setSelection({ startRow: nextRi, startCol: editingCell.ci, endRow: nextRi, endCol: editingCell.ci });
      }
    }
  }

  function insertCalcRow(calcId) {
    if (!editingCell) return;
    const fnName = calcId.toUpperCase();

    if (selection && (selection.startRow !== selection.endRow || selection.startCol !== selection.endCol)) {
      // Multi-cell selection exists - build formula for selection
      const startRef = cellRef(
        Math.min(selection.startRow, selection.endRow),
        Math.min(selection.startCol, selection.endCol)
      );
      const endRef = cellRef(
        Math.max(selection.startRow, selection.endRow),
        Math.max(selection.startCol, selection.endCol)
      );
      const formula = `=${fnName}(${startRef}:${endRef})`;
      updateCell(editingCell.ri, editingCell.ci, formula);
      setFormulaBar(formula);
    } else {
      // No multi-cell selection - enter range selection mode
      selectFunction(calcId);
    }
  }

  const activeSheetData = sheets.find(s => s.id === activeSheet);
  const filteredSheets = sheets.filter(s => {
    if (!searchQuery.trim()) return true;
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const selectedNums = getSelectedNumbers();
  const selectionMulti = selection && (selection.startRow !== selection.endRow || selection.startCol !== selection.endCol);

  return (
    <div className="page">
      <Header title="מיפוי נתונים" />
      <div className="page-content">
        <div className="excel-layout">
          <div className="sheets-panel">
            <div className="sheets-header">
              <h3>טבלאות</h3>
              <button className="icon-btn" onClick={() => setShowNewSheet(true)} title="טבלה חדשה" type="button"><Plus size={16} /></button>
            </div>
            {showNewSheet && (
              <form onSubmit={createSheet} className="new-sheet-form">
                <input value={newSheetName} onChange={e => setNewSheetName(e.target.value)} placeholder="שם הטבלה" autoFocus />
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-sm">צור</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowNewSheet(false); setNewSheetName(''); }}>ביטול</button>
                </div>
              </form>
            )}
            <div style={{ padding: '0.35rem 0.35rem 0' }}>
              <div className="search-bar" style={{ minWidth: 'auto' }}>
                <Search size={12} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="חיפוש..." style={{ fontSize: '0.75rem' }} />
              </div>
            </div>
            <div className="sheet-list">
              {filteredSheets.map(s => (
                <div key={s.id} className={`sheet-item ${activeSheet === s.id ? 'sheet-item--active' : ''}`} onClick={() => setActiveSheet(s.id)}>
                  <Table2 size={14} />
                  <span className="sheet-name">{s.name}</span>
                  <button className="sheet-delete" onClick={e => { e.stopPropagation(); deleteSheet(s.id); }}><Trash2 size={12} /></button>
                </div>
              ))}
              {filteredSheets.length === 0 && <p className="sheets-empty">{searchQuery ? 'לא נמצאו תוצאות' : 'אין טבלאות'}</p>}
            </div>
          </div>

          <div className="excel-editor">
            {activeSheet ? (
              <>
                <div className="excel-toolbar">
                  <span className="excel-sheet-name">{activeSheetData?.name}</span>
                  <div className="excel-actions">
                    <button className="btn btn-secondary btn-sm" onClick={addColumn}><Plus size={12} /> עמודה</button>
                    <button className="btn btn-secondary btn-sm" onClick={addRow}><Plus size={12} /> שורה</button>
                    <button className="btn btn-primary btn-sm" onClick={saveSheet} disabled={saving}>
                      <Save size={12} /> {saving ? 'שומר...' : 'שמירה'}
                    </button>
                  </div>
                </div>

                <div className="formula-bar" style={{ position: 'relative' }}>
                  <span className="formula-bar-label">
                    <Type size={12} />
                    {editingCell ? cellRef(editingCell.ri, editingCell.ci) : 'נוסחה'}
                  </span>
                  {rangeSelecting && (
                    <span style={{ background: '#dbeafe', color: '#2563eb', padding: '0.15rem 0.5rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600, marginRight: '0.5rem' }}>
                      בחרו תאים בגרירה
                    </span>
                  )}
                  <input
                    className="formula-bar-input"
                    value={editingCell ? formulaBar : ''}
                    onChange={handleFormulaBarChange}
                    onKeyDown={handleFormulaBarKeyDown}
                    placeholder={editingCell ? 'ערך או נוסחה: =2+3, =SUM(A1:A5)...' : 'לחצו על תא'}
                    disabled={!editingCell}
                  />
                  {showFnPicker && editingCell && (
                    <div className="fn-picker" style={{
                      position: 'absolute',
                      zIndex: 50,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      padding: '0.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.15rem',
                      right: 0,
                      top: '100%',
                      minWidth: 160
                    }}>
                      {CALC_FUNCTIONS.map(c => (
                        <button
                          key={c.id}
                          className="fn-picker-item"
                          onClick={() => selectFunction(c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            border: 'none',
                            background: 'transparent',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontFamily: 'Inter, sans-serif',
                            textAlign: 'right',
                            width: '100%'
                          }}
                          onMouseEnter={e => e.target.style.background = '#f1f5f9'}
                          onMouseLeave={e => e.target.style.background = 'transparent'}
                        >
                          <span style={{ fontWeight: 700, width: 20, color: '#2563eb' }}>{c.icon}</span>
                          <span>{c.label}</span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginRight: 'auto' }}>{c.id.toUpperCase()}()</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="calc-toolbar">
                  <span className="calc-toolbar-label"><Calculator size={13} /> חישובים:</span>
                  <div className="calc-buttons">
                    {CALC_FUNCTIONS.map(c => (
                      <button key={c.id} className="calc-btn" onClick={() => insertCalcRow(c.id)} title={`הוסף שורת ${c.label}`}>
                        <span className="calc-btn-icon">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="excel-table-wrap" ref={tableRef}>
                  <table className="excel-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th className="excel-row-num" style={{ width: 40 }}></th>
                        {sheetData.columns.map((col, ci) => (
                          <th key={ci} className="excel-col-header" style={{ width: columnWidths[ci] || 120, position: 'relative' }}>
                            <div className="excel-col-letter">{colLabel(ci)}</div>
                            <input value={col} onChange={e => updateColumn(ci, e.target.value)} className="excel-col-input" />
                            {sheetData.columns.length > 1 && (
                              <button className="excel-col-remove" onClick={() => removeColumn(ci)}><X size={10} /></button>
                            )}
                            <div className="excel-col-resize" onMouseDown={e => handleColumnResize(ci, e)} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetData.rows.map((row, ri) => (
                        <tr key={ri} style={{ height: rowHeights[ri] || 32 }}>
                          <td className="excel-row-num" style={{ position: 'relative' }}>
                            {ri + 1}
                            {sheetData.rows.length > 1 && (
                              <button className="excel-row-remove" onClick={() => removeRow(ri)}><X size={10} /></button>
                            )}
                            <div className="excel-row-resize" onMouseDown={e => handleRowResize(ri, e)} />
                          </td>
                          {row.map((cell, ci) => {
                            const isFocused = editingCell?.ri === ri && editingCell?.ci === ci;
                            const inSel = isInSelection(ri, ci);
                            const isFormula = typeof cell === 'string' && cell.trim().startsWith('=');
                            const displayVal = isFocused ? cell : getCellDisplay(cell);

                            return (
                              <td
                                key={ci}
                                className={`excel-cell ${inSel ? 'excel-cell--selected' : ''} ${isFocused ? 'excel-cell--focused' : ''} ${isFormula && !isFocused ? 'excel-cell--formula' : ''}`}
                                style={{ width: columnWidths[ci] || 120, height: rowHeights[ri] || 32 }}
                                onMouseDown={e => handleCellMouseDown(ri, ci, e)}
                                onMouseEnter={() => handleCellMouseEnter(ri, ci)}
                              >
                                <input
                                  value={isFocused ? cell : (displayVal || '')}
                                  onChange={e => {
                                    const val = e.target.value;
                                    updateCell(ri, ci, val);
                                    if (isFocused) {
                                      setFormulaBar(val);
                                      if (val === '=') {
                                        setShowFnPicker(true);
                                      } else if (!val.startsWith('=')) {
                                        setShowFnPicker(false);
                                      }
                                    }
                                  }}
                                  className="excel-cell-input"
                                  tabIndex={-1}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="calc-summary-bar">
                  {selectionMulti && selectedNums.length > 0 ? (
                    <>
                      <span className="calc-summary-item">בחירה: <strong>{getSelectionLabel()}</strong></span>
                      <span className="calc-summary-item">סכום: <strong>{Math.round(calcSum(selectedNums) * 100) / 100}</strong></span>
                      <span className="calc-summary-item">ממוצע: <strong>{Math.round(calcAvg(selectedNums) * 100) / 100}</strong></span>
                      <span className="calc-summary-item">חציון: <strong>{Math.round(calcMedian(selectedNums) * 100) / 100}</strong></span>
                      <span className="calc-summary-item">ספירה: <strong>{calcCount(selectedNums)}</strong></span>
                    </>
                  ) : editingCell ? (
                    <>
                      {CALC_FUNCTIONS.slice(0, 4).map(c => {
                        const colNums = sheetData.rows.map(r => parseNumber(getCellDisplay(r[editingCell.ci]))).filter(n => !isNaN(n));
                        const result = colNums.length > 0 ? Math.round(c.fn(colNums) * 100) / 100 : '—';
                        return <span key={c.id} className="calc-summary-item">{c.label}: <strong>{result}</strong></span>;
                      })}
                    </>
                  ) : (
                    <span className="calc-summary-item">לחצו על תא להצגת סטטיסטיקות</span>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Table2 size={40} className="empty-icon" />
                <p>בחרו טבלה או צרו חדשה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
