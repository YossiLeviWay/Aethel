import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Building2, ChevronDown, Check } from 'lucide-react';
import './Layout.css';

export default function Header({ title }) {
  const { userData, selectedSchool, switchSchool, isGlobalAdmin } = useAuth();
  const [schools, setSchools] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

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

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const currentSchool = schools.find(s => s.id === selectedSchool);
  const filtered = schools.filter(s =>
    s.name.includes(search) || (s.address || '').includes(search)
  );

  return (
    <header className="app-header">
      <h2 className="header-title">{title}</h2>

      {isGlobalAdmin() && schools.length > 0 && (
        <div className="context-switcher" ref={dropdownRef}>
          <button
            className="context-switcher-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <Building2 size={16} />
            <span>{currentSchool?.name || 'בחרו מוסד'}</span>
            <ChevronDown size={14} className={showDropdown ? 'rotate-180' : ''} />
          </button>
          {showDropdown && (
            <div className="context-dropdown">
              {schools.length > 3 && (
                <div className="context-search">
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="חיפוש מוסד..."
                    autoFocus
                  />
                </div>
              )}
              <div className="context-options-list">
                {filtered.map(s => (
                  <button
                    key={s.id}
                    className={`context-option ${s.id === selectedSchool ? 'active' : ''}`}
                    onClick={() => { switchSchool(s.id); setShowDropdown(false); setSearch(''); }}
                  >
                    <div className="context-option-info">
                      <span className="context-option-name">{s.name}</span>
                      {s.address && <span className="context-option-addr">{s.address}</span>}
                    </div>
                    {s.id === selectedSchool && <Check size={14} className="context-check" />}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="context-empty">לא נמצאו מוסדות</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
