import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const webStorage: Record<string, string> = {};

export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        try {
          return localStorage.getItem(key);
        } catch {
          return webStorage[key] || null;
        }
      }

      return await AsyncStorage.getItem(key);
    } catch {
      return webStorage[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        try {
          localStorage.setItem(key, value);
        } catch {
          webStorage[key] = value;
        }
      } else {
        await AsyncStorage.setItem(key, value);
      }

      webStorage[key] = value;
    } catch {
      webStorage[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        try {
          localStorage.removeItem(key);
        } catch {
          delete webStorage[key];
        }
      } else {
        await AsyncStorage.removeItem(key);
      }
    } finally {
      delete webStorage[key];
    }
  },
};