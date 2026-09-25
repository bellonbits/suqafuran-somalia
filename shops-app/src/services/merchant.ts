import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8003';

export interface Merchant {
  id: string;
  user_id: string;
  store_name: string;
  slug: string;
  description_en: string;
  description_so?: string;
  logo_url: string;
  location_lat: number;
  location_lng: number;
  address: string;
  phone: string;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
}

export interface OrderInbox {
  id: string;
  merchant_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  type: string;
  items: any[];
  total_amount: number;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  special_instructions?: string;
  created_at: string;
}

export interface MerchantDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  current_lat?: number;
  current_lng?: number;
  eta_minutes?: number;
  created_at: string;
}

export interface MerchantAnalytics {
  total_orders: number;
  total_revenue: number;
  average_rating: number;
  orders_today: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  top_products: any[];
}

export const merchantAPI = {
  // Profile
  getProfile: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/merchants/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as Merchant;
  },

  updateProfile: async (token: string, merchant: Partial<Merchant>) => {
    const response = await axios.put(`${API_BASE_URL}/v1/merchants/profile`, merchant, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  },

  // Orders
  getOrders: async (token: string, status?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await axios.get(`${API_BASE_URL}/v1/merchants/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as OrderInbox[];
  },

  getOrder: async (token: string, orderId: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/merchants/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as OrderInbox;
  },

  acceptOrder: async (token: string, orderId: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/merchants/orders/${orderId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  rejectOrder: async (token: string, orderId: string, reason?: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/merchants/orders/${orderId}/reject`,
      { reason },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  updateOrderStatus: async (token: string, orderId: string, status: string) => {
    const response = await axios.patch(
      `${API_BASE_URL}/v1/merchants/orders/${orderId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  // Deliveries
  getDeliveries: async (token: string, limit = 20, offset = 0) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/merchants/deliveries?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as MerchantDelivery[];
  },

  getDelivery: async (token: string, deliveryId: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/merchants/deliveries/${deliveryId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as MerchantDelivery;
  },

  // Analytics
  getAnalytics: async (token: string, period: 'today' | 'week' | 'month' = 'today') => {
    const response = await axios.get(`${API_BASE_URL}/v1/merchants/analytics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as MerchantAnalytics;
  },
};
