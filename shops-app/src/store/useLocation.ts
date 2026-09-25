import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface LocationState {
    city: string | null;
    lat: number | null;
    lng: number | null;
    countryCode: string | null;
    permissionAsked: boolean;
    isHydrated: boolean;
    setLocation: (city: string | null, lat: number | null, lng: number | null, countryCode?: string | null) => void;
    setPermissionAsked: (v: boolean) => void;
    clearLocation: () => void;
    setHydrated: (v: boolean) => void;
}

export const useLocationStore = create<LocationState>()(
    persist(
        (set) => ({
            city: null,
            lat: null,
            lng: null,
            countryCode: null,
            permissionAsked: false,
            isHydrated: false,
            setLocation: (city, lat, lng, countryCode) => set((s) => ({ city, lat, lng, countryCode: countryCode ?? s.countryCode })),
            setPermissionAsked: (permissionAsked) => set({ permissionAsked }),
            clearLocation: () => set({ city: null, lat: null, lng: null }),
            setHydrated: (isHydrated) => set({ isHydrated }),
        }),
        {
            name: 'suqafuran-location',
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
