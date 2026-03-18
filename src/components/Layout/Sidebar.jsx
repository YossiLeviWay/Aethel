import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
  LayoutGrid
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
  { path: '/schools', icon: School, label: 'ניהול מוסדות', roles: ['global_admin'] },
  { path: '/settings', icon: Settings, label: 'הגדרות', all: true }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, userData, selectedSchool } = useAuth();
  const navigate = useNavigate();

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
  );
}
