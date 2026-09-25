import { resolveMediaUrl } from '../services/api';
import type { Listing } from '../types';

export interface PreviewItem {
    image: string;
    title: string;
    price: number;
    currency: string;
}

export interface DerivedStore {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    distance?: string;
    isVerified: boolean;
    responseTime?: string;
    previewItems: PreviewItem[];
    listingCount: number;
}

/**
 * Groups listings by owner into store cards. There's no dedicated "list all
 * stores" backend endpoint for plain P2P sellers (only registered Businesses
 * have one), so every store-listing surface in this app derives sellers from
 * a batch of listings the same way — kept here once instead of re-duplicated
 * per page.
 */
export function deriveStoresFromListings(listings: Listing[]): DerivedStore[] {
    const map = new Map<number, DerivedStore>();

    listings.forEach((l) => {
        if (!l.owner) return;
        const item: PreviewItem | null = l.images?.[0]
            ? { image: l.images[0], title: l.title_en, price: l?.price ?? 0, currency: l.currency }
            : null;

        const existing = map.get(l.owner_id);
        if (existing) {
            if (existing.previewItems.length < 6 && item) {
                existing.previewItems.push(item);
            }
            existing.listingCount += 1;
            return;
        }
        map.set(l.owner_id, {
            id: l.owner_id.toString(),
            slug: l.owner_id.toString(),
            name: l.owner.full_name || 'Local Seller',
            image: resolveMediaUrl(l.owner.avatar_url),
            distance: l.location ? l.location.split(',')[0] : undefined,
            isVerified: l.owner.is_verified || false,
            responseTime: l.owner.trust_level,
            previewItems: item ? [item] : [],
            listingCount: 1,
        });
    });

    return Array.from(map.values());
}
