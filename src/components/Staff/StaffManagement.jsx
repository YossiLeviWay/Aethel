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
  addDoc,
  doc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import Header from '../Layout/Header';
import { Plus, Edit3, Trash2, Shield, Eye, Search, X, UserPlus } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', jobTitle: '', role: 'viewer' });
  const [addError, setAddError] = useState('');

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

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) return;
    setAddError('');

    try {
      // Create a temporary password - user should reset
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      const cred = await createUserWithEmailAndPassword(auth, addForm.email, tempPassword);

      await addDoc(collection(db, 'users'), {
        uid: cred.user.uid,
        email: addForm.email,
        fullName: addForm.fullName,
        jobTitle: addForm.jobTitle,
        role: addForm.role,
        schoolId,
        phone: '',
        avatar: '',
        createdAt: new Date().toISOString()
      });

      setShowAddModal(false);
      setAddForm({ fullName: '', email: '', jobTitle: '', role: 'viewer' });
      loadStaff();
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setAddError('כתובת הדוא"ל כבר קיימת במערכת');
      } else {
        setAddError('שגיאה בהוספת המשתמש: ' + err.message);
      }
    }
  }

  const canEdit = isPrincipal() || isGlobalAdmin();
  const isAdmin = isGlobalAdmin();

  // Filter staff based on search
  const filteredStaff = staff.filter(user => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (user.fullName || '').toLowerCase().includes(q) ||
      (user.email || '').toLowerCase().includes(q) ||
      (user.jobTitle || '').toLowerCase().includes(q) ||
      (ROLE_LABELS[user.role] || '').includes(q)
    );
  });

  return (
    <div className="page">
      <Header title="סגל וקהילה" />
      <div className="page-content">
        <div className="page-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            {isAdmin && (
              <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                <UserPlus size={16} />
                הוספת איש צוות
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="search-bar">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="חיפוש צוות..."
              />
            </div>
            <span className="staff-count">{filteredStaff.length} אנשי צוות</span>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="staff-grid">
            {filteredStaff.map(user => (
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
                {filteredStaff.map(user => (
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
                            {isAdmin && <option value="principal">מנהל מוסד</option>}
                          </select>
                          <input
                            value={editForm.jobTitle}
                            onChange={e => setEditForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                            placeholder="תפקיד"
                            style={{ padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', maxWidth: 120 }}
                          />
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
                {filteredStaff.length === 0 && (
                  <tr><td colSpan={canEdit ? 5 : 4} className="td-empty">
                    {searchQuery ? 'לא נמצאו תוצאות' : 'אין אנשי צוות רשומים'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Staff Modal */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>הוספת איש צוות</h3>
                <button className="modal-close" onClick={() => setShowAddModal(false)}><X size={18} /></button>
              </div>
              <div className="modal-form">
                <form onSubmit={handleAddStaff} className="add-staff-form">
                  <div className="form-group">
                    <label>שם מלא</label>
                    <input
                      value={addForm.fullName}
                      onChange={e => setAddForm(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="שם פרטי ומשפחה"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>דוא"ל</label>
                    <input
                      type="email"
                      value={addForm.email}
                      onChange={e => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>תפקיד</label>
                    <input
                      value={addForm.jobTitle}
                      onChange={e => setAddForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      placeholder="תפקיד"
                    />
                  </div>
                  <div className="form-group">
                    <label>הרשאה</label>
                    <select
                      value={addForm.role}
                      onChange={e => setAddForm(prev => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="viewer">צופה</option>
                      <option value="editor">עורך</option>
                      {isAdmin && <option value="principal">מנהל מוסד</option>}
                    </select>
                  </div>
                  {addError && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 500 }}>
                      {addError}
                    </div>
                  )}
                  <div className="modal-actions">
                    <button type="submit" className="btn btn-primary">הוספה</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>ביטול</button>
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
