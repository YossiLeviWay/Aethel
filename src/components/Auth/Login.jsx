import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

export default function Login() {
  const [mode, setMode] = useState('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loginAsAdmin } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'admin') {
        await loginAsAdmin(adminPassword);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(mode === 'admin' ? 'סיסמת אדמין שגויה' : 'שם משתמש או סיסמה שגויים');
    }
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">EduFlow</h1>
          <p className="auth-subtitle">מערכת ניהול מוסדות חינוך</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'user' ? 'active' : ''}`}
            onClick={() => setMode('user')}
          >
            כניסת משתמש
          </button>
          <button
            className={`auth-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => setMode('admin')}
          >
            כניסת אדמין
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'user' ? (
            <>
              <div className="form-group">
                <label>דוא"ל</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="הזינו כתובת דוא״ל"
                  required
                  dir="ltr"
                />
              </div>
              <div className="form-group">
                <label>סיסמה</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="הזינו סיסמה"
                  required
                  dir="ltr"
                />
              </div>
            </>
          ) : (
            <div className="form-group">
              <label>סיסמת מנהל מערכת</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="הזינו סיסמת אדמין"
                required
                dir="ltr"
              />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
        </form>

        {mode === 'user' && (
          <p className="auth-link">
            אין לך חשבון? <Link to="/register">הרשמה</Link>
          </p>
        )}
      </div>
    </div>
  );
}
