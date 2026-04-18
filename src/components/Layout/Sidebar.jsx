import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  updateDoc,
  doc,
  orderBy,
  limit as firestoreLimit
} from 'firebase/firestore';
import {
  Home,
  Calendar,
  Users,
  CheckSquare,
  FolderOpen,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  School,
  LayoutGrid,
  Menu,
  MessageCircle,
  Sun,
  Bell,
  CheckCheck,
  FileText,
  UserPlus,
  AlertCircle,
  MoreHorizontal,
  X
} from 'lucide-react';
import { AVATAR_OPTIONS, AVATAR_ICON_PATHS } from '../../data/avatars';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'דשבורד', all: true, bottomNav: true },
  { path: '/calendar', icon: Calendar, label: 'לוח שנה', requiresSchool: true, viewerAllowed: true, bottomNav: true },
  { path: '/categories', icon: LayoutGrid, label: 'קטגוריות', requiresSchool: true, viewerAllowed: true },
  { path: '/staff', icon: Users, label: 'סגל וקהילה', requiresSchool: true, viewerAllowed: true },
  { path: '/tasks', icon: CheckSquare, label: 'משימות', requiresSchool: true, viewerAllowed: true, bottomNav: true },
  { path: '/files', icon: FolderOpen, label: 'קבצים', requiresSchool: true, viewerAllowed: true, bottomNav: true },
  { path: '/teams', icon: Users, label: 'צוותים', requiresSchool: true, viewerAllowed: true },
  { path: '/messages', icon: MessageCircle, label: 'הודעות', all: true },
  { path: '/holidays', icon: Sun, label: 'חופשות וחגים', requiresSchool: true, viewerAllowed: true },
  { path: '/schools', icon: School, label: 'ניהול מוסדות', roles: ['global_admin'] },
  { path: '/settings', icon: Settings, label: 'הגדרות', all: true }
];

