import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Header from '../Layout/Header';
import { Calendar, CheckSquare, Users, Clock, Star, BookOpen, CheckCircle, XCircle, UserCheck, Activity, School, UserPlus, Shield } from 'lucide-react';
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

function formatActivityDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'אתמול';
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
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
  const { userData, selectedSchool, isGlobalAdmin, isPrincipal, approveUser, rejectUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [taskStats, setTaskStats] = useState({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [todayHolidays, setTodayHolidays] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (!selectedSchool) return;
    const q = query(collection(db, `holidays_${selectedSchool}`));
    const unsub = onSnapshot(q, (snap) => {
      const allH = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      // Upcoming holidays (next 5 from today)
      const upcoming = allH
        .filter(h => (h.endDate || h.startDate) >= todayStr)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, 5);
      setHolidays(upcoming);

      const todayMatches = upcoming.filter(h => h.startDate <= todayStr && (h.endDate || h.startDate) >= todayStr);
      setTodayHolidays(todayMatches);
    }, () => {
      setHolidays([]);
      setTodayHolidays([]);
    });
    return unsub;
  }, [selectedSchool]);

  // Load schools list for mapping IDs to names
  useEffect(() => {
    async function loadSchools() {
      try {
        const snap = await getDocs(collection(db, 'schools'));
        setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error loading schools:', err);
      }
    }
    loadSchools();
  }, []);

  // Fetch pending users for admin/principal
  useEffect(() => {
    if (!isGlobalAdmin() && !isPrincipal()) {
      setPendingUsers([]);
      return;
    }

    async function fetchPendingUsers() {
      try {
        if (isGlobalAdmin()) {
          // Admin sees ALL pending users across all schools
          const usersRef = collection(db, 'users');
          const snap = await getDocs(usersRef);
          const pending = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => u.pendingSchools && u.pendingSchools.length > 0);
          setPendingUsers(pending);
        } else if (isPrincipal() && selectedSchool) {
          // Principal sees only pending users for their school(s)
          const userSchools = userData?.schoolIds || [];
          const schoolId = selectedSchool || (userSchools.length > 0 ? userSchools[0] : userData?.schoolId);
          if (schoolId) {
            const q = query(collection(db, 'users'), where('pendingSchools', 'array-contains', schoolId));
            const snap = await getDocs(q);
            setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }
        }
      } catch (err) {
        console.error('Error fetching pending users:', err);
      }
    }

    fetchPendingUsers();
  }, [selectedSchool, userData]);

  // Activity feed for global admin - shows significant events across all schools
  useEffect(() => {
    if (!isGlobalAdmin()) return;

    async function fetchActivityFeed() {
      setActivityLoading(true);
      try {
        const feed = [];
        const schoolsSnap = await getDocs(collection(db, 'schools'));
        const allSchools = schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 1. Recently added schools
        for (const school of allSchools) {
          if (school.createdAt) {
            feed.push({
              type: 'new_school',
              icon: 'school',
              text: `בית ספר חדש נוסף: ${school.name || school.id}`,
              date: school.createdAt,
              schoolName: school.name || school.id,
            });
          }
        }

        // 2. Recently added staff (principals, editors) across all schools
        const usersSnap = await getDocs(collection(db, 'users'));
        const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const user of allUsers) {
          if (!user.createdAt) continue;
          const userSchoolIds = user.schoolIds || (user.schoolId ? [user.schoolId] : []);
          const schoolNames = userSchoolIds
            .map(sid => allSchools.find(s => s.id === sid)?.name || sid)
            .filter(Boolean);
          const schoolLabel = schoolNames.length > 0 ? schoolNames.join(', ') : '';

          if (user.role === 'principal') {
            feed.push({
              type: 'new_principal',
              icon: 'principal',
              text: `מנהל חדש נוסף: ${user.fullName}`,
              detail: schoolLabel ? `ב${schoolLabel}` : '',
              date: user.createdAt,
              schoolName: schoolLabel,
            });
          } else if (user.role === 'editor') {
            feed.push({
              type: 'new_editor',
              icon: 'staff',
              text: `עורך חדש נוסף: ${user.fullName}`,
              detail: schoolLabel ? `ב${schoolLabel}` : '',
              date: user.createdAt,
              schoolName: schoolLabel,
            });
          } else if (user.role !== 'global_admin') {
            feed.push({
              type: 'new_staff',
              icon: 'staff',
              text: `איש צוות חדש: ${user.fullName}`,
              detail: schoolLabel ? `ב${schoolLabel}` : '',
              date: user.createdAt,
              schoolName: schoolLabel,
            });
          }
        }

        // 3. Count staff per school for summary stats
        const schoolStaffCounts = {};
        for (const school of allSchools) {
          const count = allUsers.filter(u => {
            const sids = u.schoolIds || [];
            return sids.includes(school.id) || u.schoolId === school.id;
          }).length;
          schoolStaffCounts[school.id] = count;
        }

        // Sort by date descending, take latest 20
        feed.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setActivityFeed(feed.slice(0, 20));
      } catch (err) {
        console.error('Error fetching activity feed:', err);
      } finally {
        setActivityLoading(false);
      }
    }

    fetchActivityFeed();
  }, [selectedSchool, userData]);

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

        // Fetch staff count - query with new schoolIds array-contains
        const staffRef = collection(db, 'users');
        const staffQuery1 = query(staffRef, where('schoolIds', 'array-contains', selectedSchool));
        const staffSnap1 = await getDocs(staffQuery1);
        const staffIds = new Set(staffSnap1.docs.map(d => d.id));

        // Fallback: also query with old schoolId field for backward compatibility
        const staffQuery2 = query(staffRef, where('schoolId', '==', selectedSchool));
        const staffSnap2 = await getDocs(staffQuery2);
        staffSnap2.docs.forEach(d => {
          const data = d.data();
          const pending = data.pendingSchools || [];
          // Only count if not pending (i.e., approved via old schema)
          if (!pending.includes(selectedSchool)) {
            staffIds.add(d.id);
          }
        });

        setStaffCount(staffIds.size);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedSchool]);

  function getSchoolName(schoolId) {
    const school = schools.find(s => s.id === schoolId);
    return school?.name || schoolId;
  }

  async function handleApprove(userId, schoolId) {
    await approveUser(userId, schoolId);
    // Refresh pending users list
    setPendingUsers(prev => {
      return prev.map(u => {
        if (u.id === userId) {
          const newPending = (u.pendingSchools || []).filter(s => s !== schoolId);
          if (newPending.length === 0) return null;
          return { ...u, pendingSchools: newPending };
        }
        return u;
      }).filter(Boolean);
    });
  }

  async function handleReject(userId, schoolId) {
    if (!confirm('האם לדחות את בקשת המשתמש?')) return;
    await rejectUser(userId, schoolId);
    // Refresh pending users list
    setPendingUsers(prev => {
      return prev.map(u => {
        if (u.id === userId) {
          const newPending = (u.pendingSchools || []).filter(s => s !== schoolId);
          if (newPending.length === 0) return null;
          return { ...u, pendingSchools: newPending };
        }
        return u;
      }).filter(Boolean);
    });
  }

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

  const canApprove = isGlobalAdmin() || isPrincipal();

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

        {/* Pending Approvals Section */}
        {canApprove && pendingUsers.length > 0 && (
          <div className="pending-approval-section" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <UserCheck size={18} style={{ color: '#92400e' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#92400e' }}>
                ממתינים לאישור ({pendingUsers.length})
              </h3>
            </div>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>דוא"ל</th>
                    <th>תפקיד</th>
                    {isGlobalAdmin() && <th>מוסד</th>}
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => {
                    // For admin: show each pending school as a separate row
                    const pendingSchoolIds = user.pendingSchools || [];
                    if (isGlobalAdmin()) {
                      return pendingSchoolIds.map(psId => (
                        <tr key={`${user.id}-${psId}`}>
                          <td className="td-bold">
                            <div className="td-user">
                              <div className="td-avatar">{user.fullName?.charAt(0)}</div>
                              {user.fullName}
                            </div>
                          </td>
                          <td dir="ltr">{user.email}</td>
                          <td>{user.jobTitle || '—'}</td>
                          <td>{getSchoolName(psId)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleApprove(user.id, psId)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <CheckCircle size={14} />
                                אישור
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleReject(user.id, psId)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}
                              >
                                <XCircle size={14} />
                                דחייה
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    } else {
                      // Principal: show for the selected school only
                      return (
                        <tr key={user.id}>
                          <td className="td-bold">
                            <div className="td-user">
                              <div className="td-avatar">{user.fullName?.charAt(0)}</div>
                              {user.fullName}
                            </div>
                          </td>
                          <td dir="ltr">{user.email}</td>
                          <td>{user.jobTitle || '—'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleApprove(user.id, selectedSchool)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <CheckCircle size={14} />
                                אישור
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleReject(user.id, selectedSchool)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}
                              >
                                <XCircle size={14} />
                                דחייה
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                    <div key={event.id} className="event-card" style={{ cursor: 'pointer' }}
                      onClick={() => {
                        const d = new Date(event.date + 'T00:00:00');
                        navigate(`/calendar?year=${d.getFullYear()}&month=${d.getMonth()}`);
                      }}
                    >
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
                      style={{ borderRightColor: HOLIDAY_BORDER_COLORS[holiday.type] || '#e2e8f0', cursor: 'pointer' }}
                      onClick={() => {
                        const d = new Date(holiday.startDate + 'T00:00:00');
                        navigate(`/calendar?year=${d.getFullYear()}&month=${d.getMonth()}`);
                      }}
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

        {/* Admin Activity Feed */}
        {isGlobalAdmin() && (
          <div className="dashboard-section" style={{ marginTop: '1rem' }}>
            <div className="section-header">
              <Activity size={18} />
              <h2 className="section-title">סיכום פעילות בתי ספר</h2>
            </div>
            <div className="section-body">
              {activityLoading ? (
                <p className="section-empty">טוען פעילות...</p>
              ) : activityFeed.length === 0 ? (
                <p className="section-empty">אין פעילות אחרונה</p>
              ) : (
                <div className="activity-feed">
                  {activityFeed.map((item, idx) => (
                    <div key={idx} className="activity-item">
                      <div className={`activity-icon activity-icon--${item.icon}`}>
                        {item.icon === 'school' && <School size={14} />}
                        {item.icon === 'principal' && <Shield size={14} />}
                        {item.icon === 'staff' && <UserPlus size={14} />}
                      </div>
                      <div className="activity-content">
                        <span className="activity-text">{item.text}</span>
                        {item.detail && <span className="activity-detail">{item.detail}</span>}
                      </div>
                      <span className="activity-time">{formatActivityDate(item.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
