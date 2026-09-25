import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../types';
import { resetAnalytics } from '../lib/analytics';

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isHydrated: boolean;
    login: (user: User, token: string) => void;
    /** notifyServer=false when the server already rejected the session (401). */
    logout: (notifyServer?: boolean) => void;
    setUser: (user: User) => void;
    setHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            isAuthenticated: false,
            isHydrated: false,
            login: (user, token) => set({ user, token, isAuthenticated: true }),
            logout: (notifyServer = true) => {
                // Sessions last until logout, so end this one on the server too;
                // otherwise a copied token would keep working. Fire-and-forget:
                // the local sign-out never waits on the network.
                const token = get().token;
                if (notifyServer && token) {
                    // Lazy import: api.ts imports this store.
                    import('../services/api')
                        .then(({ default: api }) =>
                            api.post('/auth/logout', null, { headers: { Authorization: `Bearer ${token}` } })
                        )
                        .catch(() => {});
                }
                resetAnalytics();
                set({ user: null, token: null, isAuthenticated: false });
            },
            setUser: (user) => set({ user }),
            setHydrated: (state) => set({ isHydrated: state }),
        }),
        {
            name: 'suqafuran-auth-redesign',
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            })),
            onRehydrateStorage: () => (state) => {
                if (state) state.setHydrated(true);
            },
        }
    )
);
