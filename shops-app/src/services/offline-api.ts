import api from './api';
import { capacitorCache } from './capacitor-cache';
import { offlineManager } from './offline-manager';

interface CachedResponse {
  data: any;
  timestamp: number;
}

class OfflineAPI {
  private cache: Map<string, CachedResponse> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  async get<T = any>(url: string, options?: any): Promise<T> {
    const cacheKey = `GET:${url}`;

    try {
      // If online, fetch fresh data
      if (offlineManager.getStatus()) {
        const response = await api.get<T>(url, options);
        // Cache successful response
        this.cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        return response.data;
      }
    } catch (error: any) {
      console.log(`API error for ${url}:`, error.message);
      // Fall through to cache
    }

    // Return cached data if offline or request failed
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(`Returning cached data for ${url}`);
      return cached.data;
    }

    // No cache available
    throw new Error('Offline: No cached data available');
  }

  async post<T = any>(url: string, data?: any, options?: any): Promise<T> {
    if (!offlineManager.getStatus()) {
      throw new Error('Offline: Cannot make POST requests without internet');
    }

    const response = await api.post<T>(url, data, options);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, options?: any): Promise<T> {
    if (!offlineManager.getStatus()) {
      throw new Error('Offline: Cannot make PUT requests without internet');
    }

    const response = await api.put<T>(url, data, options);
    return response.data;
  }

  async delete<T = any>(url: string, options?: any): Promise<T> {
    if (!offlineManager.getStatus()) {
      throw new Error('Offline: Cannot make DELETE requests without internet');
    }

    const response = await api.delete<T>(url, options);
    return response.data;
  }

  // Pre-cache critical data for offline access
  async preCache() {
    const critical = [
      '/admin/categories/',
      '/admin/markets/',
    ];

    for (const url of critical) {
      try {
        await this.get(url);
      } catch (error) {
        console.log(`Failed to pre-cache ${url}`);
      }
    }
  }

  // Clear cache
  clearCache(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Clear specific pattern
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const offlineApi = new OfflineAPI();
