import { useState, useEffect } from 'react';
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
  orderBy,
  getDocs
} from 'firebase/firestore';
import Header from '../Layout/Header';
import ChatPanel from './ChatPanel';
import { Plus, Trash2, MessageSquare, Clock, AlertTriangle, AlertCircle, ChevronDown, X, Search, Filter, Users } from 'lucide-react';
import '../Gantt/Gantt.css';
import './Tasks.css';

const PRIORITY_CONFIG = {
  high: { label: 'גבוהה', icon: AlertCircle, color: '#ef4444', bg: '#fef2f2' },
  medium: { label: 'בינונית', icon: AlertTriangle, color: '#f59e0b', bg: '#fffbeb' },
  low: { label: 'נמוכה', icon: Clock, color: '#22c55e', bg: '#f0fdf4' }
};

const STATUS_CONFIG = {
  todo: { label: 'לביצוע', color: '#64748b' },
  in_progress: { label: 'בתהליך', color: '#2563eb' },
  done: { label: 'הושלם', color: '#22c55e' }
};

const ASSIGNEE_TYPES = {
  all_school: 'כל בית הספר',
  team: 'צוות',
  individual: 'אנשי צוות'
};

export default function TaskBoard() {
  const { userData, selectedSchool } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [chatTask, setChatTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [staff, setStaff] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    assigneeType: 'all_school',
    assigneeIds: [],
    assigneeTeamId: ''
  });

  const schoolId = selectedSchool || userData?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    const q = query(
      collection(db, `tasks_${schoolId}`),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId]);

  // Load staff
  useEffect(() => {
    if (!schoolId) return;
    async function fetchStaff() {
      const results = [];
      const seen = new Set();
      try {
        const q1 = query(collection(db, 'users'), where('schoolIds', 'array-contains', schoolId));
        const snap1 = await getDocs(q1);
        snap1.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); results.push({ id: d.id, ...d.data() }); } });
      } catch {}
      try {
        const q2 = query(collection(db, 'users'), where('schoolId', '==', schoolId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); results.push({ id: d.id, ...d.data() }); } });
      } catch {}
      setStaff(results);
    }
    fetchStaff();
  }, [schoolId]);

  // Load teams
  useEffect(() => {
    if (!schoolId) return;
    const unsub = onSnapshot(collection(db, `teams_${schoolId}`), (snap) => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function toggleAssignee(userId) {
    setForm(prev => {
      const ids = prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter(id => id !== userId)
        : [...prev.assigneeIds, userId];
      return { ...prev, assigneeIds: ids };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !schoolId) return;

    const taskData = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate,
      assigneeType: form.assigneeType,
      assigneeIds: form.assigneeType === 'individual' ? form.assigneeIds : [],
      assigneeTeamId: form.assigneeType === 'team' ? form.assigneeTeamId : '',
      createdBy: userData?.fullName || '',
      createdAt: new Date().toISOString()
    };

    await addDoc(collection(db, `tasks_${schoolId}`), taskData);
    setForm({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assigneeType: 'all_school', assigneeIds: [], assigneeTeamId: '' });
    setShowForm(false);
  }

  async function updateTaskStatus(taskId, newStatus) {
    await updateDoc(doc(db, `tasks_${schoolId}`, taskId), { status: newStatus });
  }

  async function deleteTask(taskId) {
    if (!confirm('האם למחוק משימה זו?')) return;
    await deleteDoc(doc(db, `tasks_${schoolId}`, taskId));
  }

  function isOverdue(dueDate) {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  }

  function getAssigneeDisplay(task) {
    // Support old format (simple string)
    if (task.assignee && !task.assigneeType) {
      return task.assignee;
    }

    if (task.assigneeType === 'all_school') {
      return 'כל בית הספר';
    }
    if (task.assigneeType === 'team') {
      const team = teams.find(t => t.id === task.assigneeTeamId);
      return team ? team.name : 'צוות';
    }
    if (task.assigneeType === 'individual' && task.assigneeIds?.length > 0) {
      const names = task.assigneeIds.map(id => {
        const user = staff.find(u => u.id === id || u.uid === id);
        return user?.fullName || id;
      });
      if (names.length <= 2) return names.join(', ');
      return `${names[0]} +${names.length - 1}`;
    }
    return '';
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const assigneeText = getAssigneeDisplay(task).toLowerCase();
      return (
        (task.title || '').toLowerCase().includes(q) ||
        (task.description || '').toLowerCase().includes(q) ||
        assigneeText.includes(q)
      );
    }
    return true;
  });

  return (
    <div className="page">
      <Header title="משימות" />
      <div className="page-content">
        <div className="page-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={16} />
              משימה חדשה
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ minWidth: 160 }}>
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש משימות..."
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.78rem', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
            >
              <option value="all">כל הסטטוסים</option>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              style={{ padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.78rem', background: '#f8fafc', fontFamily: 'Inter, sans-serif' }}
            >
              <option value="all">כל הדחיפויות</option>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
            <span className="task-stats">
              {tasks.filter(t => t.status === 'done').length}/{tasks.length} הושלמו
            </span>
          </div>
        </div>

        {showForm && (
          <div className="card form-card">
            <form onSubmit={handleSubmit} className="task-form">
              <div className="form-group">
                <label>כותרת</label>
                <input name="title" value={form.title} onChange={handleChange} placeholder="שם המשימה" required />
              </div>
              <div className="form-group">
                <label>תיאור</label>
                <textarea name="description" value={form.description} onChange={handleChange} placeholder="פירוט..." rows={2} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>דחיפות</label>
                  <select name="priority" value={form.priority} onChange={handleChange}>
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>תאריך יעד</label>
                  <input name="dueDate" type="date" value={form.dueDate} onChange={handleChange} dir="ltr" />
                </div>
              </div>

              {/* Assignee Section */}
              <div className="form-group">
                <label>שיוך משימה</label>
                <select name="assigneeType" value={form.assigneeType} onChange={handleChange}>
                  <option value="all_school">כל בית הספר</option>
                  <option value="team">צוות ספציפי</option>
                  <option value="individual">אנשי צוות ספציפיים</option>
                </select>
              </div>

              {form.assigneeType === 'team' && (
                <div className="form-group">
                  <label>בחירת צוות</label>
                  <select name="assigneeTeamId" value={form.assigneeTeamId} onChange={handleChange}>
                    <option value="">בחרו צוות</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({(t.memberIds || []).length} חברים)</option>
                    ))}
                  </select>
                </div>
              )}

              {form.assigneeType === 'individual' && (
                <div className="form-group">
                  <label>בחירת אנשי צוות</label>
                  <div className="assignee-picker">
                    {staff.map(u => {
                      const userId = u.uid || u.id;
                      const isSelected = form.assigneeIds.includes(userId);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          className={`assignee-chip ${isSelected ? 'assignee-chip--selected' : ''}`}
                          onClick={() => toggleAssignee(userId)}
                        >
                          <span className="assignee-chip-avatar">{u.fullName?.charAt(0)}</span>
                          {u.fullName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">הוספה</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>ביטול</button>
              </div>
            </form>
          </div>
        )}

        <div className="task-list">
          {filteredTasks.map(task => {
            const prio = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
            const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
            const PrioIcon = prio.icon;
            const overdue = task.status !== 'done' && isOverdue(task.dueDate);
            const assigneeDisplay = getAssigneeDisplay(task);

            return (
              <div key={task.id} className={`task-row ${overdue ? 'task-row--overdue' : ''}`}>
                <div className="task-priority" style={{ background: prio.bg }}>
                  <PrioIcon size={14} style={{ color: prio.color }} />
                </div>

                <div className="task-main">
                  <div className="task-title">{task.title}</div>
                  {task.description && <div className="task-desc">{task.description}</div>}
                  <div className="task-meta">
                    {assigneeDisplay && (
                      <span className="task-assignee">
                        {task.assigneeType === 'team' && <Users size={11} style={{ marginLeft: '0.2rem', verticalAlign: 'middle' }} />}
                        {assigneeDisplay}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={`task-due ${overdue ? 'task-due--late' : ''}`}>
                        {new Date(task.dueDate).toLocaleDateString('he-IL')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="task-status-wrap">
                  <select
                    className="task-status-select"
                    value={task.status}
                    onChange={e => updateTaskStatus(task.id, e.target.value)}
                    style={{ color: status.color, borderColor: status.color }}
                  >
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>

                <div className="task-actions">
                  <button
                    className="icon-btn"
                    title="צ'אט"
                    onClick={() => setChatTask(task)}
                  >
                    <MessageSquare size={15} />
                  </button>
                  <button
                    className="icon-btn icon-btn--danger"
                    title="מחיקה"
                    onClick={() => deleteTask(task.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          {filteredTasks.length === 0 && (
            <div className="empty-state">
              <p>{searchQuery || filterStatus !== 'all' || filterPriority !== 'all' ? 'לא נמצאו תוצאות' : 'אין משימות עדיין'}</p>
            </div>
          )}
        </div>
      </div>

      {chatTask && (
        <ChatPanel
          task={chatTask}
          schoolId={schoolId}
          currentUser={userData}
          onClose={() => setChatTask(null)}
        />
      )}
    </div>
  );
}
