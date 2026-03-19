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
  doc,
  setDoc,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import Header from '../Layout/Header';
import { Plus, Edit3, Trash2, Shield, Eye, Search, X, UserPlus, CheckCircle, XCircle, Lock, ChevronDown, ChevronUp, Save } from 'lucide-react';
import '../Gantt/Gantt.css';
import './Staff.css';

const ROLE_LABELS = {
  global_admin: 'מנהל על',
  principal: 'מנהל מוסד',
  editor: 'עורך',
  viewer: 'צופה'
};

const AVATAR_STYLES = [
  { key: 'default', label: 'כחול קלאסי' },
  { key: 'sunset', label: 'שקיעה' },
  { key: 'ocean', label: 'אוקיינוס' },
  { key: 'forest', label: 'יער' },
  { key: 'royal', label: 'מלכותי' },
  { key: 'midnight', label: 'חצות' },
  { key: 'rose', label: 'ורד' },
  { key: 'amber', label: 'ענבר' },
  { key: 'slate', label: 'אפור' },
  { key: 'emerald', label: 'אמרלד' },
  { key: 'ruby', label: 'רובי' },
  { key: 'sapphire', label: 'ספיר' },
];

const DEFAULT_PERMISSIONS = {
  calendar_view: true,
  calendar_edit: false,
  categories_view: true,
  categories_edit: false,
  staff_view: true,
  staff_edit: false,
  tasks_view: true,
  tasks_edit: false,
  tasks_assign: false,
  teams_view: true,
  teams_edit: false,
  files_view: true,
  files_upload: false,
  files_delete: false,
  messages_send: true,
  messages_delete: false,
  holidays_view: true,
  holidays_edit: false,
  data_mapping_view: true,
  data_mapping_edit: false,
  schools_manage: false,
  settings_edit: false,
};

const PERMISSION_GROUPS = [
  {
    label: 'לוח שנה',
    permissions: [
      { key: 'calendar_view', label: 'צפייה בלוח שנה' },
      { key: 'calendar_edit', label: 'עריכת אירועים' },
    ]
  },
  {
    label: 'קטגוריות',
    permissions: [
      { key: 'categories_view', label: 'צפייה בקטגוריות' },
      { key: 'categories_edit', label: 'עריכת קטגוריות' },
    ]
  },
  {
    label: 'סגל וקהילה',
    permissions: [
      { key: 'staff_view', label: 'צפייה בסגל' },
      { key: 'staff_edit', label: 'עריכת סגל והרשאות' },
    ]
  },
  {
    label: 'משימות',
    permissions: [
      { key: 'tasks_view', label: 'צפייה במשימות' },
      { key: 'tasks_edit', label: 'יצירה ועריכת משימות' },
      { key: 'tasks_assign', label: 'הקצאת משימות לאחרים' },
    ]
  },
  {
    label: 'צוותים',
    permissions: [
      { key: 'teams_view', label: 'צפייה בצוותים' },
      { key: 'teams_edit', label: 'ניהול צוותים' },
    ]
  },
  {
    label: 'קבצים',
    permissions: [
      { key: 'files_view', label: 'צפייה בקבצים' },
      { key: 'files_upload', label: 'העלאת קבצים' },
      { key: 'files_delete', label: 'מחיקת קבצים' },
    ]
  },
  {
    label: 'הודעות',
    permissions: [
      { key: 'messages_send', label: 'שליחת הודעות' },
      { key: 'messages_delete', label: 'מחיקת הודעות' },
    ]
  },
  {
    label: 'חגים וחופשות',
    permissions: [
      { key: 'holidays_view', label: 'צפייה בחגים' },
      { key: 'holidays_edit', label: 'עריכת חגים' },
    ]
  },
  {
    label: 'מיפוי נתונים',
    permissions: [
      { key: 'data_mapping_view', label: 'צפייה במיפוי' },
      { key: 'data_mapping_edit', label: 'עריכת מיפוי נתונים' },
    ]
  },
  {
    label: 'הגדרות מערכת',
    permissions: [
      { key: 'schools_manage', label: 'ניהול מוסדות' },
      { key: 'settings_edit', label: 'עריכת הגדרות' },
    ]
  },
];

function getPermissionsForRole(role) {
  const perms = { ...DEFAULT_PERMISSIONS };
  if (role === 'global_admin') {
    for (const key of Object.keys(perms)) perms[key] = true;
  } else if (role === 'principal') {
    for (const key of Object.keys(perms)) perms[key] = true;
    perms.schools_manage = false;
  } else if (role === 'editor') {
    perms.calendar_edit = true;
    perms.tasks_edit = true;
    perms.tasks_assign = true;
    perms.teams_edit = true;
    perms.files_upload = true;
    perms.messages_send = true;
    perms.data_mapping_edit = true;
  }
  return perms;
}

