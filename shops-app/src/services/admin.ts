import api from './api';
import type {
    Listing, User, Business, SiteContent, FraudEvent, Report, UserRiskProfile,
    Voucher, MobileTransaction, PromotionRead, AgentSignup, AgentListingRow, AgentConversions,
    Category, SubCategory, SubSubCategory, MarketingCode, AuditLogEntry,
    OtpLookupResult, OtpLogEntry, VerificationAttemptsResult, EmailAnalytics,
} from '../types';

export interface AdminStats {
    total_users: number;
    total_listings: number;
    active_listings: number;
    pending_listings: number;
    pending_promotions: number;
}

export interface AgentSummary {
    id: number;
    full_name: string;
    email: string;
    phone?: string | null;
    created_at: string;
}

export const adminService = {
    async getStats(): Promise<AdminStats> {
        const { data } = await api.get<AdminStats>('/admin/stats');
        return data;
    },

    // Listing moderation
    async getModerationQueue(params?: { skip?: number; limit?: number }): Promise<Listing[]> {
        const { data } = await api.get<Listing[]>('/admin/queue', { params });
        return data;
    },

    async moderateListing(listingId: number, approve: boolean): Promise<Listing> {
        const { data } = await api.post<Listing>(`/admin/moderate/${listingId}`, null, { params: { approve } });
        return data;
    },

    // Users
    async listUsers(params?: { skip?: number; limit?: number; search?: string }): Promise<User[]> {
        const { data } = await api.get<User[]>('/admin/users', { params });
        return data;
    },

    async countUsers(search?: string): Promise<number> {
        const { data } = await api.get<{ total: number }>('/admin/users/count', { params: { search } });
        return data.total;
    },

    async updateUserStatus(userId: number, isActive: boolean): Promise<User> {
        const { data } = await api.post<User>(`/admin/users/${userId}/status`, null, { params: { is_active: isActive } });
        return data;
    },

    async deleteUser(userId: number): Promise<void> {
        await api.delete(`/admin/users/${userId}`);
    },

    // Agents
    async listAgents(): Promise<AgentSummary[]> {
        const { data } = await api.get<AgentSummary[]>('/admin/agents');
        return data;
    },

    async addAgent(email: string): Promise<{ success: boolean; name: string; email: string }> {
        const { data } = await api.post('/admin/agents/add', { email });
        return data;
    },

    async removeAgent(email: string): Promise<{ success: boolean }> {
        const { data } = await api.post('/admin/agents/remove', { email });
        return data;
    },

    // Business moderation
    async getBusinessQueue(params?: { skip?: number; limit?: number }): Promise<Business[]> {
        const { data } = await api.get<Business[]>('/admin/businesses/queue', { params });
        return data;
    },

    async approveBusiness(businessId: string): Promise<Business> {
        const { data } = await api.post<Business>(`/admin/businesses/${businessId}/approve`);
        return data;
    },

    async disapproveBusiness(businessId: string): Promise<Business> {
        const { data } = await api.post<Business>(`/admin/businesses/${businessId}/disapprove`);
        return data;
    },

    // Site content
    async getAllContent(): Promise<SiteContent[]> {
        const { data } = await api.get<SiteContent[]>('/content/all');
        return data;
    },

    async updateContent(key: string, payload: { value_en?: string; value_so?: string }): Promise<SiteContent> {
        const { data } = await api.patch<SiteContent>(`/content/${key}`, payload);
        return data;
    },

    // Wallet / vouchers
    async getVouchers(): Promise<Voucher[]> {
        const { data } = await api.get<Voucher[]>('/wallet/vouchers');
        return data;
    },

    async createVoucher(code: string, amount: number): Promise<Voucher> {
        const { data } = await api.post<Voucher>('/wallet/vouchers', { code, amount });
        return data;
    },

    // Trust & safety
    async getFraudEvents(params?: { skip?: number; limit?: number }): Promise<FraudEvent[]> {
        const { data } = await api.get<FraudEvent[]>('/trust_ops/fraud-events', { params });
        return data;
    },

    async getReports(status: string = 'pending'): Promise<Report[]> {
        const { data } = await api.get<Report[]>('/trust_ops/reports', { params: { status } });
        return data;
    },

    async getUserRiskProfile(userId: number): Promise<UserRiskProfile> {
        const { data } = await api.get<UserRiskProfile>(`/trust_ops/user-risk/${userId}`);
        return data;
    },

    async moderateReport(reportId: number, action: 'dismiss' | 'warn' | 'ban' | 'remove_listing', note: string): Promise<{ status: string }> {
        const { data } = await api.post(`/trust_ops/moderate-report/${reportId}`, null, { params: { action, note } });
        return data;
    },

    // Promotions (admin)
    async getPromotionPlans(): Promise<{ id: number; name_en: string; name_so?: string; price_usd: number; duration_days: number }[]> {
        const { data } = await api.get('/promotions/plans');
        return data;
    },

    async getPendingPromotions(): Promise<PromotionRead[]> {
        const { data } = await api.get<PromotionRead[]>('/promotions/pending');
        return data;
    },

    async approvePromotion(promoId: number, planId: number): Promise<{ success: boolean; promotion_code: string; expires_at: string; message: string }> {
        const { data } = await api.post(`/promotions/${promoId}/approve`, { plan_id: planId });
        return data;
    },

    async rejectPromotion(promoId: number, reason: string): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post(`/promotions/${promoId}/reject`, { reason });
        return data;
    },

    async directPromote(listingId: number, planId: number, paymentPhone: string): Promise<{ success: boolean; promotion_code: string; listing_id: number; message: string }> {
        const { data } = await api.post('/promotions/admin/direct-promote', { listing_id: listingId, plan_id: planId, payment_phone: paymentPhone });
        return data;
    },

    async generatePromoCode(amount: number = 0): Promise<{ code: string; id: number; amount: number }> {
        const { data } = await api.post('/promotions/codes/generate', { amount });
        return data;
    },

    // Agent / marketing portal (also accessible to admins)
    async getPaymentQueue(): Promise<MobileTransaction[]> {
        const { data } = await api.get<MobileTransaction[]>('/promotions/agent/payment-queue');
        return data;
    },

    async rejectTransaction(txId: number): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post(`/promotions/agent/transactions/${txId}/reject`);
        return data;
    },

    async getPendingOrders(): Promise<PromotionRead[]> {
        const { data } = await api.get<PromotionRead[]>('/promotions/agent/pending-orders');
        return data;
    },

    async getAgentHistory(limit: number = 50): Promise<PromotionRead[]> {
        const { data } = await api.get<PromotionRead[]>('/promotions/agent/history', { params: { limit } });
        return data;
    },

    async matchPayment(promoId: number, transactionId: number): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post(`/promotions/${promoId}/match`, { transaction_id: transactionId });
        return data;
    },

    async activatePromotion(promoId: number): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post(`/promotions/${promoId}/activate`);
        return data;
    },

    async getAgentConversions(): Promise<AgentConversions> {
        const { data } = await api.get<AgentConversions>('/promotions/agent/conversions');
        return data;
    },

    async getAgentSignups(params?: { skip?: number; limit?: number; search?: string }): Promise<AgentSignup[]> {
        const { data } = await api.get<AgentSignup[]>('/promotions/agent/signups', { params });
        return data;
    },

    async getAgentAllListings(params?: { skip?: number; limit?: number; search?: string; status_filter?: string }): Promise<AgentListingRow[]> {
        const { data } = await api.get<AgentListingRow[]>('/promotions/agent/all-listings', { params });
        return data;
    },

    async endListing(listingId: number): Promise<{ success: boolean }> {
        const { data } = await api.post(`/promotions/agent/listings/${listingId}/end`);
        return data;
    },

    async reactivateListing(listingId: number): Promise<{ success: boolean }> {
        const { data } = await api.post(`/promotions/agent/listings/${listingId}/reactivate`);
        return data;
    },

    async approveListingAgent(listingId: number): Promise<{ success: boolean }> {
        const { data } = await api.post(`/promotions/agent/listings/${listingId}/approve`);
        return data;
    },

    async rejectListingAgent(listingId: number): Promise<{ success: boolean }> {
        const { data } = await api.post(`/promotions/agent/listings/${listingId}/reject`);
        return data;
    },

    // Category / taxonomy management
    async createCategory(payload: { name_en: string; name_so?: string; slug: string; icon_name: string; image_url?: string }): Promise<Category> {
        const { data } = await api.post('/listings/categories', payload);
        return data;
    },

    async updateCategory(id: number, payload: Partial<{ name_en: string; name_so: string; slug: string; icon_name: string; image_url: string }>): Promise<Category> {
        const { data } = await api.patch(`/listings/categories/${id}`, payload);
        return data;
    },

    async deleteCategory(id: number): Promise<void> {
        await api.delete(`/listings/categories/${id}`);
    },

    async createSubcategory(payload: { name_en: string; name_so?: string; slug: string; category_id: number; image_url?: string }): Promise<SubCategory> {
        const { data } = await api.post('/listings/subcategories', payload);
        return data;
    },

    async updateSubcategory(id: number, payload: Partial<{ name_en: string; name_so: string; slug: string; image_url: string }>): Promise<SubCategory> {
        const { data } = await api.patch(`/listings/subcategories/${id}`, payload);
        return data;
    },

    async deleteSubcategory(id: number): Promise<void> {
        await api.delete(`/listings/subcategories/${id}`);
    },

    async createSubsubcategory(payload: { name_en: string; name_so?: string; slug: string; subcategory_id: number; image_url?: string }): Promise<SubSubCategory> {
        const { data } = await api.post('/listings/subsubcategories', payload);
        return data;
    },

    async updateSubsubcategory(id: number, payload: Partial<{ name_en: string; name_so: string; slug: string; image_url: string }>): Promise<SubSubCategory> {
        const { data } = await api.patch(`/listings/subsubcategories/${id}`, payload);
        return data;
    },

    async deleteSubsubcategory(id: number): Promise<void> {
        await api.delete(`/listings/subsubcategories/${id}`);
    },

    // Marketing codes (distinct from promotion/voucher codes)
    async getMarketingCodes(): Promise<MarketingCode[]> {
        const { data } = await api.get<MarketingCode[]>('/marketing/codes');
        return data;
    },

    async createMarketingCode(payload: { code: string; description: string; created_by?: string; max_uses?: number; expires_at?: string }): Promise<MarketingCode> {
        const { data } = await api.post<MarketingCode>('/marketing/codes', payload);
        return data;
    },

    async updateMarketingCode(id: number, payload: Partial<{ description: string; max_uses: number; is_active: boolean; expires_at: string }>): Promise<MarketingCode> {
        const { data } = await api.patch<MarketingCode>(`/marketing/codes/${id}`, payload);
        return data;
    },

    async deactivateMarketingCode(id: number): Promise<{ success: boolean }> {
        const { data } = await api.delete(`/marketing/codes/${id}`);
        return data;
    },

    // Audit log
    async getAuditLogs(params?: { limit?: number; action?: string; resource_type?: string }): Promise<AuditLogEntry[]> {
        const { data } = await api.get<AuditLogEntry[]>('/audit/logs', { params });
        return data;
    },

    // OTP & verification support tools
    async lookupOtp(params: { phone?: string; email?: string }): Promise<OtpLookupResult> {
        const { data } = await api.get<OtpLookupResult>('/admin/otps', { params });
        return data;
    },

    async getOtpLogs(params?: { identifier?: string; event_type?: string; channel?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }): Promise<{ total: number; results: OtpLogEntry[] }> {
        const { data } = await api.get('/admin/otp-logs', { params });
        return data;
    },

    async getVerificationAttempts(identifier: string): Promise<VerificationAttemptsResult> {
        const { data } = await api.get<VerificationAttemptsResult>('/admin/verification-attempts', { params: { identifier } });
        return data;
    },

    // CRM & email campaigns
    async getEmailAnalytics(): Promise<EmailAnalytics> {
        const { data } = await api.get<EmailAnalytics>('/admin/email/analytics');
        return data;
    },

    async sendManualEmail(payload: { email: string; subject: string; title: string; subtitle?: string; content_html: string; action_text?: string; action_url?: string; campaign_id?: string }): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post('/admin/email/send-manual', payload);
        return data;
    },

    async sendBroadcastEmail(payload: { subject: string; title: string; subtitle?: string; content_html: string; action_text?: string; action_url?: string; campaign_id?: string }): Promise<{ success: boolean; message: string }> {
        const { data } = await api.post('/admin/email/broadcast', payload);
        return data;
    },
};
