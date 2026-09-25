import api from './api';
import type { Listing } from '../types';

export const favoritesService = {
    async getMyFavorites(): Promise<Listing[]> {
        const { data } = await api.get<Listing[]>('/favorites/');
        return data;
    },

    async addFavorite(listingId: number): Promise<void> {
        await api.post(`/favorites/${listingId}`);
    },

    async removeFavorite(listingId: number): Promise<void> {
        await api.delete(`/favorites/${listingId}`);
    },
};
