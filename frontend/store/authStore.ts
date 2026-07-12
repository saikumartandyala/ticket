import { create } from 'zustand';

interface User {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  avatar_url?: string;
  phone_verified: boolean;
  email_verified: boolean;
  avg_rating: number;
  rating_count: number;
  total_listings: number;
  total_matches: number;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  // Safe extraction of initial storage state if in browser context
  let initialToken = null;
  let initialUser = null;
  if (typeof window !== 'undefined') {
    initialToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        initialUser = JSON.parse(storedUser);
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
  }

  return {
    user: initialUser,
    token: initialToken,
    isAuthenticated: !!initialToken,
    
    setAuth: (user, token) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true });
    },
    
    updateUser: (updatedFields) => {
      set((state) => {
        if (!state.user) return state;
        const newUser = { ...state.user, ...updatedFields };
        if (typeof window !== 'undefined') {
          localStorage.setItem('user', JSON.stringify(newUser));
        }
        return { user: newUser };
      });
    },
    
    logout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Call backend API logout to clear httpOnly cookies
        fetch('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
      }
      set({ user: null, token: null, isAuthenticated: false });
    }
  };
});
