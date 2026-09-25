import api from './api';

export const notificationService = {
  // Notifications
  async getNotifications(params?: { limit?: number }) {
    const response = await api.get('/notifications/', { params });
    return response.data;
  },

  async markAsRead(id: number) {
    const response = await api.patch(`/notifications/${id}/read`);
    return response.data;
  },

  async deleteNotification(id: number) {
    await api.delete(`/notifications/${id}`);
  }
};
