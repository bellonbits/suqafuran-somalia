import api from './api';
import type { Listing, Category } from '../types';

// Utility function to deduplicate items by ID
function deduplicateById<T extends { id: number | string }>(items: T[]): T[] {
    const seen = new Set<number | string>();
    return items.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

/**
 * Generates a clean, URL-safe shop slug from a shop/business name.
 * Mirrors the backend logic: lowercase, alphanumeric chars only.
 * e.g. "Moon Glow Cosmetics" → "moonglowcosmetics"
 *      "Al-Amin First Floor"  → "alaminFirstfloor" ... wait, no:
 *      strip non-alnum → "alamin1stfloor"... use only [a-z0-9]
 */
export function makeShopSlug(name: string, fallbackId?: string | number): string {
    if (!name) return fallbackId ? `shop${fallbackId}` : '';
    // Normalize unicode (strip accents etc.), lowercase, keep only [a-z0-9]
    const clean = name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritic marks
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    return clean || (fallbackId ? `shop${fallbackId}` : name.toLowerCase().replace(/\s+/g, ''));
}

export interface PublicShop {
    id: string;
    user_id: string;
    shop_name: string;
    owner_name: string;
    category: string;
    shop_address: string;
    location_lat: number;
    location_lng: number;
    rating: number;
    is_verified: boolean;
    listing_count: number;
    category_ids: number[];
    cover_image: string | null;
    shop_page_banner: string | null;  // Cloudinary URL for shop card banner
    logo_url?: string | null;  // Shop logo/avatar image
    owner_avatar_url?: string | null;  // Owner profile picture
    slug: string;
    created_at: string | null;
    market?: string;  // Somali market location (e.g., "Bakaara Market")
    response_time?: string;
    is_featured?: boolean;
    free_delivery?: boolean;
    phone?: string;  // Seller phone number
    user?: {
        id: string;
        avatar_url?: string;
    };
}

// Requests currently on the wire, keyed like the localStorage cache. A second
// caller asking for the same listings (React StrictMode's double effect, a
// hover prefetch racing the click) joins the first request instead of
// starting another one against the API.
const inFlightListings = new Map<string, Promise<Listing[]>>();
let categoriesInFlight: Promise<Category[]> | null = null;

export const listingsService = {
    getListings(params?: any): Promise<Listing[]> {
        const key = `listings:${JSON.stringify(params ?? {})}`;
        const pending = inFlightListings.get(key);
        if (pending) return pending;
        const request = listingsService.fetchListings(params).finally(() => inFlightListings.delete(key));
        inFlightListings.set(key, request);
        return request;
    },

    /** Params a category page requests -- shared so a prefetch warms exactly that cache entry. */
    categoryPageParams(slug: string) {
        return { category_id: slug, limit: 60 };
    },

    /** Fire-and-forget warm-up for a category page (hover / touch on a category link). */
    prefetchCategory(slug: string) {
        if (!slug) return;
        listingsService.getListings(listingsService.categoryPageParams(slug)).catch(() => {});
    },

    async fetchListings(params?: any): Promise<Listing[]> {
        // Cache key covers every param (not a hand-picked subset) -- a subset
        // previously missed category_id, so two different-category calls with
        // the same limit/skip collided into the same cached result.
        const cacheKey = `listings:${JSON.stringify(params ?? {})}`;

        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    // Return cached data if less than 5 minutes old
                    if (data.timestamp && Date.now() - data.timestamp < 300000) {
                        return data.value;
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        const response = await api.get('/listings/', { params });

        // Deduplicate listings by ID
        const dedupedData = deduplicateById(response.data);

        // Cache the result
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    value: dedupedData,
                    timestamp: Date.now(),
                }));
            } catch (e) {
                // Ignore storage quota errors
            }
        }

        return dedupedData;
    },

    async getListing(id: number | string): Promise<Listing> {
        const cacheKey = `listing:${id}`;
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    if (data.timestamp && Date.now() - data.timestamp < 300000) {
                        // Return fast cache, revalidate in background
                        api.get(`/listings/${id}`).then(res => {
                            localStorage.setItem(cacheKey, JSON.stringify({ value: res.data, timestamp: Date.now() }));
                        }).catch(() => {});
                        return data.value;
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        const response = await api.get(`/listings/${id}`);
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({ value: response.data, timestamp: Date.now() }));
            } catch (e) {}
        }
        return response.data;
    },

    async createListing(data: any): Promise<Listing> {
        const response = await api.post('/listings/', data);
        return response.data;
    },

    getCategories(): Promise<Category[]> {
        // Large payload -- share one in-flight request between callers.
        categoriesInFlight ??= listingsService.fetchCategories().finally(() => { categoriesInFlight = null; });
        return categoriesInFlight;
    },

    async fetchCategories(): Promise<Category[]> {
        // Cache categories - they change rarely
        const cacheKey = 'listings:categories';

        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    // Return cached data if less than 1 hour old
                    if (data.timestamp && Date.now() - data.timestamp < 3600000) {
                        return data.value;
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        const response = await api.get('/listings/categories');

        // Cache the result
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    value: response.data,
                    timestamp: Date.now(),
                }));
            } catch (e) {
                // Ignore storage quota errors
            }
        }

        return response.data;
    },

    async getShops(params?: {
        skip?: number;
        limit?: number;
        search?: string;
        category_id?: number;
        shop_id?: string;
    }): Promise<{ total: number; shops: PublicShop[] }> {
        // Cache key for shops list - only cache when no search
        if (!params?.search && !params?.shop_id && typeof window !== 'undefined') {
            const cacheKey = `shops:${params?.skip || 0}:${params?.limit || 50}:${params?.category_id || 'all'}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    // Return cached data if less than 10 minutes old
                    if (data.timestamp && Date.now() - data.timestamp < 600000) {
                        return data.value;
                    }
                } catch (e) {
                    localStorage.removeItem(cacheKey);
                }
            }
        }

        const response = await api.get('/listings/shops', { params });

        // Deduplicate shops by user_id to prevent showing same shop twice
        const seenUsers = new Set<string>();
        const dedupedShops = (response.data.shops || []).filter((shop: PublicShop) => {
            if (seenUsers.has(shop.user_id)) return false;
            seenUsers.add(shop.user_id);
            return true;
        });

        const dedupedData = {
            ...response.data,
            shops: dedupedShops
        };

        // Cache the result (only non-search queries)
        if (!params?.search && !params?.shop_id && typeof window !== 'undefined') {
            try {
                const cacheKey = `shops:${params?.skip || 0}:${params?.limit || 50}:${params?.category_id || 'all'}`;
                localStorage.setItem(cacheKey, JSON.stringify({
                    value: dedupedData,
                    timestamp: Date.now(),
                }));
            } catch (e) {
                // Ignore storage quota errors
            }
        }

        return dedupedData;
    },

    async getTrendingListings(): Promise<Listing[]> {
        const response = await api.get('/listings/', { params: { sort: 'trending', limit: 8 } });
        return response.data;
    },

    async getCategoryAttributes(slug: string): Promise<any> {
        const response = await api.get(`/listings/categories/${slug}/attributes`);
        return response.data;
    },

    async getSubcategoryAttributes(id: number | string): Promise<any> {
        const response = await api.get(`/listings/subcategories/${id}/attributes`);
        return response.data;
    },

    async getSubsubcategoryAttributes(id: number | string): Promise<any> {
        const response = await api.get(`/listings/subsubcategories/${id}/attributes`);
        return response.data;
    },

    async getSubcategories(categoryId: number): Promise<any[]> {
        const categories = await this.getCategories();
        const category = categories.find(c => c.id === categoryId);
        return category?.subcategories || [];
    },

    async getAllSubcategories(): Promise<any[]> {
        const categories = await this.getCategories();
        return categories.flatMap(c => c.subcategories || []);
    },

    async getSubsubcategories(subcategoryId: number): Promise<any[]> {
        const categories = await this.getCategories();
        for (const category of categories) {
            for (const subcategory of category.subcategories || []) {
                if (subcategory.id === subcategoryId) {
                    return subcategory.subsubcategories || [];
                }
            }
        }
        return [];
    },

    async getAllSubsubcategories(): Promise<any[]> {
        const categories = await this.getCategories();
        return categories.flatMap(c =>
            (c.subcategories || []).flatMap(s => s.subsubcategories || [])
        );
    },

    async uploadImage(file: File): Promise<{ filename: string; url: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.post('/listings/upload/', formData);
        return response.data;
    },
};

