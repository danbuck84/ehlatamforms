import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'englishtalk:theme';

function detectInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore storage errors
  }
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(detectInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#121214' : '#F8F7FC');
    }
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          setTheme(e.matches ? 'light' : 'dark');
        }
      } catch {
        setTheme(e.matches ? 'light' : 'dark');
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  };

  return <ThemeContext value={{ theme, toggleTheme }}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
