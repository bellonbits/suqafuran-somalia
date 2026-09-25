import api from './api';

export interface DeliveryLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
}

export interface RiderInfo {
  id: string;
  name: string;
  phone: string;
}

export interface DeliveryStatus {
  order_id: string;
  status: string;
  rider: RiderInfo;
  current_location?: DeliveryLocation;
  pickup_location: {
    lat: number;
    lng: number;
  };
  delivery_location: {
    lat: number;
    lng: number;
  };
  timeline: {
    accepted_at?: string;
    started_at?: string;
    completed_at?: string;
  };
  last_updated: string;
}

export interface DeliveryHistory {
  status: string;
  timestamp: string;
  message: string;
}

export const deliveryTrackingService = {
  // Accept a delivery assignment
  async acceptDelivery(orderId: string) {
    const response = await api.post(`/api/v1/deliveries/accept/${orderId}`);
    return response.data;
  },

  // Update delivery status
  async updateDeliveryStatus(orderId: string, status: string, notes?: string) {
    const response = await api.post(`/api/v1/deliveries/status/${orderId}`, {
      status,
      notes,
    });
    return response.data;
  },

  // Post rider's current location
  async updateLocation(
    orderId: string,
    latitude: number,
    longitude: number,
    accuracy?: number
  ) {
    const response = await api.post(`/api/v1/deliveries/location/${orderId}`, {
      order_id: orderId,
      latitude,
      longitude,
      accuracy,
    });
    return response.data;
  },

  // Get delivery location and status
  async getDeliveryLocation(orderId: string): Promise<DeliveryStatus> {
    const response = await api.get(`/api/v1/deliveries/${orderId}/location`);
    return response.data;
  },

  // Get delivery history
  async getDeliveryHistory(orderId: string): Promise<{ order_id: string; status: string; history: DeliveryHistory[]; current_location?: DeliveryLocation }> {
    const response = await api.get(`/api/v1/deliveries/${orderId}/history`);
    return response.data;
  },

  // Complete delivery
  async completeDelivery(orderId: string, completionData?: any) {
    const response = await api.post(`/api/v1/deliveries/${orderId}/complete`, completionData || {});
    return response.data;
  },

  // Poll for live location updates (for customer tracking)
  setupLocationPolling(
    orderId: string,
    onLocationUpdate: (location: DeliveryStatus) => void,
    interval: number = 5000 // 5 seconds
  ): any {
    return setInterval(async () => {
      try {
        const status = await this.getDeliveryLocation(orderId);
        onLocationUpdate(status);
      } catch (error) {
        console.error('Error fetching delivery location:', error);
      }
    }, interval);
  },

  // Stop polling
  stopLocationPolling(pollerId: any) {
    clearInterval(pollerId);
  },
};
