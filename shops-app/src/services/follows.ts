import api from './api';
import type { User, FollowStats } from '../types';

export const followsService = {
    async followUser(userId: number): Promise<void> {
        await api.post(`/follows/follow/${userId}`);
    },

    async unfollowUser(userId: number): Promise<void> {
        await api.delete(`/follows/unfollow/${userId}`);
    },

    async getMyFollowers(): Promise<User[]> {
        const { data } = await api.get<User[]>('/follows/my/followers');
        return data;
    },

    async getMyFollowing(): Promise<User[]> {
        const { data } = await api.get<User[]>('/follows/my/following');
        return data;
    },

    async getFollowStats(userId: number): Promise<FollowStats> {
        const { data } = await api.get<FollowStats>(`/follows/stats/${userId}`);
        return data;
    },
};
