import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8006';

export interface DriverProfile {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_color: string;
  license_plate: string;
  is_verified: boolean;
  status: 'online' | 'offline' | 'busy';
  rating: number;
  acceptance_rate: number;
  current_lat: number;
  current_lng: number;
  last_seen: string;
}

export interface JobOffer {
  id: string;
  order_id: string;
  customer_id: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  delivery_fee: number;
  estimated_distance: number;
  estimated_duration: number;
  order_type: string;
  expires_at: string;
  created_at: string;
}

export interface ActiveDelivery {
  id: string;
  order_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string;
  delivery_fee: number;
  created_at: string;
  eta_minutes: number;
}

export interface DriverEarnings {
  id: string;
  driver_id: string;
  order_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  paid_at: string;
  created_at: string;
}

export interface DriverWallet {
  driver_id: string;
  available_balance: number;
  pending_balance: number;
  lifetime_earnings: number;
  currency: string;
}

export const driverAPI = {
  // Profile
  getProfile: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as DriverProfile;
  },

  updateProfile: async (token: string, profile: Partial<DriverProfile>) => {
    const response = await axios.put(`${API_BASE_URL}/v1/drivers/profile`, profile, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  },

  updateStatus: async (token: string, status: 'online' | 'offline' | 'busy') => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  // Location
  updateLocation: async (token: string, lat: number, lng: number, heading?: number) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/location`,
      { lat, lng, heading },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Job Offers
  getActiveOffers: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as JobOffer[];
  },

  acceptOffer: async (token: string, offerId: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/offers/${offerId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  rejectOffer: async (token: string, offerId: string) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/offers/${offerId}/reject`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  },

  // Active Deliveries
  getActiveDeliveries: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/deliveries/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as ActiveDelivery[];
  },

  getDelivery: async (token: string, deliveryId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as ActiveDelivery;
  },

  updateDeliveryStatus: async (
    token: string,
    deliveryId: string,
    status: 'picked_up' | 'in_transit' | 'delivered' | 'cancelled'
  ) => {
    const response = await axios.patch(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}/status`,
      { status },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  submitProofOfDelivery: async (
    token: string,
    deliveryId: string,
    imageUrl: string,
    notes?: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/drivers/deliveries/${deliveryId}/proof`,
      { image_url: imageUrl, notes },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  // Earnings
  getEarnings: async (token: string, limit = 20, offset = 0) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/drivers/earnings?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data as DriverEarnings[];
  },

  getTodayEarnings: async (token: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/drivers/earnings/today`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  },

  // Wallet
  getWallet: async (token: string, driverId: string) => {
    const response = await axios.get(`${API_BASE_URL}/v1/wallets/${driverId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data as DriverWallet;
  },

  // Withdrawals
  requestWithdrawal: async (
    token: string,
    amount: number,
    method: 'mpesa' | 'evc' | 'zaad' | 'sahal',
    phone: string
  ) => {
    const response = await axios.post(
      `${API_BASE_URL}/v1/wallets/withdraw`,
      { amount, method, phone },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  getWithdrawalHistory: async (token: string, driverId: string) => {
    const response = await axios.get(
      `${API_BASE_URL}/v1/wallets/${driverId}/withdrawals`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },
};
