import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
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
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', icon: Calendar, label: 'לוח שנה', all: true },
  { path: '/categories', icon: LayoutGrid, label: 'קטגוריות', roles: ['global_admin', 'principal'] },
  { path: '/staff', icon: Users, label: 'סגל וקהילה', all: true },
  { path: '/tasks', icon: CheckSquare, label: 'משימות', all: true },
  { path: '/files', icon: FolderOpen, label: 'קבצים', all: true },
  { path: '/data', icon: Table2, label: 'מיפוי נתונים', all: true },
  { path: '/schools', icon: School, label: 'ניהול מוסדות', roles: ['global_admin'] },
  { path: '/settings', icon: Settings, label: 'הגדרות', all: true }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, userData } = useAuth();
  const navigate = useNavigate();

  function canSeeItem(item) {
    if (item.all) return true;
    if (item.roles && userData?.role) {
      return item.roles.includes(userData.role);
    }
    return false;
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

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
            <div className="sidebar-avatar">
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
