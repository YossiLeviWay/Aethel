import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
} from 'firebase/firestore';
import Header from '../Layout/Header';
import { Send, Search, Mail, Circle, Trash2, X } from 'lucide-react';
import './Messages.css';

export default function Messages() {
  const { userData, currentUser, selectedSchool, isGlobalAdmin } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [users, setUsers] = useState([]);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const [hoveredMsg, setHoveredMsg] = useState(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(null);
  const messagesEndRef = useRef(null);
  const uid = currentUser?.uid;
  const schoolId = selectedSchool || userData?.schoolId;

  // Load users from the same school only (admin sees all)
  useEffect(() => {
    if (!uid) return;
    async function loadUsers() {
      let allUsers;
      if (isGlobalAdmin()) {
        // Admin can message anyone
        const snap = await getDocs(collection(db, 'users'));
        allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== uid);
      } else if (schoolId) {
        // Regular user: only load users from the same school
        const q1 = query(collection(db, 'users'), where('schoolIds', 'array-contains', schoolId));
        const snap1 = await getDocs(q1);
        const userMap = new Map();
        snap1.docs.forEach(d => {
          if (d.id !== uid) userMap.set(d.id, { id: d.id, ...d.data() });
        });
        // Fallback: old schoolId field
        const q2 = query(collection(db, 'users'), where('schoolId', '==', schoolId));
        const snap2 = await getDocs(q2);
        snap2.docs.forEach(d => {
          if (d.id !== uid && !userMap.has(d.id)) {
            userMap.set(d.id, { id: d.id, ...d.data() });
          }
        });
        allUsers = Array.from(userMap.values());
      } else {
        allUsers = [];
      }
      setUsers(allUsers);
    }
    loadUsers();
  }, [uid, schoolId]);

  // Listen to conversations (scoped by school for non-admin)
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      let convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Non-admin: filter to only conversations from the current school
      if (!isGlobalAdmin() && schoolId) {
        convs = convs.filter(c => !c.schoolId || c.schoolId === schoolId);
      }
      convs.sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));

      // Merge duplicate conversations for the same participant pair
      const merged = [];
      const pairMap = new Map();
      for (const conv of convs) {
        const pairKey = [...conv.participants].sort().join('|');
        if (pairMap.has(pairKey)) {
          // Keep the one with the latest message, mark the other for merging
          const existing = pairMap.get(pairKey);
          existing._mergedIds = existing._mergedIds || [];
          existing._mergedIds.push(conv.id);
        } else {
          pairMap.set(pairKey, conv);
          merged.push(conv);
        }
      }
      setConversations(merged);
    }, (err) => {
      console.error('Error loading conversations:', err);
    });
    return unsub;
  }, [uid]);

  // Listen to messages in active conversation (including merged conversations)
  useEffect(() => {
    if (!activeConv) { setMessages([]); return; }

    const convIds = [activeConv.id, ...(activeConv._mergedIds || [])];
    const unsubs = [];
    const allMessages = {};

    for (const convId of convIds) {
      const q = query(
        collection(db, 'conversations', convId, 'messages'),
        orderBy('createdAt', 'asc')
      );
      const unsub = onSnapshot(q, (snap) => {
        allMessages[convId] = snap.docs.map(d => ({ id: d.id, ...d.data(), _convId: convId }));
        // Combine and sort all messages
        const combined = Object.values(allMessages).flat();
        combined.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
        setMessages(combined);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }, (err) => {
        console.error('Error loading messages:', err);
      });
      unsubs.push(unsub);
    }

    // Mark as read
    if (activeConv.unreadBy?.includes(uid)) {
      const newUnread = (activeConv.unreadBy || []).filter(id => id !== uid);
      updateDoc(doc(db, 'conversations', activeConv.id), { unreadBy: newUnread });
    }
    return () => unsubs.forEach(u => u());
  }, [activeConv?.id, uid]);

  async function startConversation(otherUser) {
    // Check if conversation already exists (using merged list)
    const existing = conversations.find(c =>
      c.participants.includes(otherUser.id) && c.participants.length === 2
    );
    if (existing) {
      setActiveConv(existing);
      setShowNewConv(false);
      return;
    }
    const convData = {
      participants: [uid, otherUser.id],
      participantNames: { [uid]: userData?.fullName || '', [otherUser.id]: otherUser.fullName || '' },
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unreadBy: [],
      schoolId: schoolId || ''
    };
    const convDoc = await addDoc(collection(db, 'conversations'), convData);
    const newConv = { id: convDoc.id, ...convData };
    setActiveConv(newConv);
    setShowNewConv(false);
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMsg.trim() || !activeConv) return;
    const text = newMsg.trim();
    setNewMsg('');
    const otherIds = activeConv.participants.filter(id => id !== uid);
    await addDoc(collection(db, 'conversations', activeConv.id, 'messages'), {
      text,
      senderId: uid,
      senderName: userData?.fullName || '',
      createdAt: new Date().toISOString()
    });
    await updateDoc(doc(db, 'conversations', activeConv.id), {
      lastMessage: text,
      lastMessageAt: new Date().toISOString(),
      unreadBy: otherIds
    });
  }

  async function deleteMessage(msg) {
    if (!msg || !activeConv) return;
    const convId = msg._convId || activeConv.id;
    try {
      await deleteDoc(doc(db, 'conversations', convId, 'messages', msg.id));
      // If this was the last message, update conversation lastMessage
      const remaining = messages.filter(m => m.id !== msg.id);
      if (remaining.length > 0) {
        const last = remaining[remaining.length - 1];
        await updateDoc(doc(db, 'conversations', activeConv.id), {
          lastMessage: last.text,
          lastMessageAt: last.createdAt
        });
      } else {
        await updateDoc(doc(db, 'conversations', activeConv.id), {
          lastMessage: '',
          lastMessageAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
    setConfirmDeleteMsg(null);
  }

  function getOtherName(conv) {
    if (!conv.participantNames) return 'משתמש';
    const otherId = conv.participants.find(id => id !== uid);
    return conv.participantNames[otherId] || 'משתמש';
  }

  function getInitial(conv) {
    const name = getOtherName(conv);
    return name.charAt(0) || '?';
  }

  const filteredConversations = conversations.filter(c => {
    if (!searchConv.trim()) return true;
    const name = getOtherName(c).toLowerCase();
    return name.includes(searchConv.toLowerCase());
  });

  const filteredUsers = users.filter(u => {
    if (!searchUsers.trim()) return true;
    return (u.fullName || '').toLowerCase().includes(searchUsers.toLowerCase()) ||
           (u.email || '').toLowerCase().includes(searchUsers.toLowerCase());
  });

  function formatMsgDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    if (isToday) return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    if (isYesterday) return 'אתמול ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="page">
      <Header title="הודעות" />
      <div className="page-content">
        <div className="messages-layout">
          {/* Conversations sidebar */}
          <div className="conv-panel">
            <div className="conv-header">
              <h3>שיחות</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowNewConv(!showNewConv)}>
                הודעה חדשה
              </button>
            </div>

            {showNewConv && (
              <div className="new-conv-panel">
                <div className="search-bar" style={{ margin: '0.5rem', minWidth: 'auto' }}>
                  <Search size={12} />
                  <input
                    value={searchUsers}
                    onChange={e => setSearchUsers(e.target.value)}
                    placeholder="חיפוש משתמש..."
                    autoFocus
                  />
                </div>
                <div className="user-list">
                  {filteredUsers.slice(0, 20).map(u => (
                    <div key={u.id} className="user-item" onClick={() => startConversation(u)}>
                      <div className="user-avatar">{u.fullName?.charAt(0) || '?'}</div>
                      <div className="user-info">
                        <span className="user-name">{u.fullName}</span>
                        <span className="user-email">{u.email}</span>
                      </div>
                    </div>
                  ))}
                  {filteredUsers.length === 0 && <p className="conv-empty">לא נמצאו משתמשים</p>}
                </div>
              </div>
            )}

            <div className="search-bar" style={{ margin: '0.5rem', minWidth: 'auto' }}>
              <Search size={12} />
              <input
                value={searchConv}
                onChange={e => setSearchConv(e.target.value)}
                placeholder="חיפוש שיחות..."
              />
            </div>

            <div className="conv-list">
              {filteredConversations.map(conv => {
                const isUnread = conv.unreadBy?.includes(uid);
                return (
                  <div
                    key={conv.id}
                    className={`conv-item ${activeConv?.id === conv.id ? 'conv-item--active' : ''} ${isUnread ? 'conv-item--unread' : ''}`}
                    onClick={() => setActiveConv(conv)}
                  >
                    <div className="conv-avatar">{getInitial(conv)}</div>
                    <div className="conv-info">
                      <span className="conv-name">{getOtherName(conv)}</span>
                      <span className="conv-last-msg">{conv.lastMessage || 'שיחה חדשה'}</span>
                    </div>
                    {isUnread && <Circle size={8} fill="#2563eb" className="conv-unread-dot" />}
                  </div>
                );
              })}
              {filteredConversations.length === 0 && !showNewConv && (
                <p className="conv-empty">אין שיחות עדיין</p>
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="msg-area">
            {activeConv ? (
              <>
                <div className="msg-header">
                  <div className="msg-header-avatar">{getInitial(activeConv)}</div>
                  <span className="msg-header-name">{getOtherName(activeConv)}</span>
                </div>
                <div className="msg-list">
                  {messages.length === 0 && <p className="msg-empty">אין הודעות עדיין. שלחו את ההודעה הראשונה!</p>}
                  {messages.map(msg => {
                    const isMe = msg.senderId === uid;
                    return (
                      <div
                        key={msg.id}
                        className={`msg-bubble ${isMe ? 'msg-bubble--me' : ''}`}
                        onMouseEnter={() => setHoveredMsg(msg.id)}
                        onMouseLeave={() => { setHoveredMsg(null); if (confirmDeleteMsg === msg.id) setConfirmDeleteMsg(null); }}
                      >
                        <div className="msg-bubble-header">
                          <span className="msg-sender">{isMe ? 'אני' : msg.senderName}</span>
                          <span className="msg-time">
                            {formatMsgDate(msg.createdAt)}
                          </span>
                          {isMe && hoveredMsg === msg.id && (
                            <button
                              className="msg-delete-btn"
                              onClick={(e) => { e.stopPropagation(); setConfirmDeleteMsg(msg.id); }}
                              title="מחיקת הודעה"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                        <div className="msg-text">{msg.text}</div>
                        {confirmDeleteMsg === msg.id && (
                          <div className="msg-delete-confirm">
                            <span>למחוק הודעה זו?</span>
                            <button className="msg-delete-yes" onClick={() => deleteMessage(msg)}>מחק</button>
                            <button className="msg-delete-no" onClick={() => setConfirmDeleteMsg(null)}>ביטול</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                <form className="msg-input" onSubmit={sendMessage}>
                  <input
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    placeholder="כתבו הודעה..."
                    autoFocus
                  />
                  <button type="submit" className="msg-send" disabled={!newMsg.trim()}>
                    <Send size={16} />
                  </button>
                </form>
              </>
            ) : (
              <div className="msg-empty-state">
                <Mail size={40} />
                <p>בחרו שיחה או התחילו שיחה חדשה</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
