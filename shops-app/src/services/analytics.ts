/**Analytics service for tracking user engagement with items and shops.*/

import api from './api';

interface TrackItemViewParams {
  listing_id: number;
  time_spent_seconds?: number;
  device_type?: string;
  referrer?: string;
}

interface TrackShopViewParams {
  shop_owner_id: number;
  time_spent_seconds?: number;
  device_type?: string;
  referrer?: string;
}

class AnalyticsService {
  async trackItemView(params: TrackItemViewParams) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('listing_id', params.listing_id.toString());
      if (params.time_spent_seconds) {
        queryParams.append('time_spent_seconds', params.time_spent_seconds.toString());
      }
      if (params.device_type) {
        queryParams.append('device_type', params.device_type);
      }
      if (params.referrer) {
        queryParams.append('referrer', params.referrer);
      }

      return await api.post(`/analytics/track/item-view?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track item view:', error);
    }
  }

  async trackShopView(params: TrackShopViewParams) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('shop_owner_id', params.shop_owner_id.toString());
      if (params.time_spent_seconds) {
        queryParams.append('time_spent_seconds', params.time_spent_seconds.toString());
      }
      if (params.device_type) {
        queryParams.append('device_type', params.device_type);
      }
      if (params.referrer) {
        queryParams.append('referrer', params.referrer);
      }

      return await api.post(`/analytics/track/shop-view?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track shop view:', error);
    }
  }

  async getTopItems(days = 7, limit = 20) {
    try {
      return await api.get(`/analytics/admin/top-items?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch top items:', error);
      throw error;
    }
  }

  async getTopShops(days = 7, limit = 20) {
    try {
      return await api.get(`/analytics/admin/top-shops?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch top shops:', error);
      throw error;
    }
  }

  async getLiveViews(minutes = 5) {
    try {
      return await api.get(`/analytics/admin/live-views?minutes=${minutes}`);
    } catch (error) {
      console.error('Failed to fetch live views:', error);
      throw error;
    }
  }

  async getItemStats(listingId: number, days = 30) {
    try {
      return await api.get(`/analytics/admin/item-stats/${listingId}?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch item stats:', error);
      throw error;
    }
  }

  async getShopStats(shopOwnerId: number, days = 30) {
    try {
      return await api.get(`/analytics/admin/shop-stats/${shopOwnerId}?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch shop stats:', error);
      throw error;
    }
  }

  getDeviceType(): string {
    if (typeof window !== 'undefined') {
      const width = window.innerWidth;
      if (width < 768) return 'mobile';
      if (width < 1024) return 'tablet';
      return 'desktop';
    }
    return 'unknown';
  }

  async trackSearch(params: { query: string; result_count?: number; device_type?: string; category_filter?: string; location_filter?: string }) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('query', params.query);
      if (params.result_count) queryParams.append('result_count', params.result_count.toString());
      if (params.device_type) queryParams.append('device_type', params.device_type);
      if (params.category_filter) queryParams.append('category_filter', params.category_filter);
      if (params.location_filter) queryParams.append('location_filter', params.location_filter);

      return await api.post(`/analytics/track/search?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track search:', error);
    }
  }

  async trackClick(params: { event_type: string; listing_id?: number; shop_id?: number; device_type?: string }) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('event_type', params.event_type);
      if (params.listing_id) queryParams.append('listing_id', params.listing_id.toString());
      if (params.shop_id) queryParams.append('shop_id', params.shop_id.toString());
      if (params.device_type) queryParams.append('device_type', params.device_type);

      return await api.post(`/analytics/track/click?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }

  async trackConversion(params: { stage: string; listing_id?: number; shop_id?: number; device_type?: string }) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('stage', params.stage);
      if (params.listing_id) queryParams.append('listing_id', params.listing_id.toString());
      if (params.shop_id) queryParams.append('shop_id', params.shop_id.toString());
      if (params.device_type) queryParams.append('device_type', params.device_type);

      return await api.post(`/analytics/track/conversion?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track conversion:', error);
    }
  }

  async getOverview(days = 7) {
    try {
      return await api.get(`/analytics/admin/overview?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch overview:', error);
      throw error;
    }
  }

  async getSearchAnalytics(days = 7, limit = 20) {
    try {
      return await api.get(`/analytics/admin/search-analytics?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch search analytics:', error);
      throw error;
    }
  }

  async getCategoryAnalytics(days = 7, limit = 20) {
    try {
      return await api.get(`/analytics/admin/category-analytics?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch category analytics:', error);
      throw error;
    }
  }

  async getConversionFunnel(days = 7) {
    try {
      return await api.get(`/analytics/admin/conversion-funnel?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch conversion funnel:', error);
      throw error;
    }
  }

  async getCommunicationOverview(days = 7) {
    try {
      return await api.get(`/analytics/admin/communication-overview?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch communication overview:', error);
      throw error;
    }
  }

  async getSellerResponseAnalytics(days = 30, limit = 20) {
    try {
      return await api.get(`/analytics/admin/seller-response-analytics?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch seller response analytics:', error);
      throw error;
    }
  }

  async getSalesAttribution(days = 30) {
    try {
      return await api.get(`/analytics/admin/sales-attribution?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch sales attribution:', error);
      throw error;
    }
  }

  async getHotListings(days = 1, limit = 6) {
    try {
      return await api.get(`/analytics/admin/hot-listings?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch hot listings:', error);
      throw error;
    }
  }

  async getGeographicAnalytics(days = 7, limit = 20) {
    try {
      return await api.get(`/analytics/admin/geographic-analytics?days=${days}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch geographic analytics:', error);
      throw error;
    }
  }

  async getUserAnalytics(days = 7) {
    try {
      return await api.get(`/analytics/admin/user-analytics?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
      throw error;
    }
  }

  async getListingStats(listingId: number, days = 30) {
    try {
      return await api.get(`/analytics/admin/listing-stats/${listingId}?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch listing stats:', error);
      throw error;
    }
  }

  async trackGeographic(city: string, country: string, lat: number, lng: number, eventType: string) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('city', city);
      queryParams.append('country', country);
      queryParams.append('latitude', lat.toString());
      queryParams.append('longitude', lng.toString());
      queryParams.append('event_type', eventType);
      queryParams.append('device_type', this.getDeviceType());

      return await api.post(`/analytics/track/geographic?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track geographic:', error);
    }
  }

  async trackUserCohort(isNew: boolean) {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('is_new', isNew.toString());

      return await api.post(`/analytics/track/user-cohort?${queryParams.toString()}`);
    } catch (error) {
      console.error('Failed to track user cohort:', error);
    }
  }

  async getDeviceAnalytics(days = 7) {
    try {
      return await api.get(`/analytics/admin/device-analytics?days=${days}`);
    } catch (error) {
      console.error('Failed to fetch device analytics:', error);
      throw error;
    }
  }

  async getSellerRankings(days = 30, metric = "views", limit = 20) {
    try {
      return await api.get(`/analytics/admin/seller-rankings?days=${days}&metric=${metric}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch seller rankings:', error);
      throw error;
    }
  }

  async getAlerts() {
    try {
      return await api.get(`/analytics/admin/alerts`);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
      throw error;
    }
  }

  async getAlertEvents(status = "triggered", limit = 50) {
    try {
      return await api.get(`/analytics/admin/alert-events?status=${status}&limit=${limit}`);
    } catch (error) {
      console.error('Failed to fetch alert events:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertEventId: string) {
    try {
      return await api.post(`/analytics/admin/alert/${alertEventId}/acknowledge`);
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }
}

export const analyticsService = new AnalyticsService();
