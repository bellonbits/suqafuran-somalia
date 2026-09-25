"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SfInput, SfIconSearch, SfIconClose } from '@storefront-ui/react';
import { PackageSearch } from 'lucide-react';
import { listingsService } from '@/services/listings';
import { analyticsService } from '@/services/analytics';
import { trackEvent } from '@/lib/analytics';
import { useLocalizedField } from '@/lib/i18n';
import {
    ListingCard,
    FilterPanel,
    FilterSection,
    FilterLinkList,
    FilterCheckboxList,
    PriceRangeFilter,
    SortBar,
    ViewToggle,
    MobileFilterSheet,
    MobileFilterButton,
    Pagination,
} from '@/components/storefront';
import type { FilterOption } from '@/components/storefront';
import type { Listing, Category } from '@/types';

const PAGE_SIZE = 20;
// The listings endpoint has no total count or sorting, so we pull one large
// batch for the query/category and do price/condition/location/sort/paging
// client-side over it.
const FETCH_LIMIT = 200;

// Param names match what HomePage's FilterDrawer and HomeFilterBar already
// send, so links from the homepage land here pre-filtered.
const SORT_OPTIONS: FilterOption[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Popular' },
];

// Rounds the slider ceiling up to a friendly number (e.g. 1,370 → 1,500).
function niceCeil(n: number): number {
    if (n <= 10) return 10;
    const mag = 10 ** Math.floor(Math.log10(n));
    const step = mag / 2;
    return Math.ceil(n / step) * step;
}

function countBy(items: Listing[], key: (l: Listing) => string | undefined): FilterOption[] {
    const counts = new Map<string, number>();
    for (const l of items) {
        const k = key(l)?.trim();
        if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([value, count]) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1), count }));
}

