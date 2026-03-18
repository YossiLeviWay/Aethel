import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import Header from '../Layout/Header';
import {
  FolderPlus,
  Upload,
  Trash2,
  FileText,
  Folder,
  ArrowRight,
  Download,
  Lock,
  X
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

  const schoolId = selectedSchool || userData?.schoolId;
  const canManage = isPrincipal() || isGlobalAdmin();

  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, `folders_${schoolId}`), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const allFolders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (canManage) {
        setFolders(allFolders);
      } else {
        setFolders(allFolders.filter(f => f.visibility === 'all' || f.visibility !== 'principal_only'));
      }
    });
    return unsub;
  }, [schoolId, canManage]);

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
    await addDoc(collection(db, `folders_${schoolId}`), {
      name: folderName.trim(),
      visibility: folderVisibility,
      createdBy: userData?.fullName || '',
      createdAt: new Date().toISOString()
    });
    setFolderName('');
    setShowNewFolder(false);
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

  async function deleteFolder(folderId) {
    if (!confirm('האם למחוק תיקייה זו וכל תוכנה?')) return;
    // Delete all files in folder
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
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const currentFolderData = folders.find(f => f.id === currentFolder);

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
                  <label className="upload-btn">
                    <Upload size={14} />
                    {uploading ? 'מעלה...' : 'העלאת קובץ'}
                    <input type="file" hidden onChange={handleUpload} disabled={uploading} />
                  </label>
                </div>

                <div className="file-list">
                  {files.map(f => (
                    <div key={f.id} className="file-item">
                      <FileText size={18} className="file-icon" />
                      <div className="file-info">
                        <div className="file-name">{f.name}</div>
                        <div className="file-meta">
                          {formatSize(f.size)} · {f.uploadedBy}
                        </div>
                      </div>
                      <div className="file-actions">
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="הורדה">
                          <Download size={14} />
                        </a>
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
