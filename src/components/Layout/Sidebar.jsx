import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Home,
  Calendar,
  Users,
  CheckSquare,
  FolderOpen,
  Table2,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  School,
  LayoutGrid,
  Menu,
  MessageCircle,
  Sun
} from 'lucide-react';
import { AVATAR_OPTIONS } from '../../data/avatars';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', icon: Home, label: 'דשבורד', all: true },
  { path: '/calendar', icon: Calendar, label: 'לוח שנה', requiresSchool: true },
  { path: '/categories', icon: LayoutGrid, label: 'קטגוריות', roles: ['global_admin', 'principal'], requiresSchool: true },
  { path: '/staff', icon: Users, label: 'סגל וקהילה', requiresSchool: true },
  { path: '/tasks', icon: CheckSquare, label: 'משימות', requiresSchool: true },
  { path: '/files', icon: FolderOpen, label: 'קבצים', requiresSchool: true },
  { path: '/data', icon: Table2, label: 'מיפוי נתונים', requiresSchool: true },
  { path: '/teams', icon: Users, label: 'צוותים', requiresSchool: true },
  { path: '/messages', icon: MessageCircle, label: 'הודעות', all: true },
  { path: '/holidays', icon: Sun, label: 'חופשות וחגים', roles: ['global_admin', 'principal'] },
  { path: '/schools', icon: School, label: 'ניהול מוסדות', roles: ['global_admin'] },
  { path: '/settings', icon: Settings, label: 'הגדרות', all: true }
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function Sidebar() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);
  const { logout, userData, selectedSchool } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-collapse on route change for mobile
  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [location.pathname, isMobile]);

  const schoolId = selectedSchool || userData?.schoolId;

  function canSeeItem(item) {
    if (item.requiresSchool && !schoolId) return false;
    if (item.all || item.requiresSchool) {
      if (item.roles && userData?.role) {
        return item.roles.includes(userData.role);
      }
      return true;
    }
    if (item.roles && userData?.role) {
      return item.roles.includes(userData.role);
    }
    return false;
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const avatarOption = userData?.avatar
    ? AVATAR_OPTIONS.find(a => a.id === userData.avatar)
    : null;

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && !collapsed && (
        <div className="sidebar-overlay" onClick={() => setCollapsed(true)} />
      )}

      {/* Mobile hamburger button */}
      {isMobile && collapsed && (
        <button
          className="sidebar-mobile-toggle"
          onClick={() => setCollapsed(false)}
          style={{
            position: 'fixed',
            top: '0.6rem',
            right: '0.6rem',
            zIndex: 101,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        >
          <Menu size={20} />
        </button>
      )}

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
        {NAV_ITEMS.filter(canSeeItem).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link--active' : ''}`
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
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
              {userData.fullName?.charAt(0) || '?'}
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
