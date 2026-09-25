import api from './api';

// Types
export interface AvailableDelivery {
    order_id: string;
    distance_km: number;
    delivery_fee: number;
    items_count: number;
    pickup_location: string;
    delivery_address: string;
    customer_rating: number;
    total_amount: number;
    created_at: string;
}

export interface DashboardStats {
    today_earnings: number;
    deliveries_this_week: number;
    average_rating: number;
    completion_rate_percent: number;
    total_deliveries: number;
    next_delivery: {
        delivery_id: string;
        order_id: string;
        status: string;
        destination: string;
        created_at: string;
    } | null;
    availability_status: string;
}

export interface DeliveryHistory {
    delivery_id: string;
    order_id: string;
    pickup_location: string;
    delivery_location: string;
    earnings: number;
    rating: string | number;
    status: string;
    completed_at: string;
    items_count: number;
}

export interface EarningsData {
    period: string;
    start_date: string;
    end_date: string;
    total_earned: number;
    total_deliveries: number;
    breakdown: Array<{
        date?: string;
        week?: string;
        month?: string;
        base_fee: number;
        distance_bonus: number;
        speed_bonus: number;
        rating_bonus: number;
        total: number;
        deliveries: number;
    }>;
}

export interface PerformanceMetrics {
    completion_rate_percent: number;
    average_rating: number;
    response_time_avg_minutes: number;
    on_time_delivery_percent: number;
    total_deliveries: number;
    completed_deliveries: number;
    rating_breakdown: {
        '5_star': number;
        '4_star': number;
        '3_star': number;
        '2_star': number;
        '1_star': number;
    };
    total_ratings_received: number;
}

export interface WithdrawalRequest {
    withdrawal_id: string;
    amount: number;
    method: 'mpesa' | 'bank';
    status: 'pending' | 'completed' | 'rejected';
    requested_date: string;
    completed_date: string | null;
    transaction_id: string | null;
    reason_rejected: string | null;
}

export interface RiderProfile {
    id: string;
    user_id: string;
    phone: string;
    vehicle_type: string;
    vehicle_plate: string;
    is_verified: boolean;
    is_active: boolean;
    current_lat: number;
    current_lng: number;
    bank_account: string;
    bank_name: string;
    mpesa_number: string;
    mpesa_verified: boolean;
    availability_status: string;
    total_deliveries: number;
    avg_rating: number;
    response_time_avg: number;
    document_expiry: string | null;
    created_at: string;
}

// Service
export const riderService = {
    // ===== Dashboard & Available Deliveries =====
    getAvailableDeliveries: async (
        maxDistance: number = 50,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        total: number;
        page: number;
        limit: number;
        deliveries: AvailableDelivery[];
    }> => {
        const response = await api.get('/riders/me/available-deliveries', {
            params: { max_distance: maxDistance, page, limit }
        });
        return response.data;
    },

    getDashboard: async (): Promise<DashboardStats> => {
        const response = await api.get('/riders/me/dashboard');
        return response.data;
    },

    // ===== Delivery Workflow =====
    confirmPickup: async (assignmentId: string): Promise<any> => {
        const response = await api.post(`/riders/assignments/${assignmentId}/confirm-pickup`);
        return response.data;
    },

    startDelivery: async (assignmentId: string): Promise<any> => {
        const response = await api.post(`/riders/assignments/${assignmentId}/start-delivery`);
        return response.data;
    },

    completeDelivery: async (
        assignmentId: string,
        proofPhotoUrl: string
    ): Promise<any> => {
        const response = await api.post(
            `/riders/assignments/${assignmentId}/complete-delivery`,
            { proof_photo_url: proofPhotoUrl }
        );
        return response.data;
    },

    uploadProofOfDelivery: async (
        assignmentId: string,
        proofPhotoUrl: string
    ): Promise<any> => {
        const response = await api.post(
            `/riders/assignments/${assignmentId}/upload-proof-of-delivery`,
            { proof_photo_url: proofPhotoUrl }
        );
        return response.data;
    },

    // ===== Earnings & Performance =====
    getEarnings: async (
        period: 'daily' | 'weekly' | 'monthly' = 'daily',
        startDate?: string,
        endDate?: string
    ): Promise<EarningsData> => {
        const response = await api.get('/riders/me/earnings', {
            params: {
                period,
                start_date: startDate,
                end_date: endDate
            }
        });
        return response.data;
    },

    getPerformance: async (): Promise<PerformanceMetrics> => {
        const response = await api.get('/riders/me/performance');
        return response.data;
    },

    getDeliveryHistory: async (
        page: number = 1,
        limit: number = 20,
        status?: string,
        startDate?: string
    ): Promise<{
        total: number;
        page: number;
        limit: number;
        history: DeliveryHistory[];
    }> => {
        const response = await api.get('/riders/me/delivery-history', {
            params: {
                page,
                limit,
                status,
                start_date: startDate
            }
        });
        return response.data;
    },

    // ===== Withdrawals =====
    requestWithdrawal: async (
        amount: number,
        method: 'mpesa' | 'bank' = 'mpesa'
    ): Promise<any> => {
        const response = await api.post('/riders/me/withdrawals', {
            amount,
            method
        });
        return response.data;
    },

    getWithdrawalHistory: async (
        page: number = 1,
        limit: number = 20
    ): Promise<{
        total: number;
        page: number;
        limit: number;
        available_balance: number;
        total_earned: number;
        withdrawals: WithdrawalRequest[];
    }> => {
        const response = await api.get('/riders/me/withdrawals', {
            params: { page, limit }
        });
        return response.data;
    },

    // ===== Profile =====
    getProfile: async (): Promise<RiderProfile> => {
        const response = await api.get('/riders/me/profile');
        return response.data;
    },

    updateProfile: async (profileData: Partial<RiderProfile>): Promise<RiderProfile> => {
        const response = await api.patch('/riders/me/profile', profileData);
        return response.data;
    },

    updateLocation: async (latitude: number, longitude: number): Promise<any> => {
        const response = await api.post('/riders/me/location', {
            latitude,
            longitude
        });
        return response.data;
    },

    // ===== Ratings =====
    rateCustomer: async (
        assignmentId: string,
        rating: number,
        review?: string
    ): Promise<any> => {
        const response = await api.post(
            `/riders/${assignmentId}/rate-customer`,
            {
                rating,
                review_text: review
            }
        );
        return response.data;
    },

    // ===== Sprint 4: Messaging & Documents =====
    getMessages: async (
        page: number = 1,
        limit: number = 50
    ): Promise<{
        total: number;
        page: number;
        limit: number;
        conversations: any[];
    }> => {
        const response = await api.get('/riders/me/messages', {
            params: { page, limit }
        });
        return response.data;
    },

    sendMessage: async (messageData: {
        recipient_id: string;
        message: string;
    }): Promise<any> => {
        const response = await api.post('/riders/me/messages', messageData);
        return response.data;
    },

    getDocumentsExpiry: async (): Promise<any> => {
        const response = await api.get('/riders/me/documents-expiry');
        return response.data;
    }
};
