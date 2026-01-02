'use client';

import { FluentProvider } from '@fluentui/react-components';
import { webDarkTheme, webLightTheme } from '@fluentui/react-theme';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error('useThemeMode must be used within Providers');
  }
  return ctx;
}

const storageKey = 'tts-dashboard-theme-mode';

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const raw = window.localStorage.getItem(storageKey);
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  return 'system';
}

export function Providers({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('system');
  const [prefersDark, setPrefersDark] = useState(false);

  useEffect(() => {
    setMode(readStoredMode());

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (media) {
      setPrefersDark(media.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
      media.addEventListener?.('change', handler);
      return () => media.removeEventListener?.('change', handler);
    }
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

  const ctxValue = useMemo<ThemeModeContextValue>(() => {
    return {
      mode,
      setMode: (next: ThemeMode) => {
        setMode(next);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, next);
        }
      },
      isDark,
    };
  }, [isDark, mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  return (
    <ThemeModeContext.Provider value={ctxValue}>
      <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
        {children}
      </FluentProvider>
    </ThemeModeContext.Provider>
  );
}
