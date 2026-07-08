import { useCallback, useEffect, useState } from 'react';

// Theme state lives on <html data-theme="…">, set before first paint by the
// inline script in index.html. Default is dark (it's a Steam thing); the
// toggle persists the user's choice in localStorage.

function currentTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'light' ? 'light' : 'dark';
}

export default function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* private mode */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  return { theme, toggleTheme };
}
