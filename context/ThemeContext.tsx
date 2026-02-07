import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LightTheme,
  DarkTheme,
  ThemeColors,
  Priorities,
  DarkPriorities,
  StatusColors,
  DarkStatusColors,
} from '../constants/colors';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: ThemeColors;
  priorities: typeof Priorities;
  statusColors: typeof StatusColors;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  toggleTheme: () => {},
  colors: LightTheme,
  priorities: Priorities,
  statusColors: StatusColors,
});

const THEME_KEY = '@bild_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((value) => {
      if (value === 'dark') setIsDark(true);
    });
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  const value: ThemeContextType = {
    isDark,
    toggleTheme,
    colors: isDark ? DarkTheme : LightTheme,
    priorities: isDark ? DarkPriorities : Priorities,
    statusColors: isDark ? DarkStatusColors : StatusColors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
