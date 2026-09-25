import api from './api';

export interface ConversionStats {
  total_users: number;
  users_with_ads: number;
  conversion_rate: number;
  signups_today: number;
  signups_week: number;
  ads_today: number;
  ads_week: number;
  active_listings: number;
}

export interface SignupUser {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  is_active: boolean;
  ad_count: number;
  has_posted: boolean;
}

export interface AgentListing {
  id: number;
  title: string;
  is_active: boolean;
  status: string;
  created_at: string;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
  price: number;
  location: string;
  boost_level: number;
  views: number;
}

export const promotionService = {
  // Agent Dashboard - Conversions
  async getConversions(): Promise<ConversionStats> {
    const response = await api.get('/promotions/agent/conversions');
    return response.data;
  },

  // Agent Dashboard - Signups
  async getSignups(params: { search?: string; limit?: number }) {
    const response = await api.get('/promotions/agent/signups', { params });
    return response.data;
  },

  // Agent Dashboard - All Listings
  async getAllListings(params: { search?: string; status_filter?: string; limit?: number }) {
    const response = await api.get('/promotions/agent/all-listings', { params });
    return response.data;
  },

  // Agent Dashboard - History
  async getAgentHistory() {
    const response = await api.get('/promotions/agent/history');
    return response.data;
  },

  // Payment Queue
  async getPaymentQueue() {
    const response = await api.get('/promotions/agent/payment-queue');
    return response.data;
  },

  // Promotions/Vouchers
  async getPromotions() {
    const response = await api.get('/marketing/codes');
    return response.data;
  },

  async createPromotion(data: any) {
    const response = await api.post('/marketing/codes', data);
    return response.data;
  },

  async deletePromotion(id: number) {
    await api.delete(`/marketing/codes/${id}`);
  }
};
