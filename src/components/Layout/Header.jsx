import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Building2, ChevronDown } from 'lucide-react';
import './Layout.css';

export default function Header({ title }) {
  const { userData, selectedSchool, switchSchool, isGlobalAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!isGlobalAdmin()) return;
    async function fetchSchools() {
      try {
        const snap = await getDocs(collection(db, 'schools'));
        setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {
        setSchools([]);
      }
    }
    fetchSchools();
  }, [userData]);

  const currentSchool = schools.find(s => s.id === selectedSchool);

  return (
    <header className="app-header">
      <h2 className="header-title">{title}</h2>

      {isGlobalAdmin() && schools.length > 0 && (
        <div className="context-switcher">
          <button
            className="context-switcher-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Building2 size={16} />
            <span>{currentSchool?.name || 'בחרו מוסד'}</span>
            <ChevronDown size={14} />
          </button>
          {showDropdown && (
            <div className="context-dropdown">
              {schools.map(s => (
                <button
                  key={s.id}
                  className={`context-option ${s.id === selectedSchool ? 'active' : ''}`}
                  onClick={() => { switchSchool(s.id); setShowDropdown(false); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
