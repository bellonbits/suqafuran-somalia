import api from './api';

export interface SupportTicket {
  id: number;
  subject: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  created_at: string;
  last_agent_response?: string;
  admin_notes?: string;
  chat_history?: Array<{ role: 'user' | 'agent'; message: string; timestamp: string }>;
}

export const supportService = {
  // Get Tickets
  async getTickets(params?: { status?: string; limit?: number; skip?: number }) {
    const response = await api.get('/support/tickets', { params });
    return response.data;
  },

  // Update Ticket
  async updateTicket(id: number, data: { status?: string; admin_notes?: string }) {
    const response = await api.patch(`/support/tickets/${id}`, data);
    return response.data;
  },

  // Reply to Ticket
  async replyToTicket(id: number, message: string) {
    const response = await api.post(`/support/tickets/${id}/reply`, { message });
    return response.data;
  },

  // Current user's open AI-support ticket, if any
  async getMyActiveTicket() {
    const response = await api.get('/support/my-active-ticket');
    return response.data;
  },

  // Guest lookup (no auth) -- used to resume a chat after reload. The token
  // was returned when the ticket was created; the id alone is not enough.
  async getTicketById(id: number, token: string) {
    const response = await api.get(`/support/ticket-by-id/${id}`, {
      headers: { 'X-Ticket-Token': token },
    });
    return response.data;
  }
};