export default function StaffManagement() {
  const { userData, selectedSchool, isPrincipal, isGlobalAdmin, approveUser, rejectUser } = useAuth();
  const [staff, setStaff] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: '', jobTitle: '', assignedSchoolId: '' });
  const [viewMode, setViewMode] = useState('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', email: '', jobTitle: '', role: 'viewer', schoolId: '', password: '', avatarStyle: 'default' });
  const [addError, setAddError] = useState('');
  const [schools, setSchools] = useState([]);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [permissionsForm, setPermissionsForm] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});

  const schoolId = selectedSchool || userData?.schoolId;

  useEffect(() => {
    if (!schoolId) return;
    loadStaff();
    loadPendingUsers();
  }, [schoolId]);

  useEffect(() => {
    loadSchools();
  }, []);

  async function loadSchools() {
    try {
      const snap = await getDocs(collection(db, 'schools'));
      setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Error loading schools:', err);
    }
  }

  async function loadStaff() {
    const q1 = query(collection(db, 'users'), where('schoolIds', 'array-contains', schoolId));
    const snap1 = await getDocs(q1);
    const staffMap = new Map();
    snap1.docs.forEach(d => staffMap.set(d.id, { id: d.id, ...d.data() }));

    const q2 = query(collection(db, 'users'), where('schoolId', '==', schoolId));
    const snap2 = await getDocs(q2);
    snap2.docs.forEach(d => {
      if (!staffMap.has(d.id)) {
        const data = d.data();
        const pending = data.pendingSchools || [];
        if (!pending.includes(schoolId)) {
          staffMap.set(d.id, { id: d.id, ...data });
        }
      }
    });

    setStaff(Array.from(staffMap.values()));
  }

  async function loadPendingUsers() {
    const q = query(collection(db, 'users'), where('pendingSchools', 'array-contains', schoolId));
    const snap = await getDocs(q);
    setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  async function handleApprove(userId) {
    await approveUser(userId, schoolId);
    loadStaff();
    loadPendingUsers();
  }

  async function handleReject(userId) {
    if (!confirm('האם לדחות את בקשת המשתמש?')) return;
    await rejectUser(userId, schoolId);
    loadPendingUsers();
  }

  async function handleUpdateRole(userId) {
    const updateData = {
      role: editForm.role,
      jobTitle: editForm.jobTitle
    };
    if (editForm.assignedSchoolId) {
      updateData.schoolIds = arrayUnion(editForm.assignedSchoolId);
    }
    await updateDoc(doc(db, 'users', userId), updateData);
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
    setEditForm({ role: user.role, jobTitle: user.jobTitle || '', assignedSchoolId: '' });
  }

  async function openPermissions(user) {
    setPermissionsUser(user);
    // Load saved permissions or use role defaults
    try {
      const permDoc = await getDoc(doc(db, 'users', user.id));
      const data = permDoc.data();
      if (data?.permissions) {
        setPermissionsForm({ ...getPermissionsForRole(user.role), ...data.permissions });
      } else {
        setPermissionsForm(getPermissionsForRole(user.role));
      }
    } catch {
      setPermissionsForm(getPermissionsForRole(user.role));
    }
    // Expand all groups by default
    const expanded = {};
    PERMISSION_GROUPS.forEach(g => { expanded[g.label] = true; });
    setExpandedGroups(expanded);
  }

  async function savePermissions() {
    if (!permissionsUser) return;
    try {
      await updateDoc(doc(db, 'users', permissionsUser.id), { permissions: permissionsForm });
      setPermissionsUser(null);
      loadStaff();
    } catch (err) {
      alert('שגיאה בשמירת ההרשאות: ' + err.message);
    }
  }

  function togglePermission(key) {
    setPermissionsForm(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleGroup(label) {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleAddStaff(e) {
    e.preventDefault();
    if (!addForm.fullName.trim() || !addForm.email.trim()) return;
    if (!addForm.password || addForm.password.length < 6) {
      setAddError('הסיסמא חייבת להכיל לפחות 6 תווים');
      return;
    }
    setAddError('');

    const targetSchoolId = addForm.schoolId || schoolId;

    try {
      const cred = await createUserWithEmailAndPassword(auth, addForm.email, addForm.password);

      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email: addForm.email,
        fullName: addForm.fullName,
        jobTitle: addForm.jobTitle,
        role: addForm.role,
        schoolId: targetSchoolId,
        schoolIds: [targetSchoolId],
        pendingSchools: [],
        permissions: getPermissionsForRole(addForm.role),
        avatarStyle: addForm.avatarStyle || 'default',
        phone: '',
        avatar: '',
        createdAt: new Date().toISOString()
      });

      setShowAddModal(false);
      setAddForm({ fullName: '', email: '', jobTitle: '', role: 'viewer', schoolId: '', password: '', avatarStyle: 'default' });
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
  const canApprove = isPrincipal() || isGlobalAdmin();

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

        {/* Pending Approval Section */}
        {canApprove && pendingUsers.length > 0 && (
          <div className="pending-approval-section" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 8 }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: '#92400e' }}>
              ממתינים לאישור ({pendingUsers.length})
            </h3>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>שם</th>
                    <th>תפקיד</th>
                    <th>דוא"ל</th>
                    <th>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingUsers.map(user => (
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
                        <div className="td-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(user.id)}
                            title="אישור"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            <CheckCircle size={14} />
                            אישור
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleReject(user.id)}
                            title="דחייה"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#ef4444' }}
                          >
                            <XCircle size={14} />
                            דחייה
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                    <button className="icon-btn" onClick={() => openPermissions(user)} title="הרשאות מפורטות">
                      <Shield size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => startEdit(user)} title="עריכה">
                      <Edit3 size={14} />
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
                          {isAdmin && (
                            <select
                              value={editForm.assignedSchoolId}
                              onChange={e => setEditForm(prev => ({ ...prev, assignedSchoolId: e.target.value }))}
                              style={{ padding: '0.3rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: '0.78rem', fontFamily: 'Inter, sans-serif', maxWidth: 140 }}
                            >
                              <option value="">שיוך למוסד נוסף</option>
                              {schools.map(s => (
                                <option key={s.id} value={s.id}>{s.name || s.id}</option>
                              ))}
                            </select>
                          )}
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
                          <button className="icon-btn" title="הרשאות מפורטות" onClick={() => openPermissions(user)}>
                            <Shield size={15} />
                          </button>
                          <button className="icon-btn" title="עריכת תפקיד" onClick={() => startEdit(user)}>
                            <Edit3 size={15} />
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
                    <label>
                      <Lock size={14} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: '0.3rem' }} />
                      סיסמא
                    </label>
                    <input
                      type="password"
                      value={addForm.password}
                      onChange={e => setAddForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="סיסמא (לפחות 6 תווים)"
                      dir="ltr"
                      required
                      minLength={6}
                    />
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                      הסיסמא תשמש את איש הצוות להתחברות למערכת
                    </span>
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
                    <label>מוסד</label>
                    <select
                      value={addForm.schoolId}
                      onChange={e => setAddForm(prev => ({ ...prev, schoolId: e.target.value }))}
                    >
                      <option value="">מוסד נוכחי</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>{s.name || s.id}</option>
                      ))}
                    </select>
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
                  <div className="form-group">
                    <label>סגנון אוואטר</label>
                    <div className="avatar-style-picker">
                      {AVATAR_STYLES.map(s => (
                        <button
                          key={s.key}
                          type="button"
                          className={`avatar-style-option avatar-style--${s.key} ${addForm.avatarStyle === s.key ? 'avatar-style-option--active' : ''}`}
                          onClick={() => setAddForm(prev => ({ ...prev, avatarStyle: s.key }))}
                          title={s.label}
                        >
                          {addForm.fullName?.charAt(0) || '?'}
                        </button>
                      ))}
                    </div>
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

        {/* Detailed Permissions Modal */}
        {permissionsUser && (
          <div className="modal-overlay" onClick={() => setPermissionsUser(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
              <div className="modal-header">
                <h3>הרשאות — {permissionsUser.fullName}</h3>
                <button className="modal-close" onClick={() => setPermissionsUser(null)}><X size={18} /></button>
              </div>
              <div style={{ padding: '0.75rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>תפקיד:</span>
                  <span className={`role-badge role-${permissionsUser.role}`}>
                    {ROLE_LABELS[permissionsUser.role] || 'צופה'}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 1rem' }}>
                  ניתן להתאים את ההרשאות לכל משתמש בנפרד. שינויים ישפיעו על הגישה של המשתמש לפעולות שונות באפליקציה.
                </p>
              </div>
              <div className="permissions-list">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.label} className="permissions-group">
                    <button
                      className="permissions-group-header"
                      onClick={() => toggleGroup(group.label)}
                    >
                      <span className="permissions-group-title">{group.label}</span>
                      <span className="permissions-group-summary">
                        {group.permissions.filter(p => permissionsForm[p.key]).length}/{group.permissions.length}
                      </span>
                      {expandedGroups[group.label] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedGroups[group.label] && (
                      <div className="permissions-group-items">
                        {group.permissions.map(perm => (
                          <label key={perm.key} className="permissions-item">
                            <input
                              type="checkbox"
                              checked={!!permissionsForm[perm.key]}
                              onChange={() => togglePermission(perm.key)}
                            />
                            <span>{perm.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="modal-actions" style={{ padding: '1rem 1.5rem' }}>
                <button className="btn btn-primary" onClick={savePermissions}>
                  <Save size={16} />
                  שמירת הרשאות
                </button>
                <button className="btn btn-secondary" onClick={() => setPermissionsUser(null)}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
