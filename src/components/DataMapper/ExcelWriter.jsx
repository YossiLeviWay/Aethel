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
import { Plus, Trash2, Save, Table2, X, Search, GripVertical } from 'lucide-react';
import '../Gantt/Gantt.css';
import './DataMapper.css';

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
    // Clean up width
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

  // Column resize handler
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

  const activeSheetData = sheets.find(s => s.id === activeSheet);

  // Filter sheets
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
              <button
                className="icon-btn"
                onClick={() => setShowNewSheet(true)}
                title="טבלה חדשה"
                type="button"
              >
                <Plus size={16} />
              </button>
            </div>

            {showNewSheet && (
              <form onSubmit={createSheet} className="new-sheet-form">
                <input
                  value={newSheetName}
                  onChange={e => setNewSheetName(e.target.value)}
                  placeholder="שם הטבלה"
                  autoFocus
                />
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-sm">צור</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setShowNewSheet(false); setNewSheetName(''); }}>ביטול</button>
                </div>
              </form>
            )}

            <div style={{ padding: '0.35rem 0.35rem 0' }}>
              <div className="search-bar" style={{ minWidth: 'auto' }}>
                <Search size={12} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="חיפוש..."
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
            </div>

            <div className="sheet-list">
              {filteredSheets.map(s => (
                <div
                  key={s.id}
                  className={`sheet-item ${activeSheet === s.id ? 'sheet-item--active' : ''}`}
                  onClick={() => setActiveSheet(s.id)}
                >
                  <Table2 size={14} />
                  <span className="sheet-name">{s.name}</span>
                  <button
                    className="sheet-delete"
                    onClick={e => { e.stopPropagation(); deleteSheet(s.id); }}
                  >
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

                <div className="excel-table-wrap">
                  <table className="excel-table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr>
                        <th className="excel-row-num" style={{ width: 40 }}>#</th>
                        {sheetData.columns.map((col, ci) => (
                          <th
                            key={ci}
                            className="excel-col-header"
                            style={{ width: columnWidths[ci] || 150, position: 'relative' }}
                          >
                            <input
                              value={col}
                              onChange={e => updateColumn(ci, e.target.value)}
                              className="excel-col-input"
                            />
                            {sheetData.columns.length > 1 && (
                              <button
                                className="excel-col-remove"
                                onClick={() => removeColumn(ci)}
                              >
                                <X size={10} />
                              </button>
                            )}
                            <div
                              className="excel-col-resize"
                              onMouseDown={e => handleColumnResize(ci, e)}
                            />
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
                              <button
                                className="excel-row-remove"
                                onClick={() => removeRow(ri)}
                              >
                                <X size={10} />
                              </button>
                            )}
                          </td>
                          {row.map((cell, ci) => (
                            <td key={ci} className="excel-cell" style={{ width: columnWidths[ci] || 150 }}>
                              <input
                                value={cell}
                                onChange={e => updateCell(ri, ci, e.target.value)}
                                className="excel-cell-input"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
