'use client';

import { create } from 'zustand';
import { api, ApiError } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  /** True once we've asked the API who (if anyone) is signed in. */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Store the profile after a successful sign-in (the session itself is the HttpOnly cookie). */
  setAuth: (user: User) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

/**
 * The session lives only in the API's HttpOnly cookie — nothing secret (and no
 * personal data) is kept in localStorage. `hydrate()` asks the API for the
 * current user once after mount, so server and first client render agree.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    // Remove anything older versions of the app stored in the browser.
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch {}
    try {
      const user = await api<User>('/auth/me');
      set({ user, isAuthenticated: true, hydrated: true });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status === 401 || e.status === 0) {
        set({ user: null, isAuthenticated: false, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    }
  },

  setAuth: (user) => set({ user, isAuthenticated: true, hydrated: true }),

  updateUser: (fields) => {
    const current = get().user;
    if (!current) return;
    set({ user: { ...current, ...fields } });
  },

  logout: () => {
    // Ends the session on the server (all devices) and clears the cookie.
    api('/auth/logout', { method: 'POST', keepalive: true }).catch(() => {});
    set({ user: null, isAuthenticated: false });
  },
}));
