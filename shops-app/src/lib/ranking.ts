import { Listing } from '@/types';
import { advertisingService } from '@/services/advertising';

/**
 * Calculate ranking score for a listing
 * Featured listings get a +10000 boost
 */
export async function calculateListingScore(listing: Listing): Promise<number> {
  let score = 0;

  // Base score from views
  score += listing.views || 0;

  // Recency bonus
  if (listing.created_at) {
    const ageInDays = (Date.now() - new Date(listing.created_at).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 100 - ageInDays); // Decay over 100 days
  }

  // Featured product boost
  const isFeatured = await advertisingService.isListingFeatured(listing.id);
  if (isFeatured) {
    score += 10000;
  }

  return score;
}

/**
 * Sort listings by ranking score
 * Featured products appear first
 */
export async function sortByRanking(listings: Listing[]): Promise<Listing[]> {
  // Check featured status for all listings
  const featuredMap = new Map<number, boolean>();
  await Promise.all(
    listings.map(async (listing) => {
      const isFeatured = await advertisingService.isListingFeatured(listing.id);
      featuredMap.set(listing.id, isFeatured);
    })
  );

  // Sort: featured first, then by views
  return [...listings].sort((a, b) => {
    const aFeatured = featuredMap.get(a.id) || false;
    const bFeatured = featuredMap.get(b.id) || false;

    // Featured listings come first
    if (aFeatured && !bFeatured) return -1;
    if (!aFeatured && bFeatured) return 1;

    // If both are featured or both aren't, sort by views
    return (b.views || 0) - (a.views || 0);
  });
}

/**
 * Simple synchronous sorting without featured check
 * Use this when you already have featured status from elsewhere
 */
export function sortByViewsAndCreatedAt(listings: Listing[]): Listing[] {
  return [...listings].sort((a, b) => {
    // By views (descending)
    const viewDiff = (b.views || 0) - (a.views || 0);
    if (viewDiff !== 0) return viewDiff;

    // By creation date (newest first)
    const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bDate - aDate;
  });
}
