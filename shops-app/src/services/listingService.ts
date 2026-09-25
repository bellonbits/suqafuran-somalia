import api from './api';

export interface Listing {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  status: string;
  views: number;
  created_at: string;
  owner_id: number;
  owner_name: string;
}

export interface Category {
  id: number;
  name_en: string;
  name_so?: string;
  slug: string;
  icon_name: string;
  image_url?: string;
}

export const listingService = {
  // Get Listings
  async getListings(params?: { category?: string; search?: string; limit?: number; skip?: number }) {
    const response = await api.get('/listings', { params });
    return response.data;
  },

  // Get Single Listing
  async getListing(id: number) {
    const response = await api.get(`/listings/${id}`);
    return response.data;
  },

  // Create Listing
  async createListing(data: any) {
    const response = await api.post('/listings', data);
    return response.data;
  },

  // Update Listing
  async updateListing(id: number, data: any) {
    const response = await api.patch(`/listings/${id}`, data);
    return response.data;
  },

  // Delete Listing
  async deleteListing(id: number) {
    await api.delete(`/listings/${id}`);
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await api.get('/listings/categories');
    return response.data;
  },

  async getCategory(id: number): Promise<Category> {
    const response = await api.get(`/listings/categories/${id}`);
    return response.data;
  },

  // Search
  async searchListings(query: string, params?: any) {
    const response = await api.get('/listings/search', { params: { q: query, ...params } });
    return response.data;
  },

  // Featured
  async getFeaturedListings() {
    const response = await api.get('/listings/featured');
    return response.data;
  }
};
