import api from './api';

export interface OrderItem {
    product_id: string;
    quantity: number;
    price: number;
    title: string;
}

export interface OrderPayload {
    items: OrderItem[];
    delivery_option: 'delivery' | 'pickup';
    delivery_address?: string;
    scheduled_time?: string;
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
    status: 'pending' | 'payment_pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'in_delivery' | 'delivered' | 'cancelled';
    items: OrderItem[];
    total_amount: number;
    platform_fee: number;
    seller_amount: number;
    delivery_option: 'delivery' | 'pickup';
    delivery_address?: string;
    phone_number: string;
    payment_status: 'pending' | 'completed' | 'failed' | 'pending_at_delivery' | 'awaiting_payment';
    payment_method?: string;
    created_at: string;
    updated_at: string;
}

export const orderService = {
    // Create order
    async createOrder(payload: OrderPayload): Promise<Order> {
        const response = await api.post('/orders', payload);
        return response.data;
    },

    // Get orders
    async getOrders(filters?: { status?: string; limit?: number }): Promise<Order[]> {
        const response = await api.get('/orders', { params: filters });
        return response.data;
    },

    // Get single order
    async getOrder(orderId: string): Promise<Order> {
        const response = await api.get(`/orders/${orderId}`);
        return response.data;
    },

    // Update order status
    async updateOrderStatus(orderId: string, status: Order['status']): Promise<Order> {
        const response = await api.patch(`/orders/${orderId}`, { status });
        return response.data;
    },

    // Cancel order
    async cancelOrder(orderId: string, reason?: string): Promise<Order> {
        const response = await api.post(`/orders/${orderId}/cancel`, { reason });
        return response.data;
    },

    // Rate delivery
    async rateDelivery(orderId: string, rating: number, comment?: string): Promise<any> {
        const response = await api.post(`/orders/${orderId}/rate-delivery`, { rating, comment });
        return response.data;
    },

    // Report issue
    async reportIssue(orderId: string, data: {
        issue_type: 'item_mismatch' | 'damaged' | 'missing_items' | 'other';
        description: string;
        images?: string[];
    }): Promise<any> {
        const response = await api.post(`/orders/${orderId}/report-issue`, data);
        return response.data;
    },

    // Get issue details
    async getIssue(issueId: string): Promise<any> {
        const response = await api.get(`/issues/${issueId}`);
        return response.data;
    },

    // Request refund/replacement
    async requestResolution(issueId: string, resolution_type: 'refund' | 'replacement'): Promise<any> {
        const response = await api.post(`/issues/${issueId}/request-resolution`, { resolution_type });
        return response.data;
    },
};
