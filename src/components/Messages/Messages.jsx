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
  doc,
  getDocs,
  or
} from 'firebase/firestore';
import Header from '../Layout/Header';
import { Send, Search, Mail, MailOpen, Circle, User } from 'lucide-react';
import './Messages.css';

export default function Messages() {
  const { userData, currentUser } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [users, setUsers] = useState([]);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchConv, setSearchConv] = useState('');
  const messagesEndRef = useRef(null);
  const uid = currentUser?.uid;

  // Load all users for new conversation
  useEffect(() => {
    if (!uid) return;
    async function loadUsers() {
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(u => u.id !== uid));
    }
    loadUsers();
  }, [uid]);

  // Listen to conversations
  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [uid]);

  // Listen to messages in active conversation
  useEffect(() => {
    if (!activeConv) { setMessages([]); return; }
    const q = query(
      collection(db, 'conversations', activeConv.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    // Mark as read
    if (activeConv.unreadBy?.includes(uid)) {
      const newUnread = (activeConv.unreadBy || []).filter(id => id !== uid);
      updateDoc(doc(db, 'conversations', activeConv.id), { unreadBy: newUnread });
    }
    return unsub;
  }, [activeConv?.id, uid]);

  async function startConversation(otherUser) {
    // Check if conversation already exists
    const existing = conversations.find(c =>
      c.participants.includes(otherUser.id) && c.participants.length === 2
    );
    if (existing) {
      setActiveConv(existing);
      setShowNewConv(false);
      return;
    }
    const convDoc = await addDoc(collection(db, 'conversations'), {
      participants: [uid, otherUser.id],
      participantNames: { [uid]: userData?.fullName || '', [otherUser.id]: otherUser.fullName || '' },
      lastMessage: '',
      lastMessageAt: new Date().toISOString(),
      unreadBy: []
    });
    const newConv = { id: convDoc.id, participants: [uid, otherUser.id], participantNames: { [uid]: userData?.fullName || '', [otherUser.id]: otherUser.fullName || '' }, lastMessage: '', lastMessageAt: new Date().toISOString(), unreadBy: [] };
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
                      <div key={msg.id} className={`msg-bubble ${isMe ? 'msg-bubble--me' : ''}`}>
                        <div className="msg-bubble-header">
                          <span className="msg-sender">{isMe ? 'אני' : msg.senderName}</span>
                          <span className="msg-time">
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                        <div className="msg-text">{msg.text}</div>
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
