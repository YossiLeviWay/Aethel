import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import AppLayout from './components/Layout/AppLayout';
import GanttChart from './components/Gantt/GanttChart';
import CategoryManager from './components/Gantt/CategoryManager';
import StaffManagement from './components/Staff/StaffManagement';
import TaskBoard from './components/Tasks/TaskBoard';
import FileManager from './components/Files/FileManager';
import ExcelWriter from './components/DataMapper/ExcelWriter';
import SchoolManagement from './components/Schools/SchoolManagement';
import Settings from './components/Settings/Settings';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>טוען...</p>
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/login" />;
  return children;
}

function AdminRoute({ children }) {
  const { userData, loading } = useAuth();
  if (loading) return null;
  if (userData?.role !== 'global_admin') return <Navigate to="/" />;
  return children;
}

function PrincipalRoute({ children }) {
  const { userData, loading } = useAuth();
  if (loading) return null;
  if (userData?.role !== 'global_admin' && userData?.role !== 'principal') {
    return <Navigate to="/" />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  if (currentUser) return <Navigate to="/" />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter basename="/Aethel">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<GanttChart />} />
            <Route path="categories" element={<PrincipalRoute><CategoryManager /></PrincipalRoute>} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="tasks" element={<TaskBoard />} />
            <Route path="files" element={<FileManager />} />
            <Route path="data" element={<ExcelWriter />} />
            <Route path="schools" element={<AdminRoute><SchoolManagement /></AdminRoute>} />
            <Route path="settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
