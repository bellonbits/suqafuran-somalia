import { create } from 'zustand';

type AuthModalMode = 'signin' | 'signup';

interface AuthModalState {
    isOpen: boolean;
    mode: AuthModalMode;
    open: (mode?: AuthModalMode) => void;
    close: () => void;
}

export const useAuthModal = create<AuthModalState>((set) => ({
    isOpen: false,
    mode: 'signin',
    open: (mode = 'signin') => set({ isOpen: true, mode }),
    close: () => set({ isOpen: false }),
}));
