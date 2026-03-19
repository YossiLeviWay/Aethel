import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, writeBatch } from 'firebase/firestore';
import { ISRAELI_HOLIDAYS } from '../../data/holidays';
import Header from '../Layout/Header';
import { Plus, Trash2, Edit3, Save, X, Search, Send, Calendar, Filter, Download } from 'lucide-react';
import './Holidays.css';

const HOLIDAY_TYPES = {
  jewish: { label: 'יהודי', color: '#fef3c7', border: '#f59e0b' },
  muslim: { label: 'מוסלמי', color: '#d1fae5', border: '#10b981' },
  christian: { label: 'נוצרי', color: '#dbeafe', border: '#3b82f6' },
  druze: { label: 'דרוזי', color: '#e9d5ff', border: '#8b5cf6' },
  national: { label: 'לאומי', color: '#bfdbfe', border: '#2563eb' }
};

const EMPTY_FORM = {
  name: '',
  startDate: '',
  endDate: '',
  type: 'jewish',
  isVacation: false,
  isSchoolDay: true,
  note: '',
  color: '#f59e0b'
};

export default function HolidayManager() {
  const { userData, selectedSchool, isGlobalAdmin, isPrincipal } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [activeReligionFilters, setActiveReligionFilters] = useState(Object.keys(HOLIDAY_TYPES));
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const schoolId = selectedSchool || userData?.schoolId;
  const admin = isGlobalAdmin();
  const collectionName = admin ? 'holidays_global' : `holidays_${schoolId}`;

  useEffect(() => {
    if (!collectionName) return;
    if (!admin && !schoolId) return;

    const q = query(collection(db, collectionName), orderBy('startDate', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setHolidays(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {
      setHolidays([]);
    });

    return unsub;
  }, [collectionName, admin, schoolId]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (name === 'type') {
      setForm(prev => ({ ...prev, color: HOLIDAY_TYPES[value]?.border || '#f59e0b' }));
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(holiday) {
    setEditing(holiday.id);
    setForm({
      name: holiday.name || '',
      startDate: holiday.startDate || '',
      endDate: holiday.endDate || '',
      type: holiday.type || 'jewish',
      isVacation: holiday.isVacation || false,
      isSchoolDay: holiday.isSchoolDay !== undefined ? holiday.isSchoolDay : true,
      note: holiday.note || '',
      color: holiday.color || HOLIDAY_TYPES[holiday.type]?.border || '#f59e0b'
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate) return;

    const data = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      type: form.type,
      isVacation: form.isVacation,
      isSchoolDay: form.isSchoolDay,
      note: form.note.trim(),
      color: form.color,
      updatedAt: new Date().toISOString()
    };

    if (editing) {
      await updateDoc(doc(db, collectionName, editing), data);
    } else {
      data.createdAt = new Date().toISOString();
      await addDoc(collection(db, collectionName), data);
    }
    closeModal();
  }

  async function handleDelete(id) {
    if (!confirm('האם למחוק חג זה?')) return;
    await deleteDoc(doc(db, collectionName, id));
  }

  async function handleBroadcast() {
    if (!admin) return;
    if (!confirm('פעולה זו תעתיק את כל החגים לכלל המוסדות. להמשיך?')) return;

    setBroadcasting(true);
    try {
      const schoolsSnap = await getDocs(collection(db, 'schools'));
      const globalSnap = await getDocs(collection(db, 'holidays_global'));
      const globalHolidays = globalSnap.docs.map(d => d.data());

      for (const schoolDoc of schoolsSnap.docs) {
        const targetCollection = `holidays_${schoolDoc.id}`;
        const batch = writeBatch(db);

        const existingSnap = await getDocs(collection(db, targetCollection));
        existingSnap.docs.forEach(d => {
          batch.delete(doc(db, targetCollection, d.id));
        });

        globalHolidays.forEach(holiday => {
          const newRef = doc(collection(db, targetCollection));
          batch.set(newRef, {
            ...holiday,
            broadcastedAt: new Date().toISOString()
          });
        });

        await batch.commit();
      }

      alert('החגים שוגרו בהצלחה לכל המוסדות!');
    } catch (err) {
      console.error('Broadcast error:', err);
      alert('שגיאה בשיגור החגים: ' + err.message);
    } finally {
      setBroadcasting(false);
    }
  }

  async function loadDefaultHolidays() {
    if (!confirm('פעולה זו תטען את כל חגי וחופשות משרד החינוך לשנת הלימודים תשפ"ו. להמשיך?')) return;

    try {
      for (const holiday of ISRAELI_HOLIDAYS) {
        // Check if already exists by name and startDate
        const exists = holidays.find(h => h.name === holiday.name && h.startDate === holiday.startDate);
        if (!exists) {
          await addDoc(collection(db, collectionName), {
            ...holiday,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
      alert('החגים נטענו בהצלחה!');
    } catch (err) {
      alert('שגיאה בטעינת החגים: ' + err.message);
    }
  }

  function toggleReligionFilter(type) {
    setActiveReligionFilters(prev => {
      if (prev.includes(type)) {
        const newFilters = prev.filter(t => t !== type);
        return newFilters.length === 0 ? [type] : newFilters; // must have at least 1
      }
      return [...prev, type];
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('he-IL');
    } catch {
      return dateStr;
    }
  }

  // Filter holidays by search and religion
  const filtered = holidays.filter(h => {
    // Religion filter
    if (!activeReligionFilters.includes(h.type)) return false;
    // Search filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (h.name || '').toLowerCase().includes(q) ||
      (h.note || '').toLowerCase().includes(q) ||
      (HOLIDAY_TYPES[h.type]?.label || '').includes(q)
    );
  });

  // Group by religion type for column display
  const columnData = {};
  for (const type of Object.keys(HOLIDAY_TYPES)) {
    if (activeReligionFilters.includes(type)) {
      columnData[type] = filtered.filter(h => h.type === type);
    }
  }

  const canEdit = admin || isPrincipal();
  const activeColumnCount = Object.keys(columnData).length;

  return (
    <div className="page">
      <Header title="ניהול חגים וחופשות" />
      <div className="page-content">
        <div className="page-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {canEdit && (
              <button className="btn btn-primary" onClick={openAdd}>
                <Plus size={16} />
                חג חדש
              </button>
            )}
            {canEdit && holidays.length === 0 && (
              <button className="btn holidays-load-btn" onClick={loadDefaultHolidays}>
                <Download size={16} />
                טען חגי משרד החינוך
              </button>
            )}
            {admin && (
              <button
                className="btn holidays-broadcast-btn"
                onClick={handleBroadcast}
                disabled={broadcasting || holidays.length === 0}
              >
                <Send size={16} />
                {broadcasting ? 'משגר...' : 'שגר לכל המוסדות'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className={`btn ${showFilterPanel ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Filter size={14} />
              סינון דתות
            </button>
            <div className="search-bar">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש חג..."
              />
            </div>
            <span className="holidays-count">{filtered.length} חגים</span>
          </div>
        </div>

        {/* Religion Filter Panel */}
        {showFilterPanel && (
          <div className="holidays-filter-panel">
            <span className="holidays-filter-label">בחרו את הדתות שיוצגו:</span>
            <div className="holidays-filter-toggles">
              {Object.entries(HOLIDAY_TYPES).map(([type, config]) => (
                <button
                  key={type}
                  className={`holidays-filter-toggle ${activeReligionFilters.includes(type) ? 'holidays-filter-toggle--active' : ''}`}
                  style={{
                    '--filter-color': config.border,
                    '--filter-bg': config.color,
                  }}
                  onClick={() => toggleReligionFilter(type)}
                >
                  <span
                    className="holidays-filter-dot"
                    style={{ background: config.border }}
                  />
                  {config.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="holidays-empty">
            <Calendar size={40} />
            <p>{searchQuery ? 'לא נמצאו תוצאות' : 'אין חגים עדיין'}</p>
            {!searchQuery && canEdit && (
              <button className="btn btn-primary" onClick={loadDefaultHolidays} style={{ marginTop: '0.5rem' }}>
                <Download size={16} />
                טען חגי משרד החינוך תשפ"ו
              </button>
            )}
          </div>
        )}

        {/* Column-based display by religion */}
        {filtered.length > 0 && (
          <div className="holidays-columns" style={{ gridTemplateColumns: `repeat(${activeColumnCount}, 1fr)` }}>
            {Object.entries(columnData).map(([type, items]) => {
              const typeConfig = HOLIDAY_TYPES[type];
              return (
                <div key={type} className="holidays-column">
                  <div
                    className="holidays-column-header"
                    style={{ background: typeConfig.color, borderColor: typeConfig.border }}
                  >
                    <span
                      className="holidays-type-badge"
                      style={{ background: typeConfig.color, color: typeConfig.border, borderColor: typeConfig.border }}
                    >
                      {typeConfig.label}
                    </span>
                    <span className="holidays-section-count">{items.length}</span>
                  </div>
                  <div className="holidays-column-list">
                    {items.length === 0 ? (
                      <p className="holidays-column-empty">אין חגים מסוג זה</p>
                    ) : (
                      items.map(holiday => (
                        <div
                          key={holiday.id}
                          className="holiday-item"
                          style={{ borderRightColor: holiday.color || typeConfig.border }}
                        >
                          <div className="holiday-item-main">
                            <div className="holiday-item-info">
                              <h4 className="holiday-item-name">{holiday.name}</h4>
                              <div className="holiday-item-dates">
                                <Calendar size={12} />
                                <span>{formatDate(holiday.startDate)}</span>
                                {holiday.endDate && holiday.endDate !== holiday.startDate && (
                                  <>
                                    <span className="holiday-date-sep">—</span>
                                    <span>{formatDate(holiday.endDate)}</span>
                                  </>
                                )}
                              </div>
                              {holiday.note && (
                                <p className="holiday-item-note">{holiday.note}</p>
                              )}
                            </div>
                            <div className="holiday-item-tags">
                              {holiday.isVacation && (
                                <span className="holiday-tag holiday-tag--vacation">חופשה</span>
                              )}
                              {!holiday.isSchoolDay && (
                                <span className="holiday-tag holiday-tag--noschool">אין לימודים</span>
                              )}
                              {holiday.isSchoolDay && (
                                <span className="holiday-tag holiday-tag--school">יום לימודים</span>
                              )}
                            </div>
                          </div>
                          {canEdit && (
                            <div className="holiday-item-actions">
                              <button className="icon-btn" title="עריכה" onClick={() => openEdit(holiday)}>
                                <Edit3 size={15} />
                              </button>
                              <button className="icon-btn icon-btn--danger" title="מחיקה" onClick={() => handleDelete(holiday.id)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / Edit Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={closeModal}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{editing ? 'עריכת חג' : 'חג חדש'}</h3>
                <button className="modal-close" onClick={closeModal}><X size={18} /></button>
              </div>
              <div className="modal-form">
                <form onSubmit={handleSubmit} className="holiday-form">
                  <div className="form-group">
                    <label>שם החג</label>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="שם החג או החופשה"
                      required
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>תאריך התחלה</label>
                      <input
                        type="date"
                        name="startDate"
                        value={form.startDate}
                        onChange={handleChange}
                        required
                        dir="ltr"
                      />
                    </div>
                    <div className="form-group">
                      <label>תאריך סיום</label>
                      <input
                        type="date"
                        name="endDate"
                        value={form.endDate}
                        onChange={handleChange}
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>סוג</label>
                      <select name="type" value={form.type} onChange={handleChange}>
                        {Object.entries(HOLIDAY_TYPES).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>צבע</label>
                      <input
                        type="color"
                        name="color"
                        value={form.color}
                        onChange={handleChange}
                        className="holiday-color-input"
                      />
                    </div>
                  </div>
                  <div className="holiday-checkboxes">
                    <label className="holiday-checkbox">
                      <input
                        type="checkbox"
                        name="isVacation"
                        checked={form.isVacation}
                        onChange={handleChange}
                      />
                      <span>חופשה</span>
                    </label>
                    <label className="holiday-checkbox">
                      <input
                        type="checkbox"
                        name="isSchoolDay"
                        checked={form.isSchoolDay}
                        onChange={handleChange}
                      />
                      <span>יום לימודים</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>הערה</label>
                    <textarea
                      name="note"
                      value={form.note}
                      onChange={handleChange}
                      placeholder="הערות נוספות..."
                      rows={2}
                    />
                  </div>
                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary">
                      <Save size={16} />
                      {editing ? 'עדכון' : 'הוספה'}
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={closeModal}>
                      ביטול
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