const NOTIF_TYPE_ICONS = {
  message: MessageCircle,
  task: CheckSquare,
  calendar: Calendar,
  staff: Users,
  file: FolderOpen,
  permission: UserPlus,
  system: AlertCircle
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function formatNotifTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דק׳`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `לפני ${diffHours} שע׳`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export default function Sidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const { logout, userData, currentUser, selectedSchool, isPending, isViewer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestNotifs, setLatestNotifs] = useState([]);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const notifPopupRef = useRef(null);
  const notifBellRef = useRef(null);

  // Mobile more menu state
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef(null);

  // Auto-collapse on route change for mobile
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [location.pathname, isMobile]);

  // Listen for unread notification count
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, (err) => {
      console.warn('Error listening to notifications count:', err);
    });
    return unsub;
  }, [currentUser?.uid]);

  // Listen for latest 5 notifications (for the popup)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      firestoreLimit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLatestNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn('Error listening to latest notifications:', err);
    });
    return unsub;
  }, [currentUser?.uid]);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        showNotifPopup &&
        notifPopupRef.current &&
        !notifPopupRef.current.contains(e.target) &&
        notifBellRef.current &&
        !notifBellRef.current.contains(e.target)
      ) {
        setShowNotifPopup(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifPopup]);

  async function markAllRead() {
    if (!currentUser?.uid) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );
      const snap = await getDocs(q);
      const updates = snap.docs.map(d => updateDoc(doc(db, 'notifications', d.id), { read: true }));
      await Promise.all(updates);
    } catch (err) {
      console.warn('Error marking all notifications as read:', err);
    }
  }

  function handleNotifClick(notif) {
    setShowNotifPopup(false);
    if (notif.link) {
      navigate(notif.link);
    } else {
      navigate('/notifications');
    }
  }

  const schoolId = selectedSchool || userData?.schoolId;
  const userIsPending = isPending();
  const userIsViewer = isViewer();
  const ROLE_RANK = { global_admin: 4, principal: 3, editor: 2, viewer: 1 };

  function canSeeItem(item) {
    // Pending users can only see dashboard
    if (userIsPending) return item.path === '/';
    if (item.requiresSchool && !schoolId) return false;
    // Role-specific items
    if (item.roles && userData?.role) {
      if (!item.roles.includes(userData.role)) return false;
    }
    // Viewer restrictions: only dashboard, calendar, staff list
    if (userIsViewer && !item.all && !item.viewerAllowed) return false;
    // minRole check
    if (item.minRole && userData?.role) {
      if ((ROLE_RANK[userData.role] || 0) < (ROLE_RANK[item.minRole] || 0)) return false;
    }
    if (item.all || item.requiresSchool || item.roles) return true;
    return false;
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // Close more menu on route change
  useEffect(() => {
    setShowMoreMenu(false);
  }, [location.pathname]);

  // Close more menu on outside click
  useEffect(() => {
    if (!showMoreMenu) return;
    function handleClick(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreMenu]);

  const avatarOption = userData?.avatar
    ? AVATAR_OPTIONS.find(a => a.id === userData.avatar)
    : null;

  const visibleItems = NAV_ITEMS.filter(canSeeItem);
  const bottomPrimary = visibleItems.filter(i => i.bottomNav);
  const bottomMore = visibleItems.filter(i => !i.bottomNav);

  // Mobile: render bottom nav bar instead of sidebar
  if (isMobile) {
    return (
      <>
        {/* More menu overlay */}
        {showMoreMenu && (
          <div className="bottom-more-overlay" onClick={() => setShowMoreMenu(false)} />
        )}

        {/* More menu sheet */}
        {showMoreMenu && (
          <div className="bottom-more-sheet" ref={moreMenuRef}>
            <div className="bottom-more-header">
              <span className="bottom-more-title">תפריט</span>
              <button className="bottom-more-close" onClick={() => setShowMoreMenu(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="bottom-more-grid">
              {bottomMore.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    `bottom-more-item ${isActive ? 'bottom-more-item--active' : ''}`
                  }
                  onClick={() => setShowMoreMenu(false)}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
              <button className="bottom-more-item bottom-more-item--logout" onClick={handleLogout}>
                <LogOut size={20} />
                <span>יציאה</span>
              </button>
            </div>
            {userData && (
              <div className="bottom-more-user">
                <div
                  className="sidebar-avatar"
                  style={avatarOption ? {
                    background: avatarOption.bg,
                    color: avatarOption.textColor
                  } : undefined}
                >
                  {avatarOption?.icon && AVATAR_ICON_PATHS[avatarOption.icon] ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d={AVATAR_ICON_PATHS[avatarOption.icon]} />
                    </svg>
                  ) : (
                    userData.fullName?.charAt(0) || '?'
                  )}
                </div>
                <span className="bottom-more-user-name">{userData.fullName}</span>
                <span className="bottom-more-user-role">{userData.jobTitle || userData.role}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom navigation bar */}
        <nav className="bottom-nav">
          {bottomPrimary.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `bottom-nav-item ${isActive ? 'bottom-nav-item--active' : ''}`
              }
            >
              <item.icon size={20} />
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          ))}
          <button
            className={`bottom-nav-item ${showMoreMenu ? 'bottom-nav-item--active' : ''}`}
            onClick={() => setShowMoreMenu(v => !v)}
          >
            <MoreHorizontal size={20} />
            <span className="bottom-nav-label">עוד</span>
          </button>
        </nav>
      </>
    );
  }

  // Desktop: render normal sidebar
  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-logo">EduFlow</span>}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'הרחב תפריט' : 'כווץ תפריט'}
        >
          {collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleItems.map(item => {
          const isNotifications = item.path === '/notifications';

          return (
            <div key={item.path} className="sidebar-link-wrapper">
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
                }
                title={collapsed ? item.label : undefined}
                {...(isNotifications ? {
                  ref: notifBellRef,
                  onMouseEnter: () => {
                    if (!collapsed) setShowNotifPopup(true);
                  }
                } : {})}
              >
                <span className="sidebar-icon-wrap">
                  <item.icon size={20} />
                  {isNotifications && unreadCount > 0 && (
                    <span className="notif-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>

              {/* Notification popup dropdown */}
              {isNotifications && showNotifPopup && !collapsed && (
                <div
                  className="notif-popup"
                  ref={notifPopupRef}
                  onMouseLeave={() => setShowNotifPopup(false)}
                >
                  <div className="notif-popup-header">
                    <span className="notif-popup-title">התראות</span>
                    {unreadCount > 0 && (
                      <button
                        className="notif-mark-all-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAllRead();
                        }}
                      >
                        <CheckCheck size={12} />
                        סמן הכל כנקרא
                      </button>
                    )}
                  </div>
                  <div className="notif-popup-list">
                    {latestNotifs.length === 0 ? (
                      <div className="notif-popup-empty">אין התראות</div>
                    ) : (
                      latestNotifs.map(notif => {
                        const TypeIcon = NOTIF_TYPE_ICONS[notif.type] || NOTIF_TYPE_ICONS.system;
                        return (
                          <div
                            key={notif.id}
                            className={`notif-popup-item ${!notif.read ? 'notif-popup-item--unread' : ''}`}
                            onClick={() => handleNotifClick(notif)}
                          >
                            <div className="notif-popup-item-icon">
                              <TypeIcon size={14} />
                            </div>
                            <div className="notif-popup-item-content">
                              <span className="notif-popup-item-title">{notif.title}</span>
                              <span className="notif-popup-item-time">{formatNotifTime(notif.createdAt)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="notif-popup-footer">
                    <button
                      className="notif-popup-view-all"
                      onClick={() => {
                        setShowNotifPopup(false);
                        navigate('/notifications');
                      }}
                    >
                      צפייה בכל ההתראות
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && userData && (
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              style={avatarOption ? {
                background: avatarOption.bg,
                color: avatarOption.textColor
              } : undefined}
            >
              {avatarOption?.icon && AVATAR_ICON_PATHS[avatarOption.icon] ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d={AVATAR_ICON_PATHS[avatarOption.icon]} />
                </svg>
              ) : (
                userData.fullName?.charAt(0) || '?'
              )}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{userData.fullName}</span>
              <span className="sidebar-user-role">{userData.jobTitle || userData.role}</span>
            </div>
          </div>
        )}
        <button className="sidebar-link sidebar-logout" onClick={handleLogout} title="יציאה">
          <LogOut size={20} />
          {!collapsed && <span>יציאה</span>}
        </button>
      </div>
    </aside>
    </>
  );
}
