import api from './api';
import { useAuthStore } from '../store/useAuth';
import type { Feedback } from '../types';

export const feedbackService = {
    async getUserFeedback(userId: number): Promise<Feedback[]> {
        const { data } = await api.get<Feedback[]>(`/feedback/user/${userId}/feedback`);
        return data;
    },

    async getListingFeedback(listingId: number): Promise<Feedback[]> {
        const { data } = await api.get<Feedback[]>(`/feedback/listing/${listingId}`);
        return data;
    },

    async createFeedback(params: { target_user_id: number; listing_id?: number | null; rating: number; comment?: string }): Promise<Feedback> {
        // The backend overwrites author_id from the auth token server-side, but
        // its schema still requires the field to be present in the request body.
        const author_id = useAuthStore.getState().user?.id ?? 0;
        const { data } = await api.post<Feedback>('/feedback/feedback', { author_id, ...params });
        return data;
    },
};

export function averageRating(feedback: Feedback[]): number | null {
    if (feedback.length === 0) return null;
    return feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
}
