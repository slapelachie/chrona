'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SettingsContextType {
  weekStartDay: number;
  theme: string;
  loading: boolean;
  updateWeekStartDay: (day: number) => void;
  updateTheme: (theme: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [weekStartDay, setWeekStartDay] = useState<number>(0); // Default to Sunday
  const [theme, setTheme] = useState<string>('dark');
  const [loading, setLoading] = useState(true);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('/api/user/preferences');
        if (response.ok) {
          const preferences = await response.json();
          setWeekStartDay(preferences.weekStartDay ?? 0);
          setTheme(preferences.theme ?? 'dark');
        } else {
          // Fallback to localStorage if API fails
          const savedWeekStartDay = localStorage.getItem('chrona-week-start-day');
          const savedTheme = localStorage.getItem('chrona-theme');
          if (savedWeekStartDay) {
            setWeekStartDay(parseInt(savedWeekStartDay));
          }
          if (savedTheme) {
            setTheme(savedTheme);
          }
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Fallback to localStorage
        const savedWeekStartDay = localStorage.getItem('chrona-week-start-day');
        const savedTheme = localStorage.getItem('chrona-theme');
        if (savedWeekStartDay) {
          setWeekStartDay(parseInt(savedWeekStartDay));
        }
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateWeekStartDay = (day: number) => {
    setWeekStartDay(day);
    localStorage.setItem('chrona-week-start-day', day.toString());
    // Optionally sync with API in background
    fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekStartDay: day })
    }).catch(error => console.error('Failed to save week start day:', error));
  };

  const updateTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('chrona-theme', newTheme);
    // Apply theme to document
    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-bs-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-bs-theme');
    }
    // Optionally sync with API in background
    fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: newTheme })
    }).catch(error => console.error('Failed to save theme:', error));
  };

  return (
    <SettingsContext.Provider value={{
      weekStartDay,
      theme,
      loading,
      updateWeekStartDay,
      updateTheme
    }}>
      {children}
    </SettingsContext.Provider>
  );
}