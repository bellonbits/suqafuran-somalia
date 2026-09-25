import api from './api';
import type { Business, BusinessProduct, Order, ChatMessage } from '../types';

export const businessService = {
    async registerBusiness(params: {
        name: string;
        slug: string;
        category: string;
        description?: string;
        address?: string;
        phone?: string;
        email?: string;
    }): Promise<Business> {
        const { data } = await api.post<Business>('/businesses/', null, { params });
        return data;
    },

    async getMyBusinesses(): Promise<Business[]> {
        const { data } = await api.get<Business[]>('/businesses/my-businesses');
        return data;
    },

    async getBusiness(businessId: string): Promise<Business> {
        const { data } = await api.get<Business>(`/businesses/${businessId}`);
        return data;
    },

    async updateBusiness(businessId: string, updateData: Partial<Business>): Promise<Business> {
        const { data } = await api.put<Business>(`/businesses/${businessId}`, updateData);
        return data;
    },

    // Products & Inventory
    async getProducts(businessId: string): Promise<BusinessProduct[]> {
        const { data } = await api.get<BusinessProduct[]>(`/businesses/${businessId}/products`);
        return data;
    },

    async addProduct(businessId: string, productData: {
        name_en: string;
        price: number;
        stock_level?: number;
        description_en?: string;
        sku?: string;
    }): Promise<BusinessProduct> {
        // The backend declares these as plain function params (query string), not a body model.
        const { data } = await api.post<BusinessProduct>(`/businesses/${businessId}/products`, null, { params: productData });
        return data;
    },

    async updateProduct(businessId: string, productId: number, updateData: Partial<BusinessProduct>): Promise<BusinessProduct> {
        const { data } = await api.put<BusinessProduct>(`/businesses/${businessId}/products/${productId}`, updateData);
        return data;
    },

    // Orders
    async getOrders(businessId: string): Promise<Order[]> {
        const { data } = await api.get<Order[]>(`/businesses/${businessId}/orders`);
        return data;
    },

    async recordOrder(businessId: string, orderData: {
        customer_id: number;
        items: any[];
        total_amount: number;
        payment_method?: string;
        notes?: string;
    }): Promise<Order> {
        const { data } = await api.post<Order>(`/businesses/${businessId}/orders`, orderData);
        return data;
    },

    async updateOrder(businessId: string, orderId: number, updateData: { status: string }): Promise<Order> {
        // `status` is a plain function param on the backend (query string), not a body model.
        const { data } = await api.put<Order>(`/businesses/${businessId}/orders/${orderId}`, null, { params: updateData });
        return data;
    },

    async getOrder(businessId: string, orderId: number): Promise<Order> {
        // Open to the buyer who placed the order OR a seller-side employee —
        // unlike the list/update endpoints above, which are seller-only.
        const { data } = await api.get<Order>(`/businesses/${businessId}/orders/${orderId}/view`);
        return data;
    },

    // Tasks CRM
    async getTasks(businessId: string): Promise<any[]> {
        const { data } = await api.get<any[]>(`/businesses/${businessId}/tasks`);
        return data;
    },

    async createTask(businessId: string, taskData: any): Promise<any> {
        const { data } = await api.post<any>(`/businesses/${businessId}/tasks`, taskData);
        return data;
    },

    async updateTask(businessId: string, taskId: number, updateData: any): Promise<any> {
        const { data } = await api.put<any>(`/businesses/${businessId}/tasks/${taskId}`, updateData);
        return data;
    },

    // Customer Messages & Real-time Chat history
    async getCustomerChatHistory(businessId: string, customerId: number): Promise<ChatMessage[]> {
        const { data } = await api.get<ChatMessage[]>(`/businesses/${businessId}/messages/customer/${customerId}`);
        return data;
    },

    async sendCustomerChatMessage(businessId: string, customerId: number, content: string): Promise<ChatMessage> {
        const { data } = await api.post<ChatMessage>(`/businesses/${businessId}/messages/customer/${customerId}`, {
            content
        });
        return data;
    },

    // Analytics
    async getAnalytics(businessId: string): Promise<any> {
        const { data } = await api.get<any>(`/businesses/${businessId}/analytics`);
        return data;
    },

    // Public storefronts
    async getPublicShop(slug: string): Promise<{ business: Business; products: BusinessProduct[]; listings: any[]; owner_avatar_url?: string }> {
        const { data } = await api.get<{ business: Business; products: BusinessProduct[]; listings: any[]; owner_avatar_url?: string }>(`/businesses/public/${slug}`);
        return data;
    },

    async getNearbyShops(params?: {
        lat?: number;
        lng?: number;
        category?: string;
        limit?: number;
    }): Promise<(Business & { distance_km?: number })[]> {
        const { data } = await api.get<(Business & { distance_km?: number })[]>('/businesses/nearby', { params });
        return data;
    },
};
