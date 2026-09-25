import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
    collapsed: boolean;
    toggle: () => void;
    setCollapsed: (collapsed: boolean) => void;
}

/** Persisted so the desktop category sidebar stays icon-only across visits once a user collapses it. */
export const useSidebarStore = create<SidebarState>()(
    persist(
        (set) => ({
            collapsed: false,
            toggle: () => set((s) => ({ collapsed: !s.collapsed })),
            setCollapsed: (collapsed) => set({ collapsed }),
        }),
        {
            name: 'suqafuran-sidebar',
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            })),
        }
    )
);
