/**
 * Analytics Tracking Service
 * Tracks user interactions, clicks, page views, and more
 */

import api from './api';
import { useAuthStore } from '@/store/useAuth';

interface ClickEventData {
  element_id?: string;
  element_class?: string;
  element_type: string;
  text?: string;
  x: number;
  y: number;
  page_url: string;
  page_width: number;
  page_height: number;
}

interface ActivityEventData {
  action_type: string;
  action_category: string;
  resource_id?: string;
  page_url: string;
  search_query?: string;
}

class AnalyticsTracker {
  private enabled = true;
  private sessionToken: string = '';
  private pageViewTimeout: NodeJS.Timeout | null = null;
  private pageStartTime: number = 0;
  private maxScrollDepth: number = 0;
  private scrollCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSession();
    this.setupClickTracking();
    this.setupPageTracking();
    this.setupScrollTracking();
    this.setupTimeTracking();
  }

  /**
   * Initialize session tracking
   */
  private initializeSession() {
    // Generate or retrieve session token
    const storedToken = localStorage.getItem('analytics_session_token');
    if (storedToken) {
      this.sessionToken = storedToken;
    } else {
      this.sessionToken = this.generateSessionToken();
      localStorage.setItem('analytics_session_token', this.sessionToken);
    }
  }

  /**
   * Generate unique session token
   */
  private generateSessionToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup global click event tracking
   */
  private setupClickTracking() {
    if (!this.enabled) return;

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Get element info
      const elementId = target.id || '';
      const elementClass = target.className || '';
      const elementType = target.tagName.toLowerCase();
      const text = target.textContent?.substring(0, 50) || '';

      // Get click position
      const x = e.clientX;
      const y = e.clientY;
      const pageUrl = window.location.pathname;
      const pageWidth = window.innerWidth;
      const pageHeight = window.innerHeight;

      // Track click
      this.trackClick({
        element_id: elementId,
        element_class: elementClass,
        element_type: elementType,
        text: text,
        x,
        y,
        page_url: pageUrl,
        page_width: pageWidth,
        page_height: pageHeight,
      });
    });
  }

  /**
   * Setup scroll depth tracking
   */
  private setupScrollTracking() {
    if (!this.enabled) return;

    window.addEventListener('scroll', () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const scrollPercentage = (window.scrollY / scrollHeight) * 100;
        this.maxScrollDepth = Math.max(this.maxScrollDepth, scrollPercentage);
      }
    });
  }

  /**
   * Setup time on page tracking
   */
  private setupTimeTracking() {
    if (!this.enabled) return;

    this.pageStartTime = Date.now();

    // Track time on page every 30 seconds
    setInterval(() => {
      const timeOnPage = (Date.now() - this.pageStartTime) / 1000; // seconds
      if (timeOnPage > 30) {
        this.trackMetric('time_on_page', {
          seconds: Math.floor(timeOnPage),
          scroll_depth: this.maxScrollDepth,
        });
      }
    }, 30000);

    // Track on page leave
    window.addEventListener('beforeunload', () => {
      const timeOnPage = (Date.now() - this.pageStartTime) / 1000;
      this.trackMetric('page_exit', {
        seconds: Math.floor(timeOnPage),
        scroll_depth: this.maxScrollDepth,
      });
    });
  }

  /**
   * Track page view
   */
  private setupPageTracking() {
    if (!this.enabled) return;

    // Track initial page view
    this.trackPageView();

    // Reset metrics on page change
    const resetMetrics = () => {
      this.maxScrollDepth = 0;
      this.pageStartTime = Date.now();
    };

    // Track page changes (for SPA)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(this, args);
      resetMetrics();
      setTimeout(() => this.trackPageView(), 100);
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      resetMetrics();
      setTimeout(() => this.trackPageView(), 100);
    };
  }

  /**
   * Track a click event
   */
  async trackClick(event: ClickEventData) {
    if (!this.enabled) return;

    try {
      // Batch clicks - send in background without blocking
      navigator.sendBeacon?.(
        '/api/v1/analytics/track/click',
        JSON.stringify({
          ...event,
          session_token: this.sessionToken,
          user_id: this.getCurrentUserId(),
          timestamp: new Date().toISOString(),
        })
      );
    } catch (err) {
      console.error('Failed to track click:', err);
    }
  }

  /**
   * Track page view
   */
  async trackPageView() {
    if (!this.enabled) return;

    // Debounce page view tracking
    if (this.pageViewTimeout) clearTimeout(this.pageViewTimeout);

    this.pageViewTimeout = setTimeout(() => {
      try {
        const userId = this.getCurrentUserId();
        if (!userId) return; // Only track authenticated users

        api.post('/analytics/track/activity', {
          action_type: 'view_page',
          action_category: 'navigation',
          page_url: window.location.pathname,
          session_token: this.sessionToken,
        }).catch(() => {}); // Silently fail - don't interrupt user experience
      } catch (err) {
        console.error('Failed to track page view:', err);
      }
    }, 1000); // Debounce by 1s
  }

  /**
   * Track search action
   */
  async trackSearch(query: string) {
    if (!this.enabled) return;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      await api.post('/analytics/track/activity', {
        action_type: 'search',
        action_category: 'search',
        search_query: query,
        page_url: window.location.pathname,
        session_token: this.sessionToken,
      });
    } catch (err) {
      console.error('Failed to track search:', err);
    }
  }

  /**
   * Track listing view
   */
  async trackListingView(listingId: string | number) {
    if (!this.enabled) return;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      await api.post('/analytics/track/activity', {
        action_type: 'view_listing',
        action_category: 'listing',
        resource_id: listingId.toString(),
        page_url: window.location.pathname,
        session_token: this.sessionToken,
      });
    } catch (err) {
      console.error('Failed to track listing view:', err);
    }
  }

  /**
   * Track add to cart
   */
  async trackAddToCart(listingId: string | number) {
    if (!this.enabled) return;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      await api.post('/analytics/track/activity', {
        action_type: 'add_to_cart',
        action_category: 'cart',
        resource_id: listingId.toString(),
        page_url: window.location.pathname,
        session_token: this.sessionToken,
      });
    } catch (err) {
      console.error('Failed to track add to cart:', err);
    }
  }

  /**
   * Track purchase
   */
  async trackPurchase(orderId: string | number) {
    if (!this.enabled) return;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      await api.post('/analytics/track/activity', {
        action_type: 'purchase',
        action_category: 'order',
        resource_id: orderId.toString(),
        page_url: window.location.pathname,
        session_token: this.sessionToken,
      });
    } catch (err) {
      console.error('Failed to track purchase:', err);
    }
  }

  /**
   * Get current authenticated user ID
   */
  private getCurrentUserId(): number | null {
    try {
      const user = useAuthStore.getState().user;
      return user?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Track custom metrics
   */
  async trackMetric(metricName: string, data: any) {
    if (!this.enabled) return;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      await api.post('/analytics/track/metric', {
        metric_name: metricName,
        metric_data: JSON.stringify(data),
        page_url: window.location.pathname,
        session_token: this.sessionToken,
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to track metric:', err);
    }
  }

  /**
   * Enable/disable tracking
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}

// Export singleton instance
export const analyticsTracker = new AnalyticsTracker();

// Export for use in components
export default {
  trackSearch: (query: string) => analyticsTracker.trackSearch(query),
  trackListingView: (id: string | number) => analyticsTracker.trackListingView(id),
  trackAddToCart: (id: string | number) => analyticsTracker.trackAddToCart(id),
  trackPurchase: (id: string | number) => analyticsTracker.trackPurchase(id),
  setEnabled: (enabled: boolean) => analyticsTracker.setEnabled(enabled),
};
