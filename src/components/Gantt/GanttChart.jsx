import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import Header from '../Layout/Header';
import EventModal from './EventModal';
import YearlyOverview from './YearlyOverview';
import { ChevronDown, Eye, Plus } from 'lucide-react';
import './Gantt.css';

const HEBREW_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
];

const DEFAULT_CATEGORIES = ['כללי', 'כיתה י׳', 'כיתה י״א', 'כיתה י״ב', 'צוות'];

const PASTEL_COLORS = [
  '#fecdd3', '#fed7aa', '#fef08a', '#bbf7d0', '#99f6e4',
  '#bae6fd', '#c4b5fd', '#e9d5ff', '#e2e8f0', '#ffffff'
];

function getWeeksInMonth(year, month) {
  const weeks = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let current = new Date(firstDay);
  const dayOfWeek = current.getDay();
  current.setDate(current.getDate() - dayOfWeek);

  while (current <= lastDay || weeks.length === 0) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
    if (current > lastDay && week[6] >= lastDay) break;
  }
  return weeks;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function GanttChart() {
  const { selectedSchool, userData } = useAuth();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [yearlyOpen, setYearlyOpen] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const [columnWidths, setColumnWidths] = useState([1, 1, 1, 1, 1, 1, 1]);

  const schoolId = selectedSchool || userData?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    const colRef = collection(db, `events_${schoolId}`);
    const q = query(
      colRef,
      where('year', '==', year),
      where('month', '==', month)
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId, year, month]);

  useEffect(() => {
    if (!schoolId) return;
    async function loadCategories() {
      try {
        const snap = await getDocs(collection(db, `categories_${schoolId}`));
        if (snap.size > 0) {
          setCategories(snap.docs.map(d => d.data().name));
        }
      } catch {
        // use defaults
      }
    }
    loadCategories();
  }, [schoolId]);

  function getEventsForCell(date, category) {
    const key = dateKey(date);
    return events.filter(e => e.date === key && e.category === category);
  }

  function handleCellClick(date, category) {
    setSelectedDate(date);
    setSelectedCategory(category);
    setEditingEvent(null);
    setModalOpen(true);
  }

  function handleEventClick(e, event) {
    e.stopPropagation();
    setEditingEvent(event);
    setSelectedDate(null);
    setSelectedCategory(event.category);
    setModalOpen(true);
  }

  async function handleSaveEvent(eventData) {
    if (!schoolId) return;
    const colRef = collection(db, `events_${schoolId}`);
    if (editingEvent) {
      await updateDoc(doc(db, `events_${schoolId}`, editingEvent.id), eventData);
    } else {
      await addDoc(colRef, {
        ...eventData,
        year,
        month,
        createdBy: userData?.uid || '',
        createdAt: new Date().toISOString()
      });
    }
    setModalOpen(false);
  }

  async function handleDeleteEvent() {
    if (!editingEvent || !schoolId) return;
    await deleteDoc(doc(db, `events_${schoolId}`, editingEvent.id));
    setModalOpen(false);
  }

  function handleMouseEnter(e, event) {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      event
    });
  }

  function handleMouseLeave() {
    setTooltip(null);
  }

  const handleColumnResize = useCallback((index, e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = columnWidths[index];

    function onMouseMove(ev) {
      const diff = (ev.clientX - startX) / 100;
      setColumnWidths(prev => {
        const next = [...prev];
        next[index] = Math.max(0.4, startWidth + diff);
        return next;
      });
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [columnWidths]);

  const weeks = getWeeksInMonth(year, month);
  const totalFlex = columnWidths.reduce((a, b) => a + b, 0);

  const years = [];
  for (let y = year - 3; y <= year + 3; y++) years.push(y);

  return (
    <div className="gantt-page">
      <Header title="לוח שנה" />

      <div className="gantt-controls">
        <div className="gantt-nav">
          <div className="gantt-select-wrap">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="gantt-select"
            >
              {HEBREW_MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <ChevronDown size={14} className="gantt-select-icon" />
          </div>
          <div className="gantt-select-wrap">
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="gantt-select"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <ChevronDown size={14} className="gantt-select-icon" />
          </div>
        </div>
        <button className="gantt-yearly-btn" onClick={() => setYearlyOpen(true)}>
          <Eye size={16} />
          מבט שנתי
        </button>
      </div>

      <div className="gantt-table-wrap">
        <table className="gantt-table">
          <thead>
            <tr>
              <th className="gantt-category-col">שבוע / קטגוריה</th>
              {HEBREW_DAYS.map((day, i) => (
                <th
                  key={i}
                  className="gantt-day-col"
                  style={{ width: `${(columnWidths[i] / totalFlex) * 100}%` }}
                >
                  <div className="gantt-day-header">
                    {day}
                    <div
                      className="gantt-resize-handle"
                      onMouseDown={e => handleColumnResize(i, e)}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => {
              const weekStart = week[0].getDate();
              const weekEnd = week[6].getDate();
              const label = `${weekStart}-${weekEnd}`;

              return categories.map((cat, ci) => (
                <tr key={`${wi}-${ci}`} className={ci === 0 ? 'gantt-week-start' : ''}>
                  {ci === 0 && (
                    <td className="gantt-category-cell gantt-week-label" rowSpan={categories.length}>
                      <div className="gantt-week-num">שבוע {wi + 1}</div>
                      <div className="gantt-week-dates">{label}</div>
                    </td>
                  )}
                  {ci > 0 && ci === 1 && null}
                  {week.map((date, di) => {
                    const isCurrentMonth = date.getMonth() === month;
                    const isToday = dateKey(date) === dateKey(new Date());
                    const cellEvents = getEventsForCell(date, cat);

                    return (
                      <td
                        key={di}
                        className={`gantt-cell ${!isCurrentMonth ? 'gantt-cell--dim' : ''} ${isToday ? 'gantt-cell--today' : ''}`}
                        style={{ width: `${(columnWidths[di] / totalFlex) * 100}%` }}
                        onClick={() => handleCellClick(date, cat)}
                      >
                        {ci === 0 && (
                          <div className="gantt-cell-date">{date.getDate()}</div>
                        )}
                        <div className="gantt-cell-cat">{cat}</div>
                        {cellEvents.map(ev => (
                          <div
                            key={ev.id}
                            className="gantt-event"
                            style={{ background: ev.color || PASTEL_COLORS[0] }}
                            onClick={e => handleEventClick(e, ev)}
                            onMouseEnter={e => handleMouseEnter(e, ev)}
                            onMouseLeave={handleMouseLeave}
                          >
                            {ev.title}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {tooltip && (
        <div
          className="gantt-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <strong>{tooltip.event.title}</strong>
          {tooltip.event.time && <span>{tooltip.event.time}</span>}
          {tooltip.event.description && <p>{tooltip.event.description}</p>}
        </div>
      )}

      {modalOpen && (
        <EventModal
          event={editingEvent}
          date={selectedDate}
          category={selectedCategory}
          categories={categories}
          colors={PASTEL_COLORS}
          onSave={handleSaveEvent}
          onDelete={editingEvent ? handleDeleteEvent : null}
          onClose={() => setModalOpen(false)}
        />
      )}

      {yearlyOpen && (
        <YearlyOverview
          year={year}
          schoolId={schoolId}
          onClose={() => setYearlyOpen(false)}
        />
      )}
    </div>
  );
}
