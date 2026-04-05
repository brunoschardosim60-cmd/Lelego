import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { applyThemePalette, DARK_COLORS, LIGHT_COLORS } from '../constants/theme';

interface ThemeState {
  isDark: boolean;
  toggle: () => Promise<void>;
  loadTheme: () => Promise<void>;
}

const STORAGE_KEY = 'theme-preference-v2';

const webStorage: Record<string, string> = {};

const safeGetItem = async (key: string): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return webStorage[key] ?? null;
    }
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = async (key: string, value: string): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      webStorage[key] = value;
    }
    return;
  }

  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // no-op
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,
  toggle: async () => {
    const nextIsDark = !get().isDark;
    applyThemePalette(nextIsDark ? DARK_COLORS : LIGHT_COLORS);
    set({ isDark: nextIsDark });
    await safeSetItem(STORAGE_KEY, JSON.stringify({ isDark: nextIsDark }));
  },
  loadTheme: async () => {
    const raw = await safeGetItem(STORAGE_KEY);
    if (!raw) {
      applyThemePalette(DARK_COLORS);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const isDark = Boolean(parsed?.isDark);
      applyThemePalette(isDark ? DARK_COLORS : LIGHT_COLORS);
      set({ isDark });
    } catch {
      applyThemePalette(DARK_COLORS);
      set({ isDark: true });
    }
  },
}));
