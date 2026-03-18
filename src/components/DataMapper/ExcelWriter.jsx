import { useState, useEffect } from 'react';
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
import { Plus, Trash2, Save, Table2, X } from 'lucide-react';
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
        setSheetData({
          columns: sheet.columns || ['עמודה 1', 'עמודה 2', 'עמודה 3'],
          rows: sheet.rows || [['', '', '']]
        });
      }
    }
  }, [activeSheet, sheets]);

  async function createSheet(e) {
    e.preventDefault();
    if (!newSheetName.trim() || !schoolId) return;
    const newDoc = await addDoc(collection(db, `sheets_${schoolId}`), {
      name: newSheetName.trim(),
      columns: ['עמודה 1', 'עמודה 2', 'עמודה 3'],
      rows: [['', '', '']],
      createdBy: userData?.fullName || '',
      createdAt: new Date().toISOString()
    });
    setActiveSheet(newDoc.id);
    setNewSheetName('');
    setShowNewSheet(false);
  }

  async function saveSheet() {
    if (!activeSheet || !schoolId) return;
    setSaving(true);
    await updateDoc(doc(db, `sheets_${schoolId}`, activeSheet), {
      columns: sheetData.columns,
      rows: sheetData.rows
    });
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
  }

  function removeRow(index) {
    if (sheetData.rows.length <= 1) return;
    setSheetData(prev => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index)
    }));
  }

  const activeSheetData = sheets.find(s => s.id === activeSheet);

  return (
    <div className="page">
      <Header title="מיפוי נתונים" />
      <div className="page-content">
        <div className="excel-layout">
          {/* Sheet list sidebar */}
          <div className="sheets-panel">
            <div className="sheets-header">
              <h3>טבלאות</h3>
              <button className="icon-btn" onClick={() => setShowNewSheet(true)} title="טבלה חדשה">
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewSheet(false)}>ביטול</button>
                </div>
              </form>
            )}

            <div className="sheet-list">
              {sheets.map(s => (
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
              {sheets.length === 0 && <p className="sheets-empty">אין טבלאות</p>}
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
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th className="excel-row-num">#</th>
                        {sheetData.columns.map((col, ci) => (
                          <th key={ci} className="excel-col-header">
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
                            <td key={ci} className="excel-cell">
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
