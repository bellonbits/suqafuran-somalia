import api from './api';

export interface BusinessDashboard {
  total_sales: number;
  pending_orders: number;
  completed_orders: number;
  total_earnings: number;
  average_rating: number;
  total_products: number;
  active_products: number;
}

export interface Order {
  id: number;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  items_count: number;
}

export interface Listing {
  id: number;
  title: string;
  price: number;
  status: string;
  views: number;
  created_at: string;
}

export const businessService = {
  // Dashboard
  async getDashboard() {
    const response = await api.get('/sellers/me/dashboard');
    return response.data;
  },

  // Orders
  async getOrders(params?: { limit?: number; skip?: number }) {
    const response = await api.get('/sellers/me/orders', { params });
    return response.data;
  },

  // Earnings & Withdrawals
  async getEarnings() {
    const response = await api.get('/sellers/me/earnings');
    return response.data;
  },

  async getWithdrawals() {
    const response = await api.get('/sellers/me/withdrawals');
    return response.data;
  },

  async createWithdrawal(data: { amount: number; payment_method: string }) {
    const response = await api.post('/sellers/me/withdrawals', data);
    return response.data;
  },

  // Listings/Products
  async getListings(params?: { limit?: number; skip?: number }) {
    const response = await api.get('/sellers/me/listings', { params });
    return response.data;
  },

  async createListing(data: any) {
    const response = await api.post('/listings', data);
    return response.data;
  },

  async updateListing(id: number, data: any) {
    const response = await api.patch(`/listings/${id}`, data);
    return response.data;
  },

  async deleteListing(id: number) {
    await api.delete(`/listings/${id}`);
  },

  // Shop Profile
  async getShopProfile(id?: number) {
    const endpoint = id ? `/sellers/${id}` : '/sellers/me';
    const response = await api.get(endpoint);
    return response.data;
  },

  async updateShopProfile(data: any) {
    const response = await api.patch('/sellers/me', data);
    return response.data;
  },

  // Verification
  async verifyMpesa(data: any) {
    const response = await api.post('/sellers/verify-mpesa', data);
    return response.data;
  }
};
