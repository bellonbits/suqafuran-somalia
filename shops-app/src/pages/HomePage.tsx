"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SfButton, SfIconTune } from '@storefront-ui/react';
import { listingsService, PublicShop } from '@/services/listings';
import type { Listing } from '@/types';
import { HomepageBannerRotation } from '@/components/ads/HomepageBannerRotation';
import { ProductCarouselSection } from '@/components/shared/ProductCarouselSection';
import { getCategoryStickerIcon } from '@/lib/categoryIcons';
import { getMockProductInfo } from '@/lib/mockProductInfo';
import { useT, useLocalizedField } from '@/lib/i18n';
// ── Storefront UI + Framer Motion components ──────────────────────────────────
import {
  ListingCard,
  ShopCard,
  SuqafuranSearchBar,
  FilterDrawer,
  HomeFilterBar,
} from '@/components/storefront';
import type { FilterState } from '@/components/storefront';
import { CategoryNavBar, HomeHero, CategoryTiles, TopSelling, SellPoster, ShopsPoster } from '@/components/home/HomeSections';
import type { HomeCategory, TopSellingTab } from '@/components/home/HomeSections';
import { categoryPrefetchProps } from '@/lib/prefetch';
import { shortCategoryName } from '@/lib/categoryName';

interface Category {
    id: number;
    name_en: string;
    name_so?: string;
    slug: string;
    image_url?: string;
    active_listing_count?: number;
}

const PRODUCT_CARD_WIDTH = 'w-[160px] sm:w-[190px] shrink-0';
const SHOP_CARD_WIDTH = 'w-[220px] sm:w-[260px] shrink-0';
const TOP_CATEGORY_COUNT = 5;
const CATEGORY_PAGE_SIZE = 10;
const CATEGORY_ROTATION_MS = 30000;

// Fisher-Yates -- unbiased, unlike the common `sort(() => Math.random() - 0.5)` shortcut.
function shuffle<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// Greedily takes up to `count` listings, skipping any whose seller is
// already represented -- keeps a grid from being dominated by whichever
// seller happens to have the most active listings.
function pickDiverseBySeller(items: Listing[], count: number): Listing[] {
    const seenSellers = new Set<number>();
    const result: Listing[] = [];
    for (const item of items) {
        const sellerId = item.seller_id ?? item.owner_id;
        if (seenSellers.has(sellerId)) continue;
        seenSellers.add(sellerId);
        result.push(item);
        if (result.length === count) break;
    }
    return result;
}

const DEFAULT_FILTERS: FilterState = {
    condition: [],
    priceMin: '',
    priceMax: '',
    location: '',
    sortBy: 'newest',
    verifiedOnly: false,
};

