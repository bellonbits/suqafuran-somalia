import { listingsService } from '@/services/listings';

/**
 * Props for a link to a category page that start loading its products the
 * moment intent shows (hover, touch, keyboard focus), so the page usually
 * opens with its data already cached.
 */
export function categoryPrefetchProps(slug: string) {
    const warm = () => listingsService.prefetchCategory(slug);
    return { onMouseEnter: warm, onTouchStart: warm, onFocus: warm };
}
