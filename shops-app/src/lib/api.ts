import axios, { AxiosInstance, AxiosError } from 'axios';

import { API_BASE_URL } from '@/services/api';

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================

export interface SignupPayload {
  email: string;
  phone: string;
  full_name: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
  };
}

export const authAPI = {
  signup: async (payload: SignupPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/signup', payload);
    return response.data;
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/login/access-token', payload);
    return response.data;
  },
};

// ============================================
// Orders API
// ============================================

export interface OrderItem {
  product_id: string;
  title: string;
  quantity: number;
  price: number;
}

export interface CreateOrderPayload {
  items: OrderItem[];
  delivery_option: 'delivery' | 'pickup';
  delivery_address?: string;
  phone_number: string;
  courier_tip: number;
  promo_code?: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface Order {
  id: string;
  user_id: string;
  seller_id: string;
  status: string;
  delivery_option: string;
  delivery_address?: string;
  phone_number: string;
  total_amount: number;
  platform_fee: number;
  seller_amount: number;
  courier_tip: number;
  payment_status: string;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export const ordersAPI = {
  create: async (payload: CreateOrderPayload): Promise<Order> => {
    const response = await apiClient.post<Order>('/orders', payload);
    return response.data;
  },

  list: async (status?: string, limit: number = 20): Promise<Order[]> => {
    const response = await apiClient.get<Order[]>('/orders', {
      params: { status, limit },
    });
    return response.data;
  },

  get: async (orderId: string): Promise<Order> => {
    const response = await apiClient.get<Order>(`/orders/${orderId}`);
    return response.data;
  },

  rateDelivery: async (orderId: string, rating: number, comment?: string) => {
    const response = await apiClient.post(`/orders/${orderId}/rate-delivery`, {
      rating,
      comment,
    });
    return response.data;
  },

  reportIssue: async (
    orderId: string,
    issue_type: 'item_mismatch' | 'damaged' | 'missing_items' | 'other',
    description: string,
    images?: string[]
  ) => {
    const response = await apiClient.post(`/orders/${orderId}/report-issue`, {
      issue_type,
      description,
      images,
    });
    return response.data;
  },
};

// ============================================
// Payments API
// ============================================

export interface InitiateMPesaPayload {
  phone_number: string;
  amount: number;
  order_id: string;
  account_reference: string;
  transaction_description?: string;
}

export interface PaymentStatus {
  order_id: string;
  status: 'pending' | 'completed' | 'failed';
  amount: number;
  mpesa_reference?: string;
  payment_method: string;
  created_at: string;
  updated_at: string;
}

export const paymentsAPI = {
  initiateMPesa: async (payload: InitiateMPesaPayload) => {
    const response = await apiClient.post('/payments/mpesa/initiate', payload);
    return response.data;
  },

  checkStatus: async (orderId: string): Promise<PaymentStatus> => {
    const response = await apiClient.get<PaymentStatus>(
      `/payments/${orderId}/status`
    );
    return response.data;
  },

  refund: async (orderId: string, amount?: number) => {
    const response = await apiClient.post(`/payments/${orderId}/refund`, {
      amount,
    });
    return response.data;
  },
};

// ============================================
// Sellers API
// ============================================

export interface SellerRegistration {
  shop_name: string;
  owner_name: string;
  email: string;
  phone: string;
  mpesa_number: string;
  shop_address: string;
  category: string;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface SellerProfile {
  id: string;
  shop_name: string;
  owner_name: string;
  email: string;
  phone: string;
  mpesa_number: string;
  mpesa_verified: boolean;
  shop_address: string;
  category: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SellerEarnings {
  total_earnings: number;
  platform_fees: number;
  net_earnings: number;
  transactions: Array<{
    date: string;
    amount: number;
    order_id: string;
  }>;
}

export const sellersAPI = {
  register: async (payload: SellerRegistration): Promise<SellerProfile> => {
    const response = await apiClient.post<SellerProfile>('/sellers/register', payload);
    return response.data;
  },

  getProfile: async (): Promise<SellerProfile> => {
    const response = await apiClient.get<SellerProfile>('/sellers/me');
    return response.data;
  },

  updateProfile: async (data: Partial<SellerProfile>): Promise<SellerProfile> => {
    const response = await apiClient.patch<SellerProfile>('/sellers/me', data);
    return response.data;
  },

  verifyMPesa: async (mpesa_number: string) => {
    const response = await apiClient.post('/sellers/verify-mpesa', {
      mpesa_number,
    });
    return response.data;
  },

  getOrders: async (status?: string, limit: number = 20) => {
    const response = await apiClient.get('/sellers/me/orders', {
      params: { status, limit },
    });
    return response.data;
  },

  getOrder: async (orderId: string) => {
    const response = await apiClient.get(`/sellers/me/orders/${orderId}`);
    return response.data;
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const response = await apiClient.patch(`/sellers/me/orders/${orderId}`, {
      status,
    });
    return response.data;
  },

  confirmPayment: async (orderId: string) => {
    const response = await apiClient.post(
      `/sellers/me/orders/${orderId}/confirm-payment`,
      {}
    );
    return response.data;
  },

  getEarnings: async (period: string = 'monthly'): Promise<SellerEarnings> => {
    const response = await apiClient.get<SellerEarnings>('/sellers/me/earnings', {
      params: { period },
    });
    return response.data;
  },

  requestWithdrawal: async (amount: number) => {
    const response = await apiClient.post('/sellers/me/withdrawals', {
      amount,
    });
    return response.data;
  },

  getWithdrawals: async () => {
    const response = await apiClient.get('/sellers/me/withdrawals');
    return response.data;
  },
};

// ============================================
// Riders API
// ============================================

export interface RiderRegistration {
  phone: string;
  full_name?: string;
  vehicle_type: string;
  vehicle_plate: string;
  current_location: {
    latitude: number;
    longitude: number;
  };
}

export const ridersAPI = {
  register: async (payload: RiderRegistration) => {
    const response = await apiClient.post('/riders/register', payload);
    return response.data;
  },

  updateLocation: async (riderId: string, latitude: number, longitude: number) => {
    const response = await apiClient.post(`/riders/${riderId}/location`, {
      latitude,
      longitude,
    });
    return response.data;
  },

  getAssignments: async (riderId: string, status?: string) => {
    const response = await apiClient.get(`/riders/${riderId}/assignments`, {
      params: { status },
    });
    return response.data;
  },
};

// ============================================
// Cart API (Phase 2)
// ============================================

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  price_at_add: number;
  product_title?: string;
  added_at: string;
}

export interface Cart {
  id: number;
  items: CartItem[];
  promo_code?: string;
  promo_discount_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CartSummary {
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  promo_discount: number;
  tax: number;
  total: number;
  item_count: number;
}

export const cartAPI = {
  getCart: async (): Promise<Cart> => {
    const response = await apiClient.get<Cart>('/cart');
    return response.data;
  },

  addItem: async (productId: number, quantity: number = 1): Promise<CartItem> => {
    const response = await apiClient.post<CartItem>('/cart/items', {
      product_id: productId,
      quantity,
    });
    return response.data;
  },

  removeItem: async (itemId: number): Promise<void> => {
    await apiClient.delete(`/cart/items/${itemId}`);
  },

  updateItemQuantity: async (itemId: number, quantity: number): Promise<CartItem> => {
    const response = await apiClient.patch<CartItem>(`/cart/items/${itemId}`, {
      quantity,
    });
    return response.data;
  },

  clearCart: async (): Promise<void> => {
    await apiClient.delete('/cart');
  },

  applyPromo: async (code: string): Promise<Cart> => {
    const response = await apiClient.post<Cart>('/cart/promo', {
      code,
    });
    return response.data;
  },

  removePromo: async (code: string): Promise<void> => {
    await apiClient.delete(`/cart/promo/${code}`);
  },

  getCartSummary: async (): Promise<CartSummary> => {
    const response = await apiClient.get<CartSummary>('/cart/summary');
    return response.data;
  },

  validateCart: async (): Promise<{ valid: boolean; message: string; item_count: number }> => {
    const response = await apiClient.post('/cart/validate', {});
    return response.data;
  },
};

// ============================================
// Order API (Phase 2)
// ============================================

export interface CreateOrderRequest {
  fulfillment_type: 'delivery' | 'pickup';
  address_id?: number;
  delivery_notes?: string;
  pickup_notes?: string;
  customer_phone: string;
  courier_tip?: number;
}

export interface OrderDetail {
  id: number;
  customer_id: number;
  seller_id: number;
  fulfillment_type: string;
  status: string;
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  delivered_at?: string;
  items: Array<{
    id: number;
    product_id: number;
    product_title: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>;
}

export const orderAPI = {
  createOrder: async (payload: CreateOrderRequest): Promise<OrderDetail> => {
    const response = await apiClient.post<OrderDetail>('/orders', payload);
    return response.data;
  },

  listOrders: async (status?: string, skip: number = 0, limit: number = 20): Promise<OrderDetail[]> => {
    const response = await apiClient.get<OrderDetail[]>('/orders', {
      params: { status, skip, limit, role: 'customer' },
    });
    return response.data;
  },

  getOrder: async (orderId: number): Promise<OrderDetail> => {
    const response = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
    return response.data;
  },

  updateOrderStatus: async (orderId: number, status: string, notes?: string) => {
    const response = await apiClient.patch(`/orders/${orderId}/status`, {
      status,
      notes,
    });
    return response.data;
  },

  cancelOrder: async (orderId: number): Promise<OrderDetail> => {
    const response = await apiClient.post<OrderDetail>(`/orders/${orderId}/cancel`, {});
    return response.data;
  },

  getOrderTracking: async (orderId: number) => {
    const response = await apiClient.get(`/orders/${orderId}/tracking`);
    return response.data;
  },

  getOrderItems: async (orderId: number) => {
    const response = await apiClient.get(`/orders/${orderId}/items`);
    return response.data;
  },
};

// ============================================
// Category API (Phase 2)
// ============================================

export interface Category {
  id: number;
  name_en: string;
  name_so?: string;
  slug: string;
  icon_name: string;
  image_url?: string;
}

export interface CategoryDetail extends Category {
  subcategories?: Array<{
    id: number;
    name_en: string;
    name_so?: string;
    slug: string;
    image_url?: string;
  }>;
  count?: number;
}

export const categoryAPI = {
  listCategories: async (parentId?: number): Promise<Category[]> => {
    const response = await apiClient.get<Category[]>('/categories', {
      params: { parent_id: parentId },
    });
    return response.data;
  },

  getCategory: async (categoryId: number): Promise<CategoryDetail> => {
    const response = await apiClient.get<CategoryDetail>(`/categories/${categoryId}`);
    return response.data;
  },

  getSubcategories: async (categoryId: number) => {
    const response = await apiClient.get(`/categories/${categoryId}/subcategories`);
    return response.data;
  },

  getCategoryBySlug: async (slug: string): Promise<CategoryDetail> => {
    const response = await apiClient.get<CategoryDetail>(`/categories/by-slug/${slug}`);
    return response.data;
  },
};

export default apiClient;
