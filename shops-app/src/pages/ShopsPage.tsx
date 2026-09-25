"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Store } from 'lucide-react';
import { SfInput, SfChip, SfButton, SfIconSearch, SfIconClose } from '@storefront-ui/react';
import { listingsService, PublicShop } from '@/services/listings';
import api from '@/services/api';
import { MARKET_TO_CITY } from '@/constants/markets';
import { HomepageBannerRotation } from '@/components/ads/HomepageBannerRotation';
import { GlovoShopCard } from '@/components/shared/GlovoShopCard';
import { getCategoryStickerIcon } from '@/lib/categoryIcons';
import {
  FilterPanel,
  FilterSection,
  FilterLinkList,
  FilterCheckboxList,
  RatingFilter,
  SortBar,
  MobileFilterSheet,
  MobileFilterButton,
  Pagination,
} from '@/components/storefront';
import type { FilterOption } from '@/components/storefront';
import { shortCategoryName } from '@/lib/categoryName';

interface Category {
  id: number;
  name_en: string;
  name_so?: string;
  slug: string;
  icon_name?: string;
  image_url?: string;
  active_listing_count?: number;
}

// ─── Skeleton Card ──────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[16/7] w-full bg-gray-200 dark:bg-neutral-900 rounded-lg" />
      <div className="mt-2.5 space-y-1.5 px-0.5">
        <div className="h-3 bg-gray-200 dark:bg-neutral-800 rounded w-3/4" />
        <div className="h-2.5 bg-gray-100 dark:bg-neutral-900 rounded w-2/3" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const SHOPS_PER_PAGE = 20;
// Market, rating, verified and sorting aren't supported by GET /shops, so when
// any of them is on we pull one large batch and filter/sort/page it
// client-side -- otherwise the "of N" total and page count would describe the
// unfiltered set, and a sort would only reorder the current page.
const CLIENT_FILTER_BATCH = 300;

const SORT_OPTIONS: FilterOption[] = [
  { value: 'default', label: 'Featured' },
  { value: 'rating', label: 'Top Rated' },
  { value: 'popular', label: 'Popular' },
  { value: 'newest', label: 'Newest' },
];

const MARKET_OPTIONS: FilterOption[] = Object.keys(MARKET_TO_CITY).sort().map(m => ({ value: m, label: m }));
const VERIFIED_OPTION: FilterOption[] = [{ value: 'verified', label: 'Verified shops only' }];

function sortShops(shops: PublicShop[], sort: string): PublicShop[] {
  if (sort === 'rating') return [...shops].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (sort === 'popular') return [...shops].sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0));
  if (sort === 'newest') return [...shops].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return shops;
}

