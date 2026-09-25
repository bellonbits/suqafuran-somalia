import api from './api';

export const messageService = {
  // Messages
  async getMessages(params?: { limit?: number; skip?: number }) {
    const response = await api.get('/messages', { params });
    return response.data;
  },

  async getMessage(id: number) {
    const response = await api.get(`/messages/${id}`);
    return response.data;
  },

  async sendMessage(data: any) {
    const response = await api.post('/messages', data);
    return response.data;
  },

  async deleteMessage(id: number) {
    await api.delete(`/messages/${id}`);
  }
};
