import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  getDocs,
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

function parseNumber(val) {
  if (val === '' || val === null || val === undefined) return NaN;
  const n = Number(String(val).replace(/,/g, ''));
  return n;
}

function getColumnNumbers(rows, colIndex) {
  return rows.map(r => parseNumber(r[colIndex])).filter(n => !isNaN(n));
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
  const [showCalcRow, setShowCalcRow] = useState(false);
  const [calcType, setCalcType] = useState('sum');
  const [editingCell, setEditingCell] = useState(null);
  const [formulaBar, setFormulaBar] = useState('');

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
      console.error('Error creating sheet:', err);
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

  // Evaluate simple formulas: =A+B, =A-B, =A*B, =A/B, or just numbers
  function evaluateCell(value) {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    if (!v.startsWith('=')) return v;
    try {
      // Simple arithmetic: replace cell-like patterns aren't needed, just evaluate math
      const expr = v.slice(1).replace(/[^0-9+\-*/().,%\s]/g, '');
      if (!expr) return v;
      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + expr)();
      return isNaN(result) || !isFinite(result) ? 'שגיאה' : result;
    } catch {
      return 'שגיאה';
    }
  }

  function getCellDisplay(value) {
    if (typeof value === 'string' && value.trim().startsWith('=')) {
      const result = evaluateCell(value);
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
    setColumnWidths(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
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
    const startWidth = columnWidths[colIndex] || 150;

    function onMouseMove(ev) {
      const diff = ev.clientX - startX;
      setColumnWidths(prev => ({
        ...prev,
        [colIndex]: Math.max(80, startWidth + diff)
      }));
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  function handleCellFocus(ri, ci) {
    setEditingCell({ ri, ci });
    setFormulaBar(sheetData.rows[ri]?.[ci] || '');
  }

  function handleCellBlur() {
    setEditingCell(null);
  }

  function handleFormulaBarChange(e) {
    const val = e.target.value;
    setFormulaBar(val);
    if (editingCell) {
      updateCell(editingCell.ri, editingCell.ci, val);
    }
  }

  // Insert a quick calculation into a new row at the bottom
  function insertCalcRow(calcId) {
    const calcFunc = CALC_FUNCTIONS.find(c => c.id === calcId);
    if (!calcFunc) return;
    const newRow = sheetData.columns.map((_, ci) => {
      const nums = getColumnNumbers(sheetData.rows, ci);
      if (nums.length === 0) return '';
      const result = calcFunc.fn(nums);
      return String(Math.round(result * 100) / 100);
    });
    setSheetData(prev => ({
      ...prev,
      rows: [...prev.rows, newRow]
    }));
  }

  const activeSheetData = sheets.find(s => s.id === activeSheet);
  const currentCalc = CALC_FUNCTIONS.find(c => c.id === calcType);

  const filteredSheets = sheets.filter(s => {
    if (!searchQuery.trim()) return true;
    return s.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="page">
      <Header title="מיפוי נתונים" />
      <div className="page-content">
        <div className="excel-layout">
          {/* Sheet list sidebar */}
          <div className="sheets-panel">
            <div className="sheets-header">
              <h3>טבלאות</h3>
              <button className="icon-btn" onClick={() => setShowNewSheet(true)} title="טבלה חדשה" type="button">
                <Plus size={16} />
              </button>
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
                  <button className="sheet-delete" onClick={e => { e.stopPropagation(); deleteSheet(s.id); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {filteredSheets.length === 0 && <p className="sheets-empty">{searchQuery ? 'לא נמצאו תוצאות' : 'אין טבלאות'}</p>}
            </div>
          </div>

          {/* Editor area */}
          <div className="excel-editor">
            {activeSheet ? (
              <>
                <div className="excel-toolbar">
                  <span className="excel-sheet-name">{activeSheetData?.name}</span>
                  <div className="excel-actions">
                    <button className="btn btn-secondary btn-sm" onClick={addColumn}>
                      <Plus size={12} /> עמודה
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={addRow}>
                      <Plus size={12} /> שורה
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={saveSheet} disabled={saving}>
                      <Save size={12} /> {saving ? 'שומר...' : 'שמירה'}
                    </button>
                  </div>
                </div>

                {/* Formula bar */}
                <div className="formula-bar">
                  <span className="formula-bar-label">
                    <Type size={12} />
                    {editingCell ? `${sheetData.columns[editingCell.ci] || ''}` : 'נוסחה'}
                  </span>
                  <input
                    className="formula-bar-input"
                    value={editingCell ? formulaBar : ''}
                    onChange={handleFormulaBarChange}
                    placeholder={editingCell ? 'הקלידו ערך או נוסחה (=2+3, =10*5)...' : 'לחצו על תא לעריכה'}
                    disabled={!editingCell}
                  />
                </div>

                {/* Calculations toolbar */}
                <div className="calc-toolbar">
                  <span className="calc-toolbar-label">
                    <Calculator size={13} />
                    חישובים:
                  </span>
                  <div className="calc-buttons">
                    {CALC_FUNCTIONS.map(c => (
                      <button
                        key={c.id}
                        className="calc-btn"
                        onClick={() => insertCalcRow(c.id)}
                        title={`הוסף שורת ${c.label}`}
                      >
                        <span className="calc-btn-icon">{c.icon}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="excel-table-wrap">
                  <table className="excel-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th className="excel-row-num" style={{ width: 40 }}>#</th>
                        {sheetData.columns.map((col, ci) => (
                          <th key={ci} className="excel-col-header" style={{ width: columnWidths[ci] || 150, position: 'relative' }}>
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
                        <tr key={ri}>
                          <td className="excel-row-num">
                            {ri + 1}
                            {sheetData.rows.length > 1 && (
                              <button className="excel-row-remove" onClick={() => removeRow(ri)}><X size={10} /></button>
                            )}
                          </td>
                          {row.map((cell, ci) => {
                            const isEditing = editingCell?.ri === ri && editingCell?.ci === ci;
                            const displayVal = isEditing ? cell : getCellDisplay(cell);
                            const isFormula = typeof cell === 'string' && cell.trim().startsWith('=');
                            return (
                              <td key={ci} className={`excel-cell ${isFormula && !isEditing ? 'excel-cell--formula' : ''}`} style={{ width: columnWidths[ci] || 150 }}>
                                <input
                                  value={isEditing ? cell : displayVal}
                                  onChange={e => {
                                    updateCell(ri, ci, e.target.value);
                                    if (isEditing) setFormulaBar(e.target.value);
                                  }}
                                  onFocus={() => handleCellFocus(ri, ci)}
                                  onBlur={handleCellBlur}
                                  className="excel-cell-input"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quick summary bar */}
                {editingCell && (
                  <div className="calc-summary-bar">
                    {CALC_FUNCTIONS.slice(0, 4).map(c => {
                      const nums = getColumnNumbers(sheetData.rows, editingCell.ci);
                      const result = nums.length > 0 ? Math.round(c.fn(nums) * 100) / 100 : '—';
                      return (
                        <span key={c.id} className="calc-summary-item">
                          {c.label}: <strong>{result}</strong>
                        </span>
                      );
                    })}
                  </div>
                )}
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