function SearchPageContent() {
    const [params, setParams] = useSearchParams();
    const field = useLocalizedField();

    // URL is the source of truth for every filter, so results are shareable
    // and the back button steps through filter changes.
    const query = params.get('q') || '';
    const categoryParam = params.get('category');
    const conditions = params.get('condition')?.split(',').filter(Boolean) ?? [];
    const locations = params.get('location')?.split(',').filter(Boolean) ?? [];
    const priceMinParam = params.get('price_min');
    const priceMaxParam = params.get('price_max');
    const sort = params.get('sort') || 'newest';
    const page = Math.max(1, Number(params.get('page')) || 1);

    const [listings, setListings] = useState<Listing[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [searchInput, setSearchInput] = useState(query);

    const update = (changes: Record<string, string | null>, resetPage = true) => {
        setParams(prev => {
            const next = new URLSearchParams(prev);
            for (const [k, v] of Object.entries(changes)) {
                if (v === null || v === '') next.delete(k);
                else next.set(k, v);
            }
            if (resetPage) next.delete('page');
            return next;
        }, { replace: true });
    };

    // Keep the box in sync when the query changes from elsewhere (header search).
    useEffect(() => setSearchInput(query), [query]);

    // Debounce typing into the URL.
    useEffect(() => {
        if (searchInput === query) return;
        const timer = setTimeout(() => update({ q: searchInput.trim() || null }), 400);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    useEffect(() => {
        listingsService.getCategories().then(c => setCategories(c || [])).catch(() => {});
    }, []);

    // Category param may be an id or a slug (links from category pages use slugs).
    const selectedCategory = useMemo(
        () => categoryParam
            ? categories.find(c => String(c.id) === categoryParam || c.slug === categoryParam) ?? null
            : null,
        [categories, categoryParam]
    );

    useEffect(() => {
        let cancelled = false;
        const fetchListings = async () => {
            setIsLoading(true);
            try {
                // The backend does full-text matching across title/description
                // and category names, and accepts a category id or slug.
                const data = await listingsService.getListings({
                    q: query || undefined,
                    category_id: categoryParam || undefined,
                    limit: FETCH_LIMIT,
                });
                if (cancelled) return;
                setListings(data);

                if (query) {
                    analyticsService.trackSearch({
                        query,
                        result_count: data.length,
                        device_type: analyticsService.getDeviceType(),
                    }).catch(() => {});
                    trackEvent('Search', { query, result_count: data.length });
                }
            } catch (err) {
                console.error('Failed to search listings', err);
                if (!cancelled) setListings([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };
        fetchListings();
        return () => { cancelled = true; };
    }, [query, categoryParam]);

    // ── Derived filter options (counts reflect the current query/category) ──
    const priceCeiling = useMemo(
        () => niceCeil(Math.max(0, ...listings.map(l => l.price ?? 0))),
        [listings]
    );
    const priceMin = Math.min(Number(priceMinParam) || 0, priceCeiling);
    const priceMax = priceMaxParam ? Math.min(Number(priceMaxParam), priceCeiling) : priceCeiling;

    const conditionOptions = useMemo(() => countBy(listings, l => l.condition?.toLowerCase()), [listings]);
    const locationOptions = useMemo(() => countBy(listings, l => l.location), [listings]);

    const categoryOptions: FilterOption[] = useMemo(
        () => categories
            .filter(c => ((c as any).active_listing_count ?? 1) > 0)
            .sort((a, b) => ((b as any).active_listing_count ?? 0) - ((a as any).active_listing_count ?? 0))
            .map(c => ({
                value: String(c.id),
                label: field(c.name_en, c.name_so) || c.name_en,
                count: (c as any).active_listing_count,
            })),
        [categories, field]
    );

    // ── Apply client-side filters + sort ──
    const filtered = useMemo(() => {
        let results = listings.filter(l => {
            const price = l.price ?? 0;
            if (price < priceMin) return false;
            if (priceMaxParam && price > priceMax) return false;
            if (conditions.length && !conditions.includes(l.condition?.toLowerCase())) return false;
            // Substring match so a region from the homepage drawer ("Mogadishu")
            // also matches fuller locations ("Hodan, Mogadishu").
            if (locations.length && !locations.some(loc => l.location?.toLowerCase().includes(loc.toLowerCase()))) return false;
            return true;
        });
        if (sort === 'price_asc') results = [...results].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        else if (sort === 'price_desc') results = [...results].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        else if (sort === 'popular') results = [...results].sort((a, b) => (b.views || 0) - (a.views || 0));
        else if (sort === 'newest') results = [...results].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return results;
        // conditions/locations are re-derived from the URL each render; key on the raw params.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listings, priceMin, priceMax, priceMaxParam, params.get('condition'), params.get('location'), sort]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const rangeStart = filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

    const activeCount = [
        selectedCategory,
        conditions.length,
        locations.length,
        priceMinParam || priceMaxParam,
    ].filter(Boolean).length;

    const clearAll = () => update({ category: null, condition: null, location: null, price_min: null, price_max: null });

    const goToPage = (pg: number) => {
        update({ page: pg > 1 ? String(pg) : null }, false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const categoryNameById = useMemo(
        () => Object.fromEntries(categories.map(c => [c.id, field(c.name_en, c.name_so) || c.name_en])),
        [categories, field]
    );

    const filters = (
        <FilterPanel activeCount={activeCount} onClear={clearAll}>
            <FilterSection title="Price Range">
                <PriceRangeFilter
                    min={0}
                    max={priceCeiling}
                    value={[priceMin, priceMax]}
                    step={priceCeiling > 1000 ? 10 : 1}
                    onChange={([lo, hi]) => update({
                        price_min: lo > 0 ? String(lo) : null,
                        price_max: hi < priceCeiling ? String(hi) : null,
                    })}
                />
            </FilterSection>

            <FilterSection title="Category">
                <FilterLinkList
                    options={categoryOptions}
                    value={selectedCategory ? String(selectedCategory.id) : null}
                    onChange={v => update({ category: v })}
                    allLabel="All Products"
                />
            </FilterSection>

            {conditionOptions.length > 0 && (
                <FilterSection title="Condition">
                    <FilterCheckboxList
                        options={conditionOptions}
                        values={conditions}
                        onChange={v => update({ condition: v.join(',') || null })}
                    />
                </FilterSection>
            )}

            {locationOptions.length > 0 && (
                <FilterSection title="Location">
                    <FilterCheckboxList
                        options={locationOptions}
                        values={locations}
                        onChange={v => update({ location: v.join(',') || null })}
                    />
                </FilterSection>
            )}
        </FilterPanel>
    );

    const title = query
        ? `Results for "${query}"`
        : selectedCategory ? categoryNameById[selectedCategory.id] : 'All Products';

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
            <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight mb-6 truncate">{title}</h1>

                <div className="flex gap-6 lg:gap-8 items-start">
                    {/* ── Sidebar (desktop) ─────────────────────────────── */}
                    <aside className="hidden lg:block w-72 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto hide-scrollbar rounded-2xl">
                        {filters}
                    </aside>

                    <MobileFilterSheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} resultCount={filtered.length}>
                        {filters}
                    </MobileFilterSheet>

                    {/* ── Results ─────────────────────────────────────────── */}
                    <div className="flex-1 min-w-0">
                        {/* Toolbar */}
                        <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-5">
                            <div className="flex items-center gap-2 xl:w-80 shrink-0">
                                <MobileFilterButton onClick={() => setMobileFiltersOpen(true)} activeCount={activeCount} />
                                <SfInput
                                    value={searchInput}
                                    onChange={e => setSearchInput(e.target.value)}
                                    placeholder="Search products..."
                                    aria-label="Search products"
                                    wrapperClassName="flex-1 !rounded-full !bg-white dark:!bg-neutral-950 !ring-gray-200 dark:!ring-neutral-800 hover:!ring-orange-400 focus-within:!ring-2 focus-within:!ring-orange-500"
                                    className="!bg-transparent !text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                                    slotPrefix={<SfIconSearch size="sm" className="text-gray-400" />}
                                    slotSuffix={searchInput ? (
                                        <button type="button" onClick={() => setSearchInput('')} aria-label="Clear search" className="flex text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200">
                                            <SfIconClose size="sm" />
                                        </button>
                                    ) : undefined}
                                />
                            </div>

                            <p className="text-sm text-gray-500 dark:text-neutral-400 xl:flex-1 whitespace-nowrap">
                                {isLoading ? 'Searching…' : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} results`}
                            </p>

                            <div className="flex items-center justify-between gap-3">
                                <SortBar options={SORT_OPTIONS} value={sort} onChange={v => update({ sort: v === 'newest' ? null : v })} withPrice />
                                <ViewToggle value={viewMode} onChange={setViewMode} />
                            </div>
                        </div>

                        {/* Results */}
                        {isLoading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="animate-pulse space-y-3 bg-white dark:bg-neutral-950 rounded-2xl p-3">
                                        <div className="aspect-square rounded-xl bg-gray-200 dark:bg-neutral-900" />
                                        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-neutral-900" />
                                        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-neutral-900" />
                                    </div>
                                ))}
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-20 bg-white dark:bg-neutral-950 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800">
                                <PackageSearch className="w-10 h-10 text-orange-500 mx-auto mb-3" />
                                <p className="text-lg font-bold text-gray-900 dark:text-white">No products found</p>
                                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Try a different search or remove some filters.</p>
                                {activeCount > 0 && (
                                    <button type="button" onClick={clearAll} className="mt-4 text-sm font-semibold text-orange-600 hover:underline">
                                        Clear all filters
                                    </button>
                                )}
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                                {pageItems.map((listing, i) => (
                                    <ListingCard
                                        key={listing.id}
                                        listing={listing}
                                        categoryName={categoryNameById[listing.category_id]}
                                        delay={i * 0.02}
                                        priority={i < 4}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {pageItems.map((listing, i) => (
                                    <ListingCard
                                        key={listing.id}
                                        listing={listing}
                                        categoryName={categoryNameById[listing.category_id]}
                                        layout="horizontal"
                                        delay={i * 0.02}
                                    />
                                ))}
                            </div>
                        )}

                        <Pagination page={currentPage} totalPages={totalPages} onChange={goToPage} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-12">Loading Search Results...</div>}>
            <SearchPageContent />
        </Suspense>
    );
}
