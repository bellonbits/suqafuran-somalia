import api from './api';

export interface SellerProfile {
    id: string;
    shop_name: string;
    owner_name: string;
    email: string;
    phone: string;
    mpesa_number: string;
    mpesa_verified: boolean;
    shop_location: {
        latitude: number;
        longitude: number;
    };
    shop_address: string;
    category: string;
    verification_status: 'pending' | 'verified' | 'rejected';
    verification_documents?: string[];
    is_active: boolean;
    created_at: string;
}

export interface SellerOrder {
    id: string;
    customer_name: string;
    items: Array<{
        product_id: string;
        title: string;
        quantity: number;
        price: number;
    }>;
    total_amount: number;
    seller_amount: number;
    delivery_option: 'delivery' | 'pickup';
    status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
    payment_status: 'pending' | 'received' | 'failed';
    customer_phone: string;
    created_at: string;
}

export const sellerService = {
    // Get seller profile
    async getSellerProfile(): Promise<SellerProfile> {
        const response = await api.get('/sellers/me');
        return response.data;
    },

    // Update seller profile
    async updateSellerProfile(data: Partial<SellerProfile>): Promise<SellerProfile> {
        const response = await api.patch('/sellers/me', data);
        return response.data;
    },

    // Register as seller
    async registerSeller(data: {
        shop_name: string;
        owner_name: string;
        email: string;
        phone: string;
        mpesa_number: string;
        shop_address: string;
        category: string;
        location: { latitude: number; longitude: number };
    }): Promise<SellerProfile> {
        const response = await api.post('/sellers/register', data);
        return response.data;
    },

    // Verify M-Pesa number
    async verifyMPesaNumber(mpesaNumber: string): Promise<{ verified: boolean; message: string }> {
        const response = await api.post('/sellers/verify-mpesa', { mpesa_number: mpesaNumber });
        return response.data;
    },

    // Upload verification documents
    async uploadVerificationDocuments(files: File[]): Promise<{ message: string; document_urls: string[] }> {
        const formData = new FormData();
        files.forEach((file) => formData.append('documents', file));
        const response = await api.post('/sellers/me/verification-documents', formData);
        return response.data;
    },

    // Get seller orders
    async getSellerOrders(filters?: { status?: string; limit?: number }): Promise<SellerOrder[]> {
        const response = await api.get('/sellers/me/orders', { params: filters });
        return response.data;
    },

    // Get seller order details
    async getSellerOrder(orderId: string): Promise<SellerOrder> {
        const response = await api.get(`/sellers/me/orders/${orderId}`);
        return response.data;
    },

    // Update order status
    async updateOrderStatus(orderId: string, status: SellerOrder['status']): Promise<SellerOrder> {
        const response = await api.patch(`/sellers/me/orders/${orderId}`, { status });
        return response.data;
    },

    // Confirm payment received
    async confirmPaymentReceived(orderId: string): Promise<{ message: string; mpesa_ref: string }> {
        const response = await api.post(`/sellers/me/orders/${orderId}/confirm-payment`, {});
        return response.data;
    },

    // Get seller earnings
    async getEarnings(period?: 'daily' | 'weekly' | 'monthly'): Promise<{
        total_earnings: number;
        platform_fees: number;
        net_earnings: number;
        transactions: Array<{ date: string; amount: number; order_id: string }>;
    }> {
        const response = await api.get('/sellers/me/earnings', { params: { period } });
        return response.data;
    },

    // Get withdrawal history
    async getWithdrawals(): Promise<Array<{ id: string; amount: number; status: string; date: string }>> {
        const response = await api.get('/sellers/me/withdrawals');
        return response.data;
    },

    // Request withdrawal
    async requestWithdrawal(amount: number): Promise<{ id: string; status: string; message: string }> {
        const response = await api.post('/sellers/me/withdrawals', { amount });
        return response.data;
    },
};
