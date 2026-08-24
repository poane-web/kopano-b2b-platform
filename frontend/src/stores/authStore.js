import { create } from 'zustand';
import { api } from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('kopano_token'),
  isLoading: true,
  isAuthenticated: false,
  
  init: async () => {
    const token = localStorage.getItem('kopano_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const user = await api.auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('kopano_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
  
  login: async (phone, pin) => {
    const res = await api.auth.login(phone, pin);
    localStorage.setItem('kopano_token', res.token);
    set({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  },
  
  register: async (data) => {
    const res = await api.auth.register(data);
    localStorage.setItem('kopano_token', res.token);
    set({ user: res.user, token: res.token, isAuthenticated: true });
    return res;
  },
  
  logout: () => {
    localStorage.removeItem('kopano_token');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/';
  },
  
  setUser: (user) => set({ user }),
}));
