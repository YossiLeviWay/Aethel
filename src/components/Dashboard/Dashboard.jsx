import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { getUpcomingHolidays, getHolidaysForMonth } from '../../data/holidays';
import Header from '../Layout/Header';
import { Calendar, CheckSquare, Users, Clock, Star, BookOpen } from 'lucide-react';
import './Dashboard.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'בוקר טוב';
  if (hour >= 12 && hour < 17) return 'צהריים טובים';
  return 'ערב טוב';
}

function formatHebrewDate(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'long',
  });
}

function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  return `בעוד ${diff} ימים`;
}

const HOLIDAY_TYPE_LABELS = {
  jewish: 'יהודי',
  muslim: 'מוסלמי',
  christian: 'נוצרי',
  druze: 'דרוזי',
  national: 'לאומי',
};

const HOLIDAY_BORDER_COLORS = {
  jewish: '#f59e0b',
  muslim: '#10b981',
  christian: '#3b82f6',
  druze: '#8b5cf6',
  national: '#2563eb',
};

export default function Dashboard() {
  const { userData, selectedSchool } = useAuth();
  const [events, setEvents] = useState([]);
  const [taskStats, setTaskStats] = useState({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [todayHolidays, setTodayHolidays] = useState([]);

  useEffect(() => {
    const upcoming = getUpcomingHolidays(5);
    setHolidays(upcoming);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayMatches = upcoming.filter(h => h.startDate <= todayStr && h.endDate >= todayStr);
    setTodayHolidays(todayMatches);
  }, []);

  useEffect(() => {
    if (!selectedSchool) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch upcoming events
        const today = new Date().toISOString().split('T')[0];
        const eventsRef = collection(db, `events_${selectedSchool}`);
        const eventsQuery = query(
          eventsRef,
          where('date', '>=', today),
          orderBy('date', 'asc'),
          limit(5)
        );
        const eventsSnap = await getDocs(eventsQuery);
        setEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch task stats
        const tasksRef = collection(db, `tasks_${selectedSchool}`);
        const tasksSnap = await getDocs(tasksRef);
        const tasks = tasksSnap.docs.map(d => d.data());
        const pending = tasks.filter(t => t.status === 'pending' || t.status === 'todo').length;
        const completed = tasks.filter(t => t.status === 'completed' || t.status === 'done').length;
        const overdue = tasks.filter(t => {
          if (t.status === 'completed' || t.status === 'done') return false;
          return t.dueDate && t.dueDate < today;
        }).length;
        setTaskStats({ total: tasks.length, pending, completed, overdue });

        // Fetch staff count
        const staffRef = collection(db, 'users');
        const staffQuery = query(staffRef, where('schoolId', '==', selectedSchool));
        const staffSnap = await getDocs(staffQuery);
        setStaffCount(staffSnap.size);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedSchool]);

  if (!selectedSchool) {
    return (
      <div className="page">
        <Header title="דשבורד" />
        <div className="page-content">
          <div className="dashboard-empty">
            <BookOpen size={48} />
            <p>יש לבחור מוסד כדי לצפות בדשבורד</p>
          </div>
        </div>
      </div>
    );
  }

  const todayDate = new Date().toLocaleDateString('he-IL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="page">
      <Header title="דשבורד" />
      <div className="page-content">
        {/* Welcome Section */}
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1 className="welcome-greeting">
              {getGreeting()}, {userData?.fullName || 'משתמש'} 👋
            </h1>
            <p className="welcome-date">{todayDate}</p>
          </div>
        </div>

        {/* Today Highlight */}
        {todayHolidays.length > 0 && (
          <div className="dashboard-today">
            <div className="today-icon">
              <Star size={18} />
            </div>
            <div className="today-content">
              <span className="today-label">היום:</span>
              {todayHolidays.map((h, i) => (
                <span key={i} className="today-holiday" style={{ background: h.color }}>
                  {h.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon stat-icon--tasks">
              <CheckSquare size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{taskStats.pending}</span>
              <span className="stat-label">משימות ממתינות</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--completed">
              <CheckSquare size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{taskStats.completed}</span>
              <span className="stat-label">משימות שהושלמו</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--overdue">
              <Clock size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{taskStats.overdue}</span>
              <span className="stat-label">משימות באיחור</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon stat-icon--staff">
              <Users size={20} />
            </div>
            <div className="stat-info">
              <span className="stat-value">{staffCount}</span>
              <span className="stat-label">אנשי צוות</span>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Upcoming Events */}
          <div className="dashboard-section">
            <div className="section-header">
              <Calendar size={18} />
              <h2 className="section-title">אירועים קרובים</h2>
            </div>
            <div className="section-body">
              {loading ? (
                <p className="section-empty">טוען...</p>
              ) : events.length === 0 ? (
                <p className="section-empty">אין אירועים קרובים</p>
              ) : (
                <div className="event-list">
                  {events.map(event => (
                    <div key={event.id} className="event-card">
                      <div className="event-date-badge">
                        <span className="event-day">
                          {new Date(event.date + 'T00:00:00').getDate()}
                        </span>
                        <span className="event-month">
                          {new Date(event.date + 'T00:00:00').toLocaleDateString('he-IL', { month: 'short' })}
                        </span>
                      </div>
                      <div className="event-details">
                        <span className="event-title">{event.title}</span>
                        {event.category && (
                          <span className="event-category">{event.category}</span>
                        )}
                        <span className="event-countdown">{getDaysUntil(event.date)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Holidays */}
          <div className="dashboard-section">
            <div className="section-header">
              <Star size={18} />
              <h2 className="section-title">חגים וחופשות קרובים</h2>
            </div>
            <div className="section-body">
              {holidays.length === 0 ? (
                <p className="section-empty">אין חגים קרובים</p>
              ) : (
                <div className="holiday-list">
                  {holidays.map((holiday, idx) => (
                    <div
                      key={idx}
                      className="holiday-card"
                      style={{ borderRightColor: HOLIDAY_BORDER_COLORS[holiday.type] || '#e2e8f0' }}
                    >
                      <div className="holiday-info">
                        <span className="holiday-name">{holiday.name}</span>
                        <span className="holiday-dates">
                          {formatHebrewDate(holiday.startDate)}
                          {holiday.startDate !== holiday.endDate && (
                            <> - {formatHebrewDate(holiday.endDate)}</>
                          )}
                        </span>
                      </div>
                      <div className="holiday-meta">
                        <span
                          className="holiday-type-badge"
                          style={{ background: holiday.color }}
                        >
                          {HOLIDAY_TYPE_LABELS[holiday.type] || holiday.type}
                        </span>
                        <span className="holiday-countdown">{getDaysUntil(holiday.startDate)}</span>
                        {holiday.isVacation && (
                          <span className="holiday-vacation-badge">חופשה</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
