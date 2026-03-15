import { useState, useEffect, useCallback } from 'react';

export function useThemeMode() {
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('aethel-theme') || 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('aethel-theme', mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode(prev => prev === 'light' ? 'candlelight' : 'light');
  }, []);

  return { mode, toggle };
}
