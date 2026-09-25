import api from './api';
import type { SupportTicket, SupportStats } from '../types';

export const supportService = {
    async listTickets(params?: { skip?: number; limit?: number; status?: string }): Promise<SupportTicket[]> {
        const { data } = await api.get<SupportTicket[]>('/support/tickets', { params });
        return data;
    },

    async getTicket(id: number): Promise<SupportTicket> {
        const { data } = await api.get<SupportTicket>(`/support/tickets/${id}`);
        return data;
    },

    async updateTicket(id: number, update: { status?: string; admin_notes?: string; priority?: string }): Promise<SupportTicket> {
        const { data } = await api.patch<SupportTicket>(`/support/tickets/${id}`, update);
        return data;
    },

    async replyToTicket(id: number, message: string): Promise<SupportTicket> {
        const { data } = await api.post<SupportTicket>(`/support/tickets/${id}/reply`, { message });
        return data;
    },

    async deleteTicket(id: number): Promise<void> {
        await api.delete(`/support/tickets/${id}`);
    },

    async getStats(): Promise<SupportStats> {
        const { data } = await api.get<SupportStats>('/support/stats');
        return data;
    },
};
