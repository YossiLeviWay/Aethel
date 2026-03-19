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
  orderBy
} from 'firebase/firestore';
import Header from '../Layout/Header';
import ChatPanel from './ChatPanel';
import { Plus, Trash2, MessageSquare, Clock, AlertTriangle, AlertCircle, ChevronDown, X, Search, Filter } from 'lucide-react';
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

export default function TaskBoard() {
  const { userData, selectedSchool } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [chatTask, setChatTask] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'todo',
    dueDate: '',
    assignee: ''
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

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !schoolId) return;
    await addDoc(collection(db, `tasks_${schoolId}`), {
      ...form,
      createdBy: userData?.fullName || '',
      createdAt: new Date().toISOString()
    });
    setForm({ title: '', description: '', priority: 'medium', status: 'todo', dueDate: '', assignee: '' });
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

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (task.title || '').toLowerCase().includes(q) ||
        (task.description || '').toLowerCase().includes(q) ||
        (task.assignee || '').toLowerCase().includes(q)
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
                <div className="form-group">
                  <label>אחראי</label>
                  <input name="assignee" value={form.assignee} onChange={handleChange} placeholder="שם" />
                </div>
              </div>
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

            return (
              <div key={task.id} className={`task-row ${overdue ? 'task-row--overdue' : ''}`}>
                <div className="task-priority" style={{ background: prio.bg }}>
                  <PrioIcon size={14} style={{ color: prio.color }} />
                </div>

                <div className="task-main">
                  <div className="task-title">{task.title}</div>
                  {task.description && <div className="task-desc">{task.description}</div>}
                  <div className="task-meta">
                    {task.assignee && <span className="task-assignee">{task.assignee}</span>}
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
