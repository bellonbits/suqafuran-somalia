import { create } from 'zustand';
import { favoritesService } from '../services/favorites';

interface FavoritesState {
    ids: Set<number>;
    hydrated: boolean;
    hydrate: () => Promise<void>;
    isFavorite: (listingId: number) => boolean;
    toggleFavorite: (listingId: number) => Promise<void>;
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
    ids: new Set(),
    hydrated: false,
    hydrate: async () => {
        try {
            const favorites = await favoritesService.getMyFavorites();
            set({ ids: new Set(favorites.map(f => f.id)), hydrated: true });
        } catch {
            set({ hydrated: true });
        }
    },
    isFavorite: (listingId) => get().ids.has(listingId),
    toggleFavorite: async (listingId) => {
        const isFav = get().ids.has(listingId);
        // Optimistic update
        set((state) => {
            const next = new Set(state.ids);
            if (isFav) next.delete(listingId); else next.add(listingId);
            return { ids: next };
        });
        try {
            if (isFav) {
                await favoritesService.removeFavorite(listingId);
                console.log('Removed favorite:', listingId);
            } else {
                await favoritesService.addFavorite(listingId);
                console.log('Added favorite:', listingId);
            }
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            // Revert on failure
            set((state) => {
                const next = new Set(state.ids);
                if (isFav) next.add(listingId); else next.delete(listingId);
                return { ids: next };
            });
        }
    },
}));
