import api from './api';

export interface AdminStats {
  total_users: number;
  total_listings: number;
  active_listings: number;
  pending_listings: number;
  pending_promotions: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  active_deliveries: number;
  delayed_deliveries: number;
  new_users_this_week: number;
}

export interface OtpLogEntry {
  id: number;
  identifier: string;
  channel: string;
  event_type: string;
  status: string;
  attempt_count: number;
  expires_at: string | null;
  created_at: string;
  meta: Record<string, any> | null;
}

export const adminService = {
  // Stats
  async getStats(): Promise<AdminStats> {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  // Moderation Queue
  async getModerationQueue() {
    const response = await api.get('/admin/queue');
    return response.data;
  },

  async moderateListing(listingId: number, approve: boolean) {
    const response = await api.post(`/admin/moderate/${listingId}`, null, {
      params: { approve }
    });
    return response.data;
  },

  // Users Management
  async getUsers(params?: { skip?: number; limit?: number; search?: string }) {
    const response = await api.get('/admin/users', { params });
    return response.data;
  },

  async getUserCount(search?: string) {
    const response = await api.get('/admin/users/count', { params: search ? { search } : {} });
    return response.data.total;
  },

  async updateUserStatus(userId: number, isActive: boolean) {
    const response = await api.post(`/admin/users/${userId}/status`, null, {
      params: { is_active: isActive }
    });
    return response.data;
  },

  async deleteUser(userId: number) {
    await api.delete(`/admin/users/${userId}`);
  },

  // OTP & Verification
  async getOtp(params: { phone?: string; email?: string }) {
    const response = await api.get('/admin/otps', { params });
    return response.data;
  },

  async getOtpLogs(params: {
    identifier?: string;
    event_type?: string;
    channel?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await api.get('/admin/otp-logs', { params });
    return response.data;
  },

  async getVerificationAttempts(identifier: string) {
    const response = await api.get('/admin/verification-attempts', { params: { identifier } });
    return response.data;
  },

  async getVerificationRequests() {
    const response = await api.get('/verifications/');
    return response.data;
  },

  async moderateVerification(id: number, status: string) {
    const response = await api.patch(`/verifications/${id}`, { status });
    return response.data;
  },

  // Categories
  async createCategory(data: any) {
    const response = await api.post('/listings/categories', data);
    return response.data;
  },

  async updateCategory(id: number, data: any) {
    const response = await api.patch(`/listings/categories/${id}`, data);
    return response.data;
  },

  async deleteCategory(id: number) {
    await api.delete(`/listings/categories/${id}`);
  },

  // Email
  async sendManualEmail(data: any) {
    const response = await api.post('/admin/email/send-manual', data);
    return response.data;
  },

  async sendBroadcastEmail(data: any) {
    const response = await api.post('/admin/email/broadcast', data);
    return response.data;
  },

  async getEmailAnalytics() {
    const response = await api.get('/admin/email/analytics');
    return response.data;
  },

  // Business Queue
  async getBusinessesQueue() {
    const response = await api.get('/admin/businesses/queue');
    return response.data;
  },

  async approveBusiness(businessId: string) {
    const response = await api.post(`/admin/businesses/${businessId}/approve`);
    return response.data;
  },

  async disapproveBusiness(businessId: string) {
    const response = await api.post(`/admin/businesses/${businessId}/disapprove`);
    return response.data;
  }
};
