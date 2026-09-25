/**
 * Seller Analytics Service
 * Tracks events for seller dashboard analytics (shop visits, product views, contact interactions)
 */

import api from './api';

type EventType =
  | 'shop_visit'
  | 'product_view'
  | 'product_click'
  | 'whatsapp_click'
  | 'call_click'
  | 'message_click'
  | 'follow_shop';

interface TrackEventOptions {
  listing_id?: number;
  source?: 'search' | 'category' | 'homepage' | 'direct';
  search_query?: string;
}

class SellerAnalyticsService {
  /**
   * Track an event for seller analytics dashboard
   * Public endpoint - can be called without authentication
   */
  async trackEvent(
    eventType: EventType,
    sellerId: number,
    options?: TrackEventOptions
  ): Promise<void> {
    try {
      const params = new URLSearchParams({
        event_type: eventType,
        seller_id: sellerId.toString(),
      });

      if (options?.listing_id) {
        params.append('listing_id', options.listing_id.toString());
      }
      if (options?.source) {
        params.append('source', options.source);
      }
      if (options?.search_query) {
        params.append('search_query', options.search_query);
      }

      await api.post(`/analytics/track?${params.toString()}`);
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.error('Failed to track seller event:', error);
    }
  }

  /**
   * Track shop visit
   */
  async trackShopVisit(sellerId: number, source: 'search' | 'category' | 'homepage' | 'direct' = 'direct'): Promise<void> {
    return this.trackEvent('shop_visit', sellerId, { source });
  }

  /**
   * Track product view
   */
  async trackProductView(sellerId: number, listingId: number, source: 'search' | 'category' | 'homepage' | 'direct' = 'direct'): Promise<void> {
    return this.trackEvent('product_view', sellerId, { listing_id: listingId, source });
  }

  /**
   * Track product click (when product card is clicked)
   */
  async trackProductClick(sellerId: number, listingId: number): Promise<void> {
    return this.trackEvent('product_click', sellerId, { listing_id: listingId });
  }

  /**
   * Track WhatsApp contact click
   */
  async trackWhatsAppClick(sellerId: number, listingId?: number): Promise<void> {
    return this.trackEvent('whatsapp_click', sellerId, { listing_id: listingId });
  }

  /**
   * Track phone call click
   */
  async trackCallClick(sellerId: number, listingId?: number): Promise<void> {
    return this.trackEvent('call_click', sellerId, { listing_id: listingId });
  }

  /**
   * Track message/inbox click
   */
  async trackMessageClick(sellerId: number, listingId?: number): Promise<void> {
    return this.trackEvent('message_click', sellerId, { listing_id: listingId });
  }

  /**
   * Track follow shop
   */
  async trackFollowShop(sellerId: number): Promise<void> {
    return this.trackEvent('follow_shop', sellerId);
  }

  /**
   * Get seller analytics summary (requires authentication)
   */
  async getAnalyticsSummary(sellerId: number, days: number = 30): Promise<any> {
    try {
      const response = await api.get(`/analytics/sellers/${sellerId}/summary?days=${days}`);
      return response.data?.metrics || response.data;
    } catch (error) {
      console.error('Failed to fetch analytics summary:', error);
      throw error;
    }
  }

  /**
   * Get daily metrics breakdown (requires authentication)
   */
  async getDailyMetrics(sellerId: number, days: number = 30): Promise<any> {
    try {
      const response = await api.get(`/analytics/sellers/${sellerId}/daily?days=${days}`);
      return response.data?.daily_metrics || response.data;
    } catch (error) {
      console.error('Failed to fetch daily metrics:', error);
      throw error;
    }
  }

  /**
   * Get product-specific metrics (requires authentication)
   */
  async getProductMetrics(sellerId: number, listingId: number, days: number = 30): Promise<any> {
    try {
      const response = await api.get(`/analytics/sellers/${sellerId}/products/${listingId}?days=${days}`);
      return response.data?.product_metrics || response.data;
    } catch (error) {
      console.error('Failed to fetch product metrics:', error);
      throw error;
    }
  }

  /**
   * Get purchase-confirmation counts (pending/confirmed/denied) for this
   * seller's own dashboard (requires authentication)
   */
  async getDealsSummary(sellerId: number, days: number = 30): Promise<{ pending: number; confirmed: number; denied: number }> {
    try {
      const response = await api.get(`/analytics/sellers/${sellerId}/deals-summary?days=${days}`);
      return response.data?.deals_summary || { pending: 0, confirmed: 0, denied: 0 };
    } catch (error) {
      console.error('Failed to fetch deals summary:', error);
      throw error;
    }
  }
}

export const sellerAnalyticsService = new SellerAnalyticsService();
export default sellerAnalyticsService;
