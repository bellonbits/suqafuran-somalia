import api from './api';

export const deliveryService = {
  // Deliveries
  async getDeliveries(params?: { limit?: number }) {
    try {
      const response = await api.get('/delivery/my/delivery', { params });
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return [];
      }
      throw error;
    }
  },

  async updateDelivery(id: number, data: any) {
    try {
      const response = await api.patch(`/delivery/my/delivery/${id}`, data);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return {};
      }
      throw error;
    }
  }
};
