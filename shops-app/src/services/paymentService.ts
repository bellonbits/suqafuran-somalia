import api from './api';

export interface MPesaPaymentRequest {
    phone_number: string;
    amount: number;
    order_id: string;
    account_reference: string;
    transaction_description: string;
}

export interface PaymentResponse {
    success: boolean;
    merchant_request_id: string;
    checkout_request_id: string;
    response_code: string;
    response_description: string;
    customer_message: string;
}

export interface PaymentStatus {
    order_id: string;
    status: 'pending' | 'completed' | 'failed';
    amount: number;
    mpesa_reference?: string;
    payment_method: 'mpesa';
    created_at: string;
    updated_at: string;
}

export interface PaymentSplit {
    order_id: string;
    total_amount: number;
    seller_amount: number;
    platform_fee: number;
    courier_tip: number;
    seller_mpesa: string;
    seller_payment_status: 'pending' | 'sent' | 'completed';
    transaction_reference?: string;
}

export const paymentService = {
    // Initiate M-Pesa payment
    async initiateMPesaPayment(payload: MPesaPaymentRequest): Promise<PaymentResponse> {
        const response = await api.post('/payments/mpesa/initiate', payload);
        return response.data;
    },

    // Check payment status
    async checkPaymentStatus(orderId: string): Promise<PaymentStatus> {
        const response = await api.get(`/payments/${orderId}/status`);
        return response.data;
    },

    // Get payment history
    async getPaymentHistory(limit?: number): Promise<PaymentStatus[]> {
        const response = await api.get('/payments/history', { params: { limit } });
        return response.data;
    },

    // Process payment split (for backend integration)
    async processPaymentSplit(orderId: string): Promise<PaymentSplit> {
        const response = await api.post(`/payments/${orderId}/split`, {});
        return response.data;
    },

    // Confirm seller payment
    async confirmSellerPayment(orderId: string): Promise<{ message: string; mpesa_ref: string }> {
        const response = await api.post(`/payments/${orderId}/confirm-seller`, {});
        return response.data;
    },

    // Handle M-Pesa webhook
    async handleMPesaCallback(data: any): Promise<{ success: boolean; message: string }> {
        const response = await api.post('/payments/mpesa/callback', data);
        return response.data;
    },

    // Refund payment
    async refundPayment(orderId: string, amount?: number): Promise<{ success: boolean; refund_reference: string }> {
        const response = await api.post(`/payments/${orderId}/refund`, { amount });
        return response.data;
    },
};
