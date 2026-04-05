import { create } from 'zustand';
import { User } from '../types';
import { authStorage } from '../utils/authStorage';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuestMode: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setGuestMode: (guest: boolean) => void;
  updateUser: (partial: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  isGuestMode: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setToken: (token) => set({ token }),
  setLoading: (isLoading) => set({ isLoading }),
  setGuestMode: (isGuestMode) => set({ isGuestMode, isLoading: false }),

  updateUser: async (partial) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const nextUser = { ...currentUser, ...partial };
    await authStorage.setItem('user', JSON.stringify(nextUser));
    set({ user: nextUser });
  },

  login: async (user, token) => {
    await authStorage.setItem('token', token);
    await authStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false, isGuestMode: false });
  },

  logout: async () => {
    await authStorage.removeItem('token');
    await authStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, isGuestMode: false, isLoading: false });
  },

  loadStoredAuth: async () => {
    try {
      const token = await authStorage.getItem('token');
      const userStr = await authStorage.getItem('user');
      
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.log('Error loading auth:', error);
      set({ isLoading: false });
    }
  },
}));
