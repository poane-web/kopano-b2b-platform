import { create } from 'zustand';
import { api } from '../api/client';
import { homePath } from '../lib/format';

export const useAuthStore = create((set) => ({
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
      localStorage.removeItem('kopano_refresh');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (phone, pin) => {
    const res = await api.auth.login(phone, pin);
    localStorage.setItem('kopano_token', res.token);
    if (res.refreshToken) localStorage.setItem('kopano_refresh', res.refreshToken);
    set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    return res;
  },

  loginSupplier: async (email, password) => {
    const res = await api.supplier.login(email, password);
    localStorage.setItem('kopano_token', res.token);
    if (res.refreshToken) localStorage.setItem('kopano_refresh', res.refreshToken);
    set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    return res;
  },

  register: async (data) => {
    const res = await api.auth.register(data);
    localStorage.setItem('kopano_token', res.token);
    if (res.refreshToken) localStorage.setItem('kopano_refresh', res.refreshToken);
    set({ user: res.user, token: res.token, isAuthenticated: true, isLoading: false });
    return res;
  },

  logout: () => {
    localStorage.removeItem('kopano_token');
    localStorage.removeItem('kopano_refresh');
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = '/';
  },

  setUser: (user) => set({ user }),
  homePath: () => homePath(useAuthStore.getState().user?.role),
}));
