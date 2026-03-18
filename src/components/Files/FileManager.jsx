import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Header from '../Layout/Header';
import SpreadsheetEditor from './SpreadsheetEditor';
import DocumentEditor from './DocumentEditor';
import {
  FolderPlus,
  Upload,
  Trash2,
  FileText,
  Folder,
  ArrowRight,
  Download,
  Lock,
  X,
  Table2,
  FileEdit,
  Plus,
  Save,
  ArrowLeft
} from 'lucide-react';
import '../Gantt/Gantt.css';
import './Files.css';

export default function FileManager() {
  const { userData, selectedSchool, isPrincipal, isGlobalAdmin } = useAuth();
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderVisibility, setFolderVisibility] = useState('all');
  const [uploading, setUploading] = useState(false);

  // In-app file editing
  const [editingFile, setEditingFile] = useState(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState(null); // 'spreadsheet' | 'document'
  const [fileSaving, setFileSaving] = useState(false);

  const schoolId = selectedSchool || userData?.schoolId;
  const canManage = isPrincipal() || isGlobalAdmin();

  // Check permissions for current user
  function userCanAccessFolder(folder) {
    if (canManage) return true;
    if (folder.visibility === 'all') return true;
    if (folder.visibility === 'principal_only') return false;
    // Check specific permissions
    if (folder.allowedUsers && folder.allowedUsers.includes(userData?.uid)) return true;
    return folder.visibility === 'all';
  }

  function userCanCreateFiles() {
    if (canManage) return true;
    // Check if the current folder allows this user to create files
    const folder = folders.find(f => f.id === currentFolder);
    if (!folder) return false;
    if (folder.allowCreate && folder.allowCreate.includes(userData?.uid)) return true;
    if (userData?.role === 'editor') return true;
    return false;
  }

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, `folders_${schoolId}`), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const allFolders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFolders(allFolders.filter(f => userCanAccessFolder(f)));
    });
    return unsub;
  }, [schoolId, canManage, userData]);

  useEffect(() => {
    if (!schoolId || !currentFolder) { setFiles([]); return; }
    const q = query(
      collection(db, `files_${schoolId}`),
      where('folderId', '==', currentFolder),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId, currentFolder]);

  async function createFolder(e) {
    e.preventDefault();
    if (!folderName.trim() || !schoolId) return;
    try {
      await addDoc(collection(db, `folders_${schoolId}`), {
        name: folderName.trim(),
        visibility: folderVisibility,
        allowedUsers: [],
        allowCreate: [],
        createdBy: userData?.fullName || '',
        createdAt: new Date().toISOString()
      });
      setFolderName('');
      setShowNewFolder(false);
    } catch (err) {
      alert('שגיאה ביצירת תיקייה: ' + err.message);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file || !currentFolder || !schoolId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `schools/${schoolId}/${currentFolder}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, `files_${schoolId}`), {
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        fileType: 'upload',
        folderId: currentFolder,
        storagePath: `schools/${schoolId}/${currentFolder}/${file.name}`,
        uploadedBy: userData?.fullName || '',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      alert('שגיאה בהעלאת הקובץ');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function createInAppFile(e) {
    e.preventDefault();
    if (!newFileName.trim() || !newFileType || !currentFolder || !schoolId) return;
    try {
      const initialContent = newFileType === 'spreadsheet'
        ? JSON.stringify({ columns: 5, rows: 10, cells: {} })
        : '<p></p>';

      const newDoc = await addDoc(collection(db, `files_${schoolId}`), {
        name: newFileName.trim(),
        fileType: newFileType,
        content: initialContent,
        folderId: currentFolder,
        size: 0,
        type: newFileType === 'spreadsheet' ? 'application/x-spreadsheet' : 'text/html',
        uploadedBy: userData?.fullName || '',
        createdAt: new Date().toISOString()
      });
      setNewFileName('');
      setNewFileType(null);
      setShowCreateMenu(false);
      // Open the new file for editing
      setEditingFile({ id: newDoc.id, name: newFileName.trim(), fileType: newFileType, content: initialContent });
    } catch (err) {
      alert('שגיאה ביצירת קובץ: ' + err.message);
    }
  }

  async function saveFileContent(content) {
    if (!editingFile || !schoolId) return;
    setFileSaving(true);
    try {
      await updateDoc(doc(db, `files_${schoolId}`, editingFile.id), {
        content,
        lastModified: new Date().toISOString(),
        lastModifiedBy: userData?.fullName || ''
      });
      setEditingFile(prev => ({ ...prev, content }));
    } catch (err) {
      alert('שגיאה בשמירה: ' + err.message);
    }
    setFileSaving(false);
  }

  async function deleteFolder(folderId) {
    if (!confirm('האם למחוק תיקייה זו וכל תוכנה?')) return;
    const filesSnap = await getDocs(
      query(collection(db, `files_${schoolId}`), where('folderId', '==', folderId))
    );
    for (const fileDoc of filesSnap.docs) {
      const fileData = fileDoc.data();
      if (fileData.storagePath) {
        try { await deleteObject(ref(storage, fileData.storagePath)); } catch {}
      }
      await deleteDoc(doc(db, `files_${schoolId}`, fileDoc.id));
    }
    await deleteDoc(doc(db, `folders_${schoolId}`, folderId));
    if (currentFolder === folderId) setCurrentFolder(null);
  }

  async function deleteFile(fileItem) {
    if (!confirm('האם למחוק קובץ זה?')) return;
    if (fileItem.storagePath) {
      try { await deleteObject(ref(storage, fileItem.storagePath)); } catch {}
    }
    await deleteDoc(doc(db, `files_${schoolId}`, fileItem.id));
    if (editingFile?.id === fileItem.id) setEditingFile(null);
  }

  function openFile(file) {
    if (file.fileType === 'spreadsheet' || file.fileType === 'document') {
      setEditingFile(file);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function getFileIcon(file) {
    if (file.fileType === 'spreadsheet') return <Table2 size={18} className="file-icon file-icon--sheet" />;
    if (file.fileType === 'document') return <FileEdit size={18} className="file-icon file-icon--doc" />;
    return <FileText size={18} className="file-icon" />;
  }

  const currentFolderData = folders.find(f => f.id === currentFolder);

  // If editing a file, show the editor
  if (editingFile) {
    return (
      <div className="page">
        <Header title="קבצים ותיקיות" />
        <div className="file-editor-header">
          <button className="btn btn-secondary btn-sm" onClick={() => setEditingFile(null)}>
            <ArrowLeft size={14} />
            חזרה
          </button>
          <span className="file-editor-name">
            {editingFile.fileType === 'spreadsheet' ? <Table2 size={16} /> : <FileEdit size={16} />}
            {editingFile.name}
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => saveFileContent(editingFile.content)}
            disabled={fileSaving}
          >
            <Save size={14} />
            {fileSaving ? 'שומר...' : 'שמירה'}
          </button>
        </div>
        <div className="file-editor-body">
          {editingFile.fileType === 'spreadsheet' ? (
            <SpreadsheetEditor
              data={typeof editingFile.content === 'string' ? JSON.parse(editingFile.content) : editingFile.content}
              onChange={(newData) => setEditingFile(prev => ({ ...prev, content: JSON.stringify(newData) }))}
            />
          ) : (
            <DocumentEditor
              content={editingFile.content || ''}
              onChange={(newContent) => setEditingFile(prev => ({ ...prev, content: newContent }))}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Header title="קבצים ותיקיות" />
      <div className="page-content">
        <div className="files-layout">
          {/* Folder sidebar */}
          <div className="folders-panel">
            <div className="folders-header">
              <h3>תיקיות</h3>
              {canManage && (
                <button className="icon-btn" onClick={() => setShowNewFolder(true)} title="תיקייה חדשה">
                  <FolderPlus size={16} />
                </button>
              )}
            </div>

            {showNewFolder && (
              <form onSubmit={createFolder} className="new-folder-form">
                <input
                  value={folderName}
                  onChange={e => setFolderName(e.target.value)}
                  placeholder="שם התיקייה"
                  autoFocus
                />
                <select value={folderVisibility} onChange={e => setFolderVisibility(e.target.value)}>
                  <option value="all">כולם</option>
                  <option value="principal_only">מנהל בלבד</option>
                </select>
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary btn-sm">צור</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewFolder(false)}>
                    ביטול
                  </button>
                </div>
              </form>
            )}

            <div className="folder-list">
              {folders.map(f => (
                <div
                  key={f.id}
                  className={`folder-item ${currentFolder === f.id ? 'folder-item--active' : ''}`}
                  onClick={() => setCurrentFolder(f.id)}
                >
                  <Folder size={16} />
                  <span className="folder-name">{f.name}</span>
                  {f.visibility === 'principal_only' && <Lock size={12} className="folder-lock" />}
                  {canManage && (
                    <button
                      className="folder-delete"
                      onClick={e => { e.stopPropagation(); deleteFolder(f.id); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {folders.length === 0 && (
                <p className="folders-empty">אין תיקיות</p>
              )}
            </div>
          </div>

          {/* Files area */}
          <div className="files-panel">
            {currentFolder ? (
              <>
                <div className="files-header">
                  <div className="files-breadcrumb">
                    <button className="breadcrumb-link" onClick={() => setCurrentFolder(null)}>תיקיות</button>
                    <ArrowRight size={12} />
                    <span>{currentFolderData?.name}</span>
                  </div>
                  <div className="files-header-actions">
                    {userCanCreateFiles() && (
                      <div className="create-file-wrap">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => setShowCreateMenu(!showCreateMenu)}
                        >
                          <Plus size={14} />
                          קובץ חדש
                        </button>
                        {showCreateMenu && (
                          <div className="create-file-menu">
                            <button onClick={() => { setNewFileType('spreadsheet'); setShowCreateMenu(false); }}>
                              <Table2 size={16} />
                              גיליון אלקטרוני
                            </button>
                            <button onClick={() => { setNewFileType('document'); setShowCreateMenu(false); }}>
                              <FileEdit size={16} />
                              מסמך טקסט
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    <label className="upload-btn">
                      <Upload size={14} />
                      {uploading ? 'מעלה...' : 'העלאת קובץ'}
                      <input type="file" hidden onChange={handleUpload} disabled={uploading} />
                    </label>
                  </div>
                </div>

                {newFileType && (
                  <form onSubmit={createInAppFile} className="new-file-form">
                    <div className="new-file-type-badge">
                      {newFileType === 'spreadsheet' ? <Table2 size={14} /> : <FileEdit size={14} />}
                      {newFileType === 'spreadsheet' ? 'גיליון חדש' : 'מסמך חדש'}
                    </div>
                    <input
                      value={newFileName}
                      onChange={e => setNewFileName(e.target.value)}
                      placeholder="שם הקובץ"
                      autoFocus
                      required
                    />
                    <div className="form-actions">
                      <button type="submit" className="btn btn-primary btn-sm">צור</button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNewFileType(null)}>ביטול</button>
                    </div>
                  </form>
                )}

                <div className="file-list">
                  {files.map(f => (
                    <div key={f.id} className="file-item" onClick={() => openFile(f)}>
                      {getFileIcon(f)}
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          {f.fileType === 'spreadsheet' ? 'גיליון' : f.fileType === 'document' ? 'מסמך' : formatSize(f.size)}
                          {' · '}{f.uploadedBy}
                        </div>
                      </div>
                      <div className="file-actions" onClick={e => e.stopPropagation()}>
                        {f.url && (
                          <a href={f.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="הורדה">
                            <Download size={14} />
                          </a>
                        )}
                        {canManage && (
                          <button className="icon-btn icon-btn--danger" onClick={() => deleteFile(f)} title="מחיקה">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {files.length === 0 && (
                    <div className="empty-state">
                      <FileText size={32} className="empty-icon" />
                      <p>אין קבצים בתיקייה זו</p>
                      {userCanCreateFiles() && <p className="empty-hint">לחצו "קובץ חדש" ליצירת גיליון או מסמך</p>}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <Folder size={40} className="empty-icon" />
                <p>בחרו תיקייה מהרשימה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
