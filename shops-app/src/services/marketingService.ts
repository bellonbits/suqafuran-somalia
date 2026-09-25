import api from './api';

export const marketingService = {
  // Campaigns
  async getCampaigns() {
    const response = await api.get('/marketing/campaigns');
    return response.data;
  },

  async createCampaign(data: any) {
    const response = await api.post('/marketing/campaigns', data);
    return response.data;
  },

  async updateCampaign(id: number, data: any) {
    const response = await api.patch(`/marketing/campaigns/${id}`, data);
    return response.data;
  },

  async deleteCampaign(id: number) {
    await api.delete(`/marketing/campaigns/${id}`);
  },

  // Promotional Codes
  async getPromoCodes() {
    const response = await api.get('/marketing/codes');
    return response.data;
  },

  async createPromoCode(data: any) {
    const response = await api.post('/marketing/codes', data);
    return response.data;
  },

  async deletePromoCode(id: number) {
    await api.delete(`/marketing/codes/${id}`);
  }
};