export default function HomePage() {
    const navigate = useNavigate();
    const t = useT();
    const field = useLocalizedField();
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
    const [categories, setCategories] = useState<Category[]>([]);
    const [pool, setPool] = useState<Listing[]>([]);
    const [shops, setShops] = useState<PublicShop[]>([]);
    const [categoryListings, setCategoryListings] = useState<Record<number, Listing[]>>({});
    const [categorySeed, setCategorySeed] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [cats, listings, shopsData] = await Promise.all([
                    listingsService.getCategories(),
                    // Shared pool for every "Top Selling" tab.
                    listingsService.getListings({ limit: 200 }),
                    listingsService.getShops({ limit: 30 }),
                ]);
                setCategories(cats || []);
                setPool(listings || []);
                setShops(shopsData?.shops || []);
            } catch (err) {
                console.error('Failed to load homepage data:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // Real listing volume, not shop count -- this drives the nav, hero slides,
    // tiles and which categories get their own product carousel below.
    const topCategories = useMemo(
        () => [...categories]
            .filter((c) => (c.active_listing_count ?? 0) > 0)
            .sort((a, b) => (b.active_listing_count ?? 0) - (a.active_listing_count ?? 0)),
        [categories]
    );

    const homeCategories: HomeCategory[] = useMemo(
        () => topCategories.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: field(c.name_en, c.name_so) || c.name_en,
            image_url: c.image_url,
            active_listing_count: c.active_listing_count,
        })),
        [topCategories, field]
    );

    useEffect(() => {
        if (topCategories.length === 0) return;
        const top = topCategories.slice(0, TOP_CATEGORY_COUNT);
        Promise.all(
            top.map((cat) =>
                // Same request the category page makes, so these top
                // categories open instantly from cache. Also a bigger-than-
                // displayed pool for the carousels to rotate through.
                listingsService.getListings(listingsService.categoryPageParams(cat.slug)).then((data) => [cat.id, data] as const)
            )
        )
            .then((results) => setCategoryListings(Object.fromEntries(results)))
            .catch((err) => console.error('Failed to load category listings:', err));
        // Only needs to re-run when the set of top categories actually changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topCategories.map((c) => c.id).join(',')]);

    // Re-roll each category carousel on a timer -- reshuffles every
    // category's pool and picks a fresh page.
    useEffect(() => {
        const hasRotatableCategory = Object.values(categoryListings).some((l) => l.length > CATEGORY_PAGE_SIZE);
        if (!hasRotatableCategory) return;
        const intervalId = setInterval(() => {
            setCategorySeed((s) => s + 1);
        }, CATEGORY_ROTATION_MS);
        return () => clearInterval(intervalId);
    }, [categoryListings]);

    const categoryNameById = useMemo(
        () => Object.fromEntries(categories.map((c) => [c.id, field(c.name_en, c.name_so) || c.name_en])),
        [categories, field]
    );

    // categorySeed carries no data of its own -- it just forces a
    // re-shuffle of every category's pool on each tick.
    const visibleCategoryListings = useMemo(
        () =>
            Object.fromEntries(
                Object.entries(categoryListings).map(([catId, listings]) => [catId, shuffle(listings).slice(0, CATEGORY_PAGE_SIZE)])
            ),
        [categoryListings, categorySeed]
    );

    const topSellingTabs: TopSellingTab[] = useMemo(() => [
        {
            key: 'popular',
            label: t('Most popular'),
            listings: pickDiverseBySeller([...pool].sort((a, b) => (b.views || 0) - (a.views || 0)), 12),
            seeAllHref: '/search?sort=popular',
        },
        {
            key: 'new',
            label: t('New arrivals'),
            listings: [...pool].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 12),
            seeAllHref: '/search',
        },
        {
            key: 'deals',
            label: t("Today's deals"),
            listings: pickDiverseBySeller(pool.filter((l) => getMockProductInfo(l).hasPromo), 12),
            seeAllHref: '/search?sort=price_asc',
            extras: (l) => {
                const { discountPercent, originalPrice } = getMockProductInfo(l);
                return { discountPercent, originalPrice };
            },
        },
    ], [pool, t]);

    const popularShops = useMemo(
        () => [...shops].sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0)).slice(0, 10),
        [shops]
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black pb-20">
            {/* ── Filter drawer (SFUI + Framer) — mobile ────────────────── */}
            <FilterDrawer
                isOpen={filterOpen}
                onClose={() => setFilterOpen(false)}
                filters={filters}
                onChange={setFilters}
                onApply={() => {
                    const params = new URLSearchParams();
                    if (filters.location) params.set('location', filters.location);
                    if (filters.priceMin) params.set('price_min', filters.priceMin);
                    if (filters.priceMax) params.set('price_max', filters.priceMax);
                    if (filters.condition.length) params.set('condition', filters.condition.join(','));
                    if (filters.sortBy !== 'newest') params.set('sort', filters.sortBy);
                    navigate(`/search?${params.toString()}`);
                }}
            />

            <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8">
                {/* ── Hero search bar (SFUI SfInput) — mobile only ────────── */}
                <div className="pt-4 sm:hidden">
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <SuqafuranSearchBar
                                size="md"
                                placeholder={t('Search listings in Somalia…')}
                            />
                        </div>
                        <SfButton
                            variant="tertiary"
                            onClick={() => setFilterOpen(true)}
                            square
                            className="!rounded-full !w-12 !h-12 !ring-1 !ring-gray-200 dark:!ring-neutral-700 !bg-white dark:!bg-neutral-900 !text-gray-700 dark:!text-neutral-200 shrink-0"
                            aria-label="Open filters"
                        >
                            <SfIconTune size="sm" />
                        </SfButton>
                    </div>
                </div>

                {/* ── Category nav bar (tablet/desktop) ──────────────────── */}
                <div className="pt-4 md:pt-5">
                    <CategoryNavBar categories={homeCategories} />
                </div>

                {/* ── Category icons (mobile — the hero's category list is desktop only) ── */}
                <section className="mt-4 md:hidden -mx-4">
                    <div className="w-full overflow-x-auto overscroll-x-contain hide-scrollbar">
                        <div className="flex flex-row flex-nowrap items-start gap-2 pb-2 min-w-max px-4">
                            {homeCategories.map((cat) => (
                                <Link
                                    key={cat.id}
                                    to={`/${cat.slug}`}
                                    {...categoryPrefetchProps(cat.slug)}
                                    className="flex flex-col items-center shrink-0 cursor-pointer group"
                                >
                                    <div className="relative w-11 h-11 flex items-center justify-center">
                                        <img src="/icons/fork.png" alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
                                        <img src={getCategoryStickerIcon(cat.slug)} alt={cat.name} className="relative z-10 w-7 h-7 object-contain" />
                                    </div>
                                    <span title={cat.name} className="text-[11px] font-bold mt-1.5 tracking-tight text-center w-16 leading-tight line-clamp-2 [overflow-wrap:anywhere] text-gray-700 dark:text-neutral-200">
                                        {shortCategoryName(cat.name)}
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Hero: Categories | Promo slider | Benefits ─────────── */}
                <div className="mt-4 md:mt-5">
                    <HomeHero categories={homeCategories} />
                </div>

                {/* ── Quick product filters → /search ─────────────────────── */}
                <div className="mt-5">
                    <HomeFilterBar categories={homeCategories.map((c) => ({ id: c.id, name: c.name }))} />
                </div>

                {/* ── Shop by category ────────────────────────────────────── */}
                <div className="mt-10 md:mt-12">
                    <CategoryTiles title={t('Shop by category')} categories={homeCategories} />
                </div>

                {/* ── Top Selling ─────────────────────────────────────────── */}
                <div className="mt-12 md:mt-14">
                    <TopSelling tabs={topSellingTabs} categoryNameById={categoryNameById} />
                </div>

                {/* ── Admin-managed promo banners ─────────────────────────── */}
                <div className="mt-12">
                    <HomepageBannerRotation
                        pair
                        secondary={
                            <SellPoster
                                title={t('Sell on Suqafuran')}
                                subtitle={t('Reach buyers in markets across Somalia')}
                                cta={t('Start selling')}
                            />
                        }
                        fillers={[
                            <ShopsPoster
                                title={t('Explore shops')}
                                subtitle={t('Discover trusted sellers near you')}
                                cta={t('Browse shops')}
                            />,
                        ]}
                    />
                </div>

                {/* ── Popular Shops ───────────────────────────────────────── */}
                {popularShops.length > 0 && (
                    <ProductCarouselSection title={t('Popular Shops')} viewAllHref="/shops">
                        {popularShops.map((shop, i) => (
                            <div key={shop.id} className={SHOP_CARD_WIDTH}>
                                <ShopCard shop={shop} index={i} hideRating />
                            </div>
                        ))}
                    </ProductCarouselSection>
                )}

                {/* ── Per-category carousels ───────────────────────────── */}
                {topCategories.slice(0, TOP_CATEGORY_COUNT).map((cat) => {
                    const listings = visibleCategoryListings[cat.id];
                    if (!listings || listings.length === 0) return null;
                    const catTitle = field(cat.name_en, cat.name_so) || cat.name_en;
                    return (
                        <ProductCarouselSection key={cat.id} title={catTitle} viewAllHref={`/${cat.slug}`}>
                            {listings.map((listing, i) => (
                                <div key={listing.id} className={PRODUCT_CARD_WIDTH}>
                                    <ListingCard
                                        listing={listing}
                                        categoryName={catTitle}
                                        delay={i * 0.03}
                                    />
                                </div>
                            ))}
                        </ProductCarouselSection>
                    );
                })}

                <div className="flex justify-center mt-10">
                    <Link
                        to="/shops"
                        className="px-6 py-3 rounded-full border-2 border-orange-500 text-orange-500 font-bold text-sm hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                    >
                        {t('View All Shops')} →
                    </Link>
                </div>
            </div>
        </div>
    );
}
