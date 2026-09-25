import { Preferences } from '@capacitor/preferences';

const CACHE_KEYS = {
  JWT_TOKEN: 'jwt_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_PROFILE: 'user_profile',
  RECENT_LISTINGS: 'recent_listings',
  FAVORITE_LISTINGS: 'favorite_listings',
  APP_SETTINGS: 'app_settings',
  SAVED_ADDRESSES: 'saved_addresses',
  CATEGORIES: 'categories',
  MARKETS: 'markets',
};

export const capacitorCache = {
  // JWT Token Management
  async setJWT(token: string, refreshToken?: string) {
    await Preferences.set({ key: CACHE_KEYS.JWT_TOKEN, value: token });
    if (refreshToken) {
      await Preferences.set({ key: CACHE_KEYS.REFRESH_TOKEN, value: refreshToken });
    }
  },

  async getJWT() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.JWT_TOKEN });
    return value || null;
  },

  async getRefreshToken() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.REFRESH_TOKEN });
    return value || null;
  },

  async clearJWT() {
    await Preferences.remove({ key: CACHE_KEYS.JWT_TOKEN });
    await Preferences.remove({ key: CACHE_KEYS.REFRESH_TOKEN });
  },

  // User Profile
  async setUserProfile(profile: any) {
    await Preferences.set({
      key: CACHE_KEYS.USER_PROFILE,
      value: JSON.stringify(profile),
    });
  },

  async getUserProfile() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.USER_PROFILE });
    return value ? JSON.parse(value) : null;
  },

  // Recent Listings
  async setRecentListings(listings: any[]) {
    await Preferences.set({
      key: CACHE_KEYS.RECENT_LISTINGS,
      value: JSON.stringify(listings),
    });
  },

  async getRecentListings() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.RECENT_LISTINGS });
    return value ? JSON.parse(value) : [];
  },

  // Favorites
  async setFavoriteListings(listings: any[]) {
    await Preferences.set({
      key: CACHE_KEYS.FAVORITE_LISTINGS,
      value: JSON.stringify(listings),
    });
  },

  async getFavoriteListings() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.FAVORITE_LISTINGS });
    return value ? JSON.parse(value) : [];
  },

  // App Settings
  async setAppSettings(settings: any) {
    await Preferences.set({
      key: CACHE_KEYS.APP_SETTINGS,
      value: JSON.stringify(settings),
    });
  },

  async getAppSettings() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.APP_SETTINGS });
    return value ? JSON.parse(value) : {};
  },

  // Saved Addresses
  async setSavedAddresses(addresses: any[]) {
    await Preferences.set({
      key: CACHE_KEYS.SAVED_ADDRESSES,
      value: JSON.stringify(addresses),
    });
  },

  async getSavedAddresses() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.SAVED_ADDRESSES });
    return value ? JSON.parse(value) : [];
  },

  // Categories
  async setCategories(categories: any[]) {
    await Preferences.set({
      key: CACHE_KEYS.CATEGORIES,
      value: JSON.stringify(categories),
    });
  },

  async getCategories() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.CATEGORIES });
    return value ? JSON.parse(value) : [];
  },

  // Markets
  async setMarkets(markets: any[]) {
    await Preferences.set({
      key: CACHE_KEYS.MARKETS,
      value: JSON.stringify(markets),
    });
  },

  async getMarkets() {
    const { value } = await Preferences.get({ key: CACHE_KEYS.MARKETS });
    return value ? JSON.parse(value) : [];
  },

  // Clear all cache
  async clearAll() {
    await Preferences.clear();
  },

  // Get last sync timestamp
  async getLastSync(key: string) {
    const { value } = await Preferences.get({ key: `${key}_timestamp` });
    return value ? parseInt(value, 10) : null;
  },

  async setLastSync(key: string) {
    await Preferences.set({
      key: `${key}_timestamp`,
      value: Date.now().toString(),
    });
  },

  // Check if cache is stale (older than 24 hours)
  async isCacheStale(key: string, maxAge: number = 86400000) {
    const lastSync = await this.getLastSync(key);
    if (!lastSync) return true;
    return Date.now() - lastSync > maxAge;
  },
};
