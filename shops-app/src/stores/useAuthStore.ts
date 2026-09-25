import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  is_admin?: boolean;
  is_agent?: boolean;
  is_rider?: boolean;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,

  setUser: (user: User | null) => set({ user }),
  setToken: (token: string | null) => set({ token }),

  logout: () => set({ user: null, token: null }),
}));