function ShopsPageContent() {
  const searchParams = useSearchParams();

  const [shops, setShops] = useState<PublicShop[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [shopCountsByCategory, setShopCountsByCategory] = useState<Record<string, number>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const categoryParam = searchParams.get('category');

  const clientFiltering = selectedMarkets.length > 0 || minRating !== null || verifiedOnly || sort !== 'default';

  // Show scroll-to-top button after scrolling 300px
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Change page and scroll to shops grid
  const goToPage = (pg: number) => {
    setPage(pg);
    const shopsSection = document.querySelector('[data-shops-grid]');
    if (shopsSection) {
      shopsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load categories once at startup
  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await listingsService.getCategories();
        setCategories(cats || []);

        // Fetch shop counts per category
        try {
          const countsResponse = await api.get('/listings/categories/stats/shop-counts');
          setShopCountsByCategory(countsResponse.data || {});
        } catch (err) {
          console.warn('Failed to load shop counts:', err);
        }

        // If category param is provided, find matching category ID and select it
        if (categoryParam && cats && cats.length > 0) {
          const categorySlug = decodeURIComponent(categoryParam);
          const matchedCat = cats.find(c =>
            c.slug === categorySlug ||
            c.name_en?.toLowerCase().replace(/\s+/g, '-') === categorySlug.toLowerCase()
          );
          if (matchedCat) {
            setSelectedCategoryId(matchedCat.id);
          }
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    loadCategories();
  }, [categoryParam]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategoryId, selectedMarkets, minRating, verifiedOnly, sort]);

  const fetchShops = useCallback(async (opts?: { silent?: boolean }) => {
    // Clear browser cache to get fresh banners
    if (typeof window !== 'undefined') {
      Object.keys(localStorage).forEach(key => {
        if (key.includes('banner') || key.includes('shop')) {
          localStorage.removeItem(key);
        }
      });
    }
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const result = await listingsService.getShops({
        skip: clientFiltering ? 0 : (page - 1) * SHOPS_PER_PAGE,
        limit: clientFiltering ? CLIENT_FILTER_BATCH : SHOPS_PER_PAGE,
        search: debouncedSearch || undefined,
        category_id: selectedCategoryId || undefined,
      });
      const fetched = result.shops || [];

      if (clientFiltering) {
        const matching = fetched.filter(shop =>
          (selectedMarkets.length === 0 || (shop.market && selectedMarkets.includes(shop.market))) &&
          (minRating === null || (shop.rating ?? 0) >= minRating) &&
          (!verifiedOnly || shop.is_verified)
        );
        setShops(matching);
        setTotal(matching.length);
      } else {
        setShops(fetched);
        setTotal(result.total || fetched.length);
      }
    } catch (err: any) {
      console.error('Failed to fetch shops:', err);
      if (!opts?.silent) {
        setError('Failed to load shops. Please try again.');
        setShops([]);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategoryId, selectedMarkets, minRating, verifiedOnly, clientFiltering]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Live rotation: the backend reshuffles shop order every 10s (see
  // rotation_seed in GET /shops). Poll quietly on the first page so the
  // grid actually reflects that while the page is open, instead of only
  // rotating on a fresh page load. Skipped past page 1 so it doesn't yank
  // items out from under someone actively paging through results, and when
  // an explicit sort is chosen since the rotation would be sorted away anyway.
  useEffect(() => {
    if (page !== 1 || sort !== 'default') return;
    const intervalId = setInterval(() => {
      fetchShops({ silent: true });
    }, 10000);
    return () => clearInterval(intervalId);
  }, [page, sort, fetchShops]);

  // In client-filter mode `shops` holds every match and we page locally;
  // otherwise the server already returned just this page.
  const sortedShops = useMemo(() => sortShops(shops, sort), [shops, sort]);
  const visibleShops = clientFiltering
    ? sortedShops.slice((page - 1) * SHOPS_PER_PAGE, page * SHOPS_PER_PAGE)
    : sortedShops;

  const totalPages = Math.ceil(total / SHOPS_PER_PAGE);
  const rangeStart = total ? (page - 1) * SHOPS_PER_PAGE + 1 : 0;
  const rangeEnd = Math.min(page * SHOPS_PER_PAGE, total);

  // Get all active categories, ordered most-shops-first so the categories
  // buyers are actually browsing surface before niche ones.
  const activeCategories = categories
    .filter(cat => (cat.active_listing_count ?? 0) > 0)
    .sort((a, b) => (shopCountsByCategory[b.id] ?? 0) - (shopCountsByCategory[a.id] ?? 0));

  const categoryOptions: FilterOption[] = activeCategories.map(cat => ({
    value: String(cat.id),
    label: cat.name_en,
    count: shopCountsByCategory[cat.id],
  }));

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const activeFilters = [
    debouncedSearch && { key: 'search', label: `"${debouncedSearch}"`, clear: () => setSearch('') },
    selectedCategory && { key: 'category', label: selectedCategory.name_en, clear: () => setSelectedCategoryId(null) },
    ...selectedMarkets.map(m => ({ key: `market:${m}`, label: m, clear: () => setSelectedMarkets(ms => ms.filter(x => x !== m)) })),
    minRating !== null && { key: 'rating', label: `${minRating}★ & up`, clear: () => setMinRating(null) },
    verifiedOnly && { key: 'verified', label: 'Verified', clear: () => setVerifiedOnly(false) },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCategoryId(null);
    setSelectedMarkets([]);
    setMinRating(null);
    setVerifiedOnly(false);
  };

  // Search text isn't in the sidebar, so it doesn't count toward its badge.
  const sidebarFilterCount = activeFilters.filter(f => f.key !== 'search').length;

  const filters = (
    <FilterPanel
      activeCount={sidebarFilterCount}
      onClear={() => { setSelectedCategoryId(null); setSelectedMarkets([]); setMinRating(null); setVerifiedOnly(false); }}
    >
      <FilterSection title="Category">
        <FilterLinkList
          options={categoryOptions}
          value={selectedCategoryId ? String(selectedCategoryId) : null}
          onChange={v => setSelectedCategoryId(v ? Number(v) : null)}
          allLabel="All Shops"
        />
      </FilterSection>

      <FilterSection title="Markets">
        <FilterCheckboxList options={MARKET_OPTIONS} values={selectedMarkets} onChange={setSelectedMarkets} />
      </FilterSection>

      <FilterSection title="Ratings">
        <RatingFilter value={minRating} onChange={setMinRating} />
      </FilterSection>

      <FilterSection title="Seller">
        <FilterCheckboxList
          options={VERIFIED_OPTION}
          values={verifiedOnly ? ['verified'] : []}
          onChange={v => setVerifiedOnly(v.length > 0)}
        />
      </FilterSection>
    </FilterPanel>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-20">
      {/* ── Hero Banner Carousel ───────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 pt-4 md:pt-6">
        <HomepageBannerRotation />
      </div>

      {/* ── Page Title ─────────────────────────────────────────────────── */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8 pb-4 md:pb-6">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">Shops</h1>
      </div>

      {/* ── Category Stickers (mobile/tablet; the sidebar covers this on desktop) ── */}
      <div className="lg:hidden max-w-[1440px] mx-auto px-4 md:px-6 pb-6">
        <div className="w-full overflow-x-auto overscroll-x-contain hide-scrollbar">
          <div className="flex flex-row flex-nowrap items-start gap-4 pb-2 pt-0 min-w-max">
            {[null, ...activeCategories].map(cat => {
              const isSelected = selectedCategoryId === (cat?.id ?? null);
              return (
                <button
                  type="button"
                  key={cat?.id ?? 'all'}
                  onClick={() => setSelectedCategoryId(cat?.id ?? null)}
                  className="flex flex-col items-center shrink-0 cursor-pointer group"
                  aria-pressed={isSelected}
                >
                  <div className={`relative w-16 h-16 flex items-center justify-center transition-all duration-200 ${isSelected ? 'scale-105' : ''}`}>
                    {/* fork.png circular plate background */}
                    <img src="/icons/fork.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                    <img
                      src={cat ? getCategoryStickerIcon(cat.slug) : '/icons/all-shops.png'}
                      alt=""
                      onError={cat ? undefined : (e) => { (e.target as HTMLImageElement).src = '/icons/shelves.png'; }}
                      className="relative z-10 w-10 h-10 object-contain group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <span title={cat?.name_en} className={`text-[12px] font-bold mt-2 tracking-tight text-center w-20 leading-tight line-clamp-2 [overflow-wrap:anywhere] ${
                    isSelected ? 'text-orange-500' : 'text-gray-700 dark:text-neutral-200'
                  }`}>
                    {cat ? shortCategoryName(cat.name_en) : 'All'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 flex gap-6 lg:gap-8 items-start">
        {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto hide-scrollbar rounded-2xl">
          {filters}
        </aside>

        <MobileFilterSheet open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} resultCount={total}>
          {filters}
        </MobileFilterSheet>

        <div className="flex-1 min-w-0" data-shops-grid>
          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex items-center gap-2 xl:w-80 shrink-0">
              <MobileFilterButton onClick={() => setMobileFiltersOpen(true)} activeCount={sidebarFilterCount} />
              <SfInput
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search shops..."
                aria-label="Search shops"
                wrapperClassName="flex-1 !rounded-full !bg-white dark:!bg-neutral-950 !ring-gray-200 dark:!ring-neutral-800 hover:!ring-orange-400 focus-within:!ring-2 focus-within:!ring-orange-500"
                className="!bg-transparent !text-sm text-gray-900 dark:text-white placeholder:text-gray-400"
                slotPrefix={<SfIconSearch size="sm" className="text-gray-400" />}
                slotSuffix={search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="flex text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200"
                  >
                    <SfIconClose size="sm" />
                  </button>
                ) : undefined}
              />
            </div>

            <p className="text-sm text-gray-500 dark:text-neutral-400 xl:flex-1 whitespace-nowrap">
              {loading ? 'Loading shops…' : `Showing ${rangeStart}–${rangeEnd} of ${total} shops`}
            </p>

            <SortBar options={SORT_OPTIONS} value={sort} onChange={setSort} />
          </div>

          {/* Active filters - tap a chip to remove that filter */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {activeFilters.map(f => (
                <SfChip
                  key={f.key}
                  size="sm"
                  inputProps={{ checked: true, onChange: f.clear, 'aria-label': `Remove filter ${f.label}` }}
                  slotSuffix={<SfIconClose size="xs" />}
                  className="!ring-orange-500 !bg-orange-50 dark:!bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold hover:!bg-orange-100 dark:hover:!bg-orange-900/40"
                >
                  {f.label}
                </SfChip>
              ))}
              {activeFilters.length > 1 && (
                <SfButton
                  variant="tertiary"
                  size="sm"
                  onClick={clearAllFilters}
                  className="!text-gray-600 dark:!text-neutral-300 hover:!bg-gray-100 dark:hover:!bg-neutral-900 !font-semibold"
                >
                  Clear all
                </SfButton>
              )}
            </div>
          )}

          <div className="mt-5">
            {/* Error */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 text-center mb-6">
                <p className="text-red-600 dark:text-red-400 text-sm font-semibold">{error}</p>
                <button
                  onClick={() => fetchShops()}
                  className="mt-3 text-sm font-extrabold text-red-600 hover:underline"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Grid Container — 3 cols on xl+, 2 on sm */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : visibleShops.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-neutral-950/40 rounded-2xl p-8 border border-dashed border-gray-200 dark:border-neutral-800">
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/40 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Store className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">No shops match these filters</h3>
                <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1 max-w-sm mx-auto">
                  Try another category or market, or clear your filters.
                </p>
                {activeFilters.length > 0 && (
                  <button type="button" onClick={clearAllFilters} className="mt-4 text-sm font-semibold text-orange-600 hover:underline">
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {visibleShops.map((shop, i) => (
                    <GlovoShopCard key={shop.id} shop={shop} index={i} />
                  ))}
                </div>

                <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scroll-to-top FAB — appears after scrolling 300px */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
          className="fixed right-4 z-40 w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-lg flex items-center justify-center transition-all duration-200"
          aria-label="Scroll to top"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─── Export wrapper ───────────────────────────────────────────────────────────
export default function ShopsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ShopsPageContent />
    </Suspense>
  );
}
