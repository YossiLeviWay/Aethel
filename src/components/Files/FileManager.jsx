import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, storage } from '../../firebase';
import PermissionsMenu from '../Shared/PermissionsMenu';
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
  onSnapshot,
  arrayUnion,
  arrayRemove
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
  FolderOpen,
  Download,
  Lock,
  X,
  Table2,
  FileEdit,
  Plus,
  Save,
  Search,
  Pin,
  ChevronDown,
  ChevronLeft,
  Maximize2,
  Minimize2
} from 'lucide-react';
import '../Gantt/Gantt.css';
import './Files.css';

export default function FileManager() {
  const { userData, currentUser, selectedSchool, isPrincipal, isGlobalAdmin } = useAuth();
  const uid = currentUser?.uid;
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderVisibility, setFolderVisibility] = useState('all');
  const [uploading, setUploading] = useState(false);

  // In-app file editing
  const [editingFile, setEditingFile] = useState(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileType, setNewFileType] = useState(null);
  const [fileSaving, setFileSaving] = useState(false);
  const [fileSearch, setFileSearch] = useState('');
  const [permMenu, setPermMenu] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [createInFolder, setCreateInFolder] = useState(null); // folder id for new file creation

  const schoolId = selectedSchool || userData?.schoolId;
  const canManage = isPrincipal() || isGlobalAdmin();

  function userCanAccessFolder(folder) {
    if (canManage) return true;
    if (folder.visibility === 'all') return true;
    if (folder.visibility === 'principal_only') return false;
    if (folder.allowedUsers && folder.allowedUsers.includes(userData?.uid)) return true;
    return folder.visibility === 'all';
  }

  function userCanCreateFiles() {
    if (canManage) return true;
    const folder = folders.find(f => f.id === selectedFolder);
    if (!folder) return false;
    if (folder.allowCreate && folder.allowCreate.includes(userData?.uid)) return true;
    if (userData?.role === 'editor') return true;
    return false;
  }

  async function togglePinFile(fileId, isPinned) {
    if (!uid || !schoolId) return;
    await updateDoc(doc(db, `files_${schoolId}`, fileId), {
      pinnedBy: isPinned ? arrayRemove(uid) : arrayUnion(uid)
    });
  }

  async function togglePinFolder(folderId, isPinned) {
    if (!uid || !schoolId) return;
    await updateDoc(doc(db, `folders_${schoolId}`, folderId), {
      pinnedBy: isPinned ? arrayRemove(uid) : arrayUnion(uid)
    });
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

  // Load all files for all folders
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, `files_${schoolId}`), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [schoolId]);

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

  async function handleUpload(e, folderId) {
    const file = e.target.files[0];
    if (!file || !folderId || !schoolId) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `schools/${schoolId}/${folderId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, `files_${schoolId}`), {
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        fileType: 'upload',
        folderId: folderId,
        storagePath: `schools/${schoolId}/${folderId}/${file.name}`,
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
    const folderId = createInFolder || selectedFolder;
    if (!newFileName.trim() || !newFileType || !folderId || !schoolId) return;
    try {
      const initialContent = newFileType === 'spreadsheet'
        ? JSON.stringify({ columns: 5, rows: 10, cells: {}, headers: {}, columnWidths: {}, rowHeights: {} })
        : '<p></p>';

      const newDoc = await addDoc(collection(db, `files_${schoolId}`), {
        name: newFileName.trim(),
        fileType: newFileType,
        content: initialContent,
        folderId: folderId,
        size: 0,
        type: newFileType === 'spreadsheet' ? 'application/x-spreadsheet' : 'text/html',
        uploadedBy: userData?.fullName || '',
        createdAt: new Date().toISOString()
      });
      setNewFileName('');
      setNewFileType(null);
      setShowCreateMenu(false);
      setCreateInFolder(null);
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
    if (selectedFolder === folderId) setSelectedFolder(null);
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

  function getFileIcon(file, size = 15) {
    if (file.fileType === 'spreadsheet') return <Table2 size={size} className="file-icon file-icon--sheet" />;
    if (file.fileType === 'document') return <FileEdit size={size} className="file-icon file-icon--doc" />;
    return <FileText size={size} className="file-icon" />;
  }

  function toggleFolder(folderId) {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
    setSelectedFolder(folderId);
  }

  // Sort folders: pinned first, then alphabetical
  const sortedFolders = [...folders]
    .filter(f => !fileSearch.trim() || f.name.toLowerCase().includes(fileSearch.toLowerCase()) ||
      files.some(file => file.folderId === f.id && file.name.toLowerCase().includes(fileSearch.toLowerCase())))
    .sort((a, b) => {
      const aPin = a.pinnedBy?.includes(uid) ? 0 : 1;
      const bPin = b.pinnedBy?.includes(uid) ? 0 : 1;
      if (aPin !== bPin) return aPin - bPin;
      return (a.name || '').localeCompare(b.name || '');
    });

  const pinnedFolders = sortedFolders.filter(f => f.pinnedBy?.includes(uid));
  const unpinnedFolders = sortedFolders.filter(f => !f.pinnedBy?.includes(uid));

  function getFilesForFolder(folderId) {
    return files
      .filter(f => f.folderId === folderId)
      .filter(f => !fileSearch.trim() || f.name.toLowerCase().includes(fileSearch.toLowerCase()))
      .sort((a, b) => {
        const aPin = a.pinnedBy?.includes(uid) ? 0 : 1;
        const bPin = b.pinnedBy?.includes(uid) ? 0 : 1;
        return aPin - bPin;
      });
  }

  // Get pinned files across all folders
  const pinnedFiles = files.filter(f => f.pinnedBy?.includes(uid))
    .filter(f => !fileSearch.trim() || f.name.toLowerCase().includes(fileSearch.toLowerCase()));

  function renderFolderTree(folderList) {
    return folderList.map(folder => {
      const isExpanded = expandedFolders[folder.id];
      const folderFiles = getFilesForFolder(folder.id);
      const isPinnedFolder = folder.pinnedBy?.includes(uid);
      const isSelected = selectedFolder === folder.id;

      return (
        <div key={folder.id} className="tree-folder">
          <div
            className={`tree-folder-item ${isSelected ? 'tree-folder-item--active' : ''}`}
            onClick={() => toggleFolder(folder.id)}
            onContextMenu={e => {
              if (!canManage) return;
              e.preventDefault();
              setPermMenu({ type: 'folder', id: folder.id, name: folder.name, position: { x: e.clientX, y: e.clientY } });
            }}
          >
            <span className="tree-chevron">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronLeft size={12} />}
            </span>
            {isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />}
            <span className="tree-folder-name">{folder.name}</span>
            {folder.visibility === 'principal_only' && <Lock size={10} className="folder-lock" />}
            <span className="tree-folder-count">{folderFiles.length}</span>
            <div className="tree-item-actions" onClick={e => e.stopPropagation()}>
              <button
                className={`tree-pin-btn ${isPinnedFolder ? 'tree-pin-btn--active' : ''}`}
                title={isPinnedFolder ? 'הסר נעיצה' : 'נעץ תיקייה'}
                onClick={() => togglePinFolder(folder.id, isPinnedFolder)}
              >
                <Pin size={11} style={isPinnedFolder ? { color: '#2563eb' } : undefined} />
              </button>
              {canManage && (
                <button
                  className="tree-delete-btn"
                  onClick={() => deleteFolder(folder.id)}
                  title="מחיקת תיקייה"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>

          {isExpanded && (
            <div className="tree-folder-children">
              {folderFiles.map(f => {
                const isPinned = f.pinnedBy?.includes(uid);
                return (
                  <div
                    key={f.id}
                    className={`tree-file-item ${editingFile?.id === f.id ? 'tree-file-item--active' : ''} ${isPinned ? 'tree-file-item--pinned' : ''}`}
                    onClick={() => openFile(f)}
                    onContextMenu={e => {
                      if (!canManage) return;
                      e.preventDefault();
                      setPermMenu({ type: 'file', id: f.id, name: f.name, position: { x: e.clientX, y: e.clientY } });
                    }}
                  >
                    {getFileIcon(f, 13)}
                    <span className="tree-file-name">{f.name}</span>
                    <div className="tree-item-actions" onClick={e => e.stopPropagation()}>
                      <button
                        className={`tree-pin-btn ${isPinned ? 'tree-pin-btn--active' : ''}`}
                        title={isPinned ? 'הסר נעיצה' : 'נעץ'}
                        onClick={() => togglePinFile(f.id, isPinned)}
                      >
                        <Pin size={10} style={isPinned ? { color: '#2563eb' } : undefined} />
                      </button>
                      {f.url && (
                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="tree-action-btn" title="הורדה">
                          <Download size={10} />
                        </a>
                      )}
                      {canManage && (
                        <button className="tree-delete-btn" onClick={() => deleteFile(f)} title="מחיקה">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {folderFiles.length === 0 && (
                <div className="tree-empty">ריק</div>
              )}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="page">
      <Header title="קבצים ותיקיות" />
      <div className="page-content">
        <div className={`files-layout ${fullscreen ? 'files-layout--fullscreen' : ''}`}>
          {/* Right panel - File tree */}
          <div className="files-tree-panel">
            <div className="tree-panel-header">
              <h3>תיקיות וקבצים</h3>
              <div className="tree-panel-actions">
                {canManage && (
                  <button className="icon-btn" onClick={() => setShowNewFolder(true)} title="תיקייה חדשה">
                    <FolderPlus size={15} />
                  </button>
                )}
              </div>
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
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowNewFolder(false)}>ביטול</button>
                </div>
              </form>
            )}

            <div style={{ padding: '0.35rem 0.5rem 0' }}>
              <div className="search-bar" style={{ minWidth: 'auto' }}>
                <Search size={12} />
                <input
                  value={fileSearch}
                  onChange={e => setFileSearch(e.target.value)}
                  placeholder="חיפוש..."
                  style={{ fontSize: '0.75rem' }}
                />
              </div>
            </div>

            <div className="tree-list">
              {/* Pinned section */}
              {(pinnedFolders.length > 0 || pinnedFiles.length > 0) && (
                <>
                  <div className="tree-section-header">
                    <Pin size={11} />
                    <span>נעוצים</span>
                  </div>
                  {renderFolderTree(pinnedFolders)}
                  {pinnedFiles.filter(f => !pinnedFolders.some(pf => pf.id === f.folderId)).map(f => (
                    <div
                      key={`pinned-${f.id}`}
                      className={`tree-file-item tree-file-item--pinned-standalone ${editingFile?.id === f.id ? 'tree-file-item--active' : ''}`}
                      onClick={() => openFile(f)}
                    >
                      {getFileIcon(f, 13)}
                      <span className="tree-file-name">{f.name}</span>
                      <div className="tree-item-actions" onClick={e => e.stopPropagation()}>
                        <button
                          className="tree-pin-btn tree-pin-btn--active"
                          title="הסר נעיצה"
                          onClick={() => togglePinFile(f.id, true)}
                        >
                          <Pin size={10} style={{ color: '#2563eb' }} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="tree-section-divider" />
                </>
              )}

              {/* All folders */}
              {unpinnedFolders.length > 0 && (pinnedFolders.length > 0 || pinnedFiles.length > 0) && (
                <div className="tree-section-header">
                  <Folder size={11} />
                  <span>כל התיקיות</span>
                </div>
              )}
              {renderFolderTree(unpinnedFolders)}

              {sortedFolders.length === 0 && (
                <div className="tree-empty-state">
                  <Folder size={24} className="empty-icon" />
                  <p>אין תיקיות</p>
                </div>
              )}
            </div>
          </div>

          {/* Left panel - File viewer */}
          <div className="files-viewer-panel">
            {editingFile ? (
              <div className="file-viewer-content">
                <div className="file-editor-header">
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditingFile(null); setFullscreen(false); }}>
                    <X size={14} />
                    סגור
                  </button>
                  <span className="file-editor-name">
                    {editingFile.fileType === 'spreadsheet' ? <Table2 size={16} /> : <FileEdit size={16} />}
                    {editingFile.name}
                  </span>
                  <div className="file-editor-actions">
                    {editingFile.fileType !== 'spreadsheet' && (
                      <button
                        className="icon-btn"
                        onClick={() => setFullscreen(!fullscreen)}
                        title={fullscreen ? 'יציאה ממסך מלא' : 'מסך מלא'}
                      >
                        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => saveFileContent(editingFile.content)}
                      disabled={fileSaving}
                    >
                      <Save size={14} />
                      {fileSaving ? 'שומר...' : 'שמירה'}
                    </button>
                  </div>
                </div>
                <div className="file-editor-body">
                  {editingFile.fileType === 'spreadsheet' ? (
                    <SpreadsheetEditor
                      data={typeof editingFile.content === 'string' ? JSON.parse(editingFile.content) : editingFile.content}
                      onChange={(newData) => setEditingFile(prev => ({ ...prev, content: JSON.stringify(newData) }))}
                      onToggleFullscreen={() => setFullscreen(!fullscreen)}
                      isFullscreen={fullscreen}
                    />
                  ) : (
                    <DocumentEditor
                      content={editingFile.content || ''}
                      onChange={(newContent) => setEditingFile(prev => ({ ...prev, content: newContent }))}
                    />
                  )}
                </div>
              </div>
            ) : selectedFolder ? (
              <div className="file-viewer-content">
                <div className="viewer-header">
                  <div className="viewer-folder-info">
                    <FolderOpen size={18} />
                    <h3>{folders.find(f => f.id === selectedFolder)?.name || 'תיקייה'}</h3>
                  </div>
                  <div className="viewer-header-actions">
                    {userCanCreateFiles() && (
                      <div className="create-file-wrap">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => { setShowCreateMenu(!showCreateMenu); setCreateInFolder(selectedFolder); }}
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
                      <input type="file" hidden onChange={e => handleUpload(e, selectedFolder)} disabled={uploading} />
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

                <div className="file-grid">
                  {getFilesForFolder(selectedFolder).map(f => {
                    const isPinned = f.pinnedBy?.includes(uid);
                    return (
                      <div key={f.id} className={`file-card ${isPinned ? 'file-card--pinned' : ''}`} onClick={() => openFile(f)}>
                        <div className="file-card-icon">{getFileIcon(f, 28)}</div>
                        <div className="file-card-info">
                          <div className="file-card-name">{f.name}</div>
                          <div className="file-card-meta">
                            {f.fileType === 'spreadsheet' ? 'גיליון' : f.fileType === 'document' ? 'מסמך' : formatSize(f.size)}
                            {' · '}{f.uploadedBy}
                          </div>
                        </div>
                        <div className="file-card-actions" onClick={e => e.stopPropagation()}>
                          <button
                            className={`tree-pin-btn ${isPinned ? 'tree-pin-btn--active' : ''}`}
                            title={isPinned ? 'הסר נעיצה' : 'נעץ'}
                            onClick={() => togglePinFile(f.id, isPinned)}
                          >
                            <Pin size={13} style={isPinned ? { color: '#2563eb' } : undefined} />
                          </button>
                          {f.url && (
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="icon-btn" title="הורדה">
                              <Download size={13} />
                            </a>
                          )}
                          {canManage && (
                            <button className="icon-btn icon-btn--danger" onClick={() => deleteFile(f)} title="מחיקה">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {getFilesForFolder(selectedFolder).length === 0 && (
                    <div className="empty-state">
                      <FileText size={32} className="empty-icon" />
                      <p>אין קבצים בתיקייה זו</p>
                      {userCanCreateFiles() && <p className="empty-hint">לחצו "קובץ חדש" ליצירת גיליון או מסמך</p>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>
                <Folder size={40} className="empty-icon" />
                <p>בחרו תיקייה או קובץ מהעץ</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Permissions Menu */}
      {permMenu && (
        <PermissionsMenu
          resourceType={permMenu.type}
          resourceId={permMenu.id}
          resourceName={permMenu.name}
          schoolId={schoolId}
          position={permMenu.position}
          onClose={() => setPermMenu(null)}
        />
      )}
    </div>
  );
}
