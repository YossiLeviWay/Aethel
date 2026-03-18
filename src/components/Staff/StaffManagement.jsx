import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from 'firebase/firestore';
import Header from '../Layout/Header';
import { Plus, Edit3, Trash2, Shield, Eye } from 'lucide-react';
import '../Gantt/Gantt.css';
import './Staff.css';

const ROLE_LABELS = {
  global_admin: 'מנהל על',
  principal: 'מנהל מוסד',
  editor: 'עורך',
  viewer: 'צופה'
};

export default function StaffManagement() {
  const { userData, selectedSchool, isPrincipal, isGlobalAdmin } = useAuth();
  const [staff, setStaff] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', jobTitle: '' });
  const [viewMode, setViewMode] = useState('table');

  const schoolId = selectedSchool || userData?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    loadStaff();
  }, [schoolId]);

  async function loadStaff() {
    const q = query(collection(db, 'users'), where('schoolId', '==', schoolId));
    const snap = await getDocs(q);
    setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleUpdateRole(userId) {
    await updateDoc(doc(db, 'users', userId), {
      role: editForm.role,
      jobTitle: editForm.jobTitle
    });
    setEditingUser(null);
    loadStaff();
  }

  async function handleDelete(userId) {
    if (!confirm('האם להסיר משתמש זה?')) return;
    await deleteDoc(doc(db, 'users', userId));
    loadStaff();
  }

  function startEdit(user) {
    setEditingUser(user.id);
    setEditForm({ role: user.role, jobTitle: user.jobTitle || '' });
  }

  const canEdit = isPrincipal() || isGlobalAdmin();

  return (
    <div className="page">
      <Header title="סגל וקהילה" />
      <div className="page-content">
        <div className="page-toolbar">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              טבלה
            </button>
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              כרטיסיות
            </button>
          </div>
          <span className="staff-count">{staff.length} אנשי צוות</span>
        </div>

        {viewMode === 'grid' ? (
          <div className="staff-grid">
            {staff.map(user => (
              <div key={user.id} className="staff-card">
                <div className="staff-card-avatar">
                  {user.fullName?.charAt(0) || '?'}
                </div>
                <h4 className="staff-card-name">{user.fullName}</h4>
                <p className="staff-card-title">{user.jobTitle || '—'}</p>
                <span className={`role-badge role-${user.role}`}>
                  {ROLE_LABELS[user.role] || 'צופה'}
                </span>
                <p className="staff-card-email">{user.email}</p>
                {canEdit && (
                  <div className="staff-card-actions">
                    <button className="icon-btn" onClick={() => startEdit(user)}>
                      <Shield size={14} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(user.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>תפקיד</th>
                  <th>דוא"ל</th>
                  <th>הרשאה</th>
                  {canEdit && <th>פעולות</th>}
                </tr>
              </thead>
              <tbody>
                {staff.map(user => (
                  <tr key={user.id}>
                    <td className="td-bold">
                      <div className="td-user">
                        <div className="td-avatar">{user.fullName?.charAt(0)}</div>
                        {user.fullName}
                      </div>
                    </td>
                    <td>{user.jobTitle || '—'}</td>
                    <td dir="ltr">{user.email}</td>
                    <td>
                      {editingUser === user.id ? (
                        <div className="inline-edit">
                          <select
                            value={editForm.role}
                            onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                          >
                            <option value="viewer">צופה</option>
                            <option value="editor">עורך</option>
                            <option value="principal">מנהל מוסד</option>
                          </select>
                          <button className="btn btn-primary btn-sm" onClick={() => handleUpdateRole(user.id)}>
                            שמירה
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <span className={`role-badge role-${user.role}`}>
                          {ROLE_LABELS[user.role] || 'צופה'}
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <div className="td-actions">
                          <button className="icon-btn" title="הרשאות" onClick={() => startEdit(user)}>
                            <Shield size={15} />
                          </button>
                          <button className="icon-btn icon-btn--danger" title="הסרה" onClick={() => handleDelete(user.id)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td colSpan={canEdit ? 5 : 4} className="td-empty">אין אנשי צוות רשומים</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
