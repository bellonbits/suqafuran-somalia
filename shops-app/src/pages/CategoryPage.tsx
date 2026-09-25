"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShieldCheck, PackageSearch } from 'lucide-react';
import { SfIconChevronRight } from '@storefront-ui/react';
import { clsx } from 'clsx';
import { listingsService } from '@/services/listings';
import { resolveMediaUrl, optimizeCloudinaryUrl } from '@/services/api';
import type { Listing, Category } from '@/types';
import { CANONICAL_CATEGORIES } from '@/components/shared/Sidebar';
import { ListingCard, SortBar } from '@/components/storefront';
import type { FilterOption } from '@/components/storefront';
import { getMockProductInfo } from '@/lib/mockProductInfo';
import { useT, useLocalizedField } from '@/lib/i18n';

// Legacy/alias URLs → the slug the API knows.
const categorySlugMap: Record<string, string> = {
    'grocery': 'food-groceries',
    'apparel': 'clothing-shoes',
    'household': 'household-items',
    'land': 'land-farms',
    'beauty-personal-care': 'health-beauty',
    'commercial': 'commercial-equipment',
    'leisure': 'leisure-sports',
    'sports': 'leisure-sports',
    'repair': 'repair-construction',
    'agriculture': 'agriculture-food',
    'phones': 'mobiles',
    'babies': 'babies-kids',
};

const PAGE_STEP = 20;
const SORT_OPTIONS: FilterOption[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'popular', label: 'Popular' },
];

interface ShopSummary {
    id: number;
    name: string;
    avatar?: string;
    verified: boolean;
    productCount: number;
}

function formatCategoryName(slug: string) {
    return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const chip = (active: boolean) => clsx(
    'shrink-0 h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ring-1 ring-inset',
    active
        ? 'bg-[#0078E8] text-white ring-[#0078E8]'
        : 'bg-white dark:bg-neutral-950 text-gray-700 dark:text-neutral-200 ring-gray-200 dark:ring-neutral-800 hover:ring-[#0078E8]/50 hover:text-[#0078E8]'
);

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORY PAGE — products first; shops are a single compact strip
───────────────────────────────────────────────────────────────────────────── */
export default function CategoryPage() {
    const { category = '' } = useParams<{ category: string }>();
    const t = useT();
    const field = useLocalizedField();

    const slug = categorySlugMap[category] || category;
    const isDealsPage = category === 'deals';

    const [listings, setListings] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiCategory, setApiCategory] = useState<Category | null>(null);
    const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
    const [condition, setCondition] = useState<string | null>(null);
    const [verifiedOnly, setVerifiedOnly] = useState(false);
    const [sort, setSort] = useState('newest');
    const [visible, setVisible] = useState(PAGE_STEP);

    // Products -- the only thing the page waits on. Uses the same params the
    // homepage and hover-prefetch use, so it's usually already cached.
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setSubcategoryId(null);
        setCondition(null);
        setVerifiedOnly(false);
        setVisible(PAGE_STEP);

        const request = isDealsPage
            ? listingsService.getListings({ limit: 60 })
            : listingsService.getListings(listingsService.categoryPageParams(slug));

        request
            .then(data => {
                if (cancelled) return;
                setListings(isDealsPage ? data.filter(l => getMockProductInfo(l).hasPromo) : data);
            })
            .catch(err => {
                console.error('Failed loading category listings:', err);
                if (!cancelled) setListings([]);
            })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [slug, isDealsPage]);

    // Category details (localized name, subcategories) are a nice-to-have --
    // loaded alongside, never blocking the products.
    useEffect(() => {
        let cancelled = false;
        setApiCategory(null);
        listingsService.getCategories()
            .then(cats => { if (!cancelled) setApiCategory(cats.find(c => c.slug === slug) ?? null); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [slug]);

    const title = isDealsPage
        ? t("Today's deals")
        : apiCategory
            ? field(apiCategory.name_en, apiCategory.name_so) || apiCategory.name_en
            : CANONICAL_CATEGORIES.find(c => c.slug === slug)?.name || formatCategoryName(category);

    // Subcategory chips: only ones that actually have products here.
    const subcategoryOptions = useMemo(() => {
        const counts = new Map<number, number>();
        for (const l of listings) if (l.subcategory_id) counts.set(l.subcategory_id, (counts.get(l.subcategory_id) ?? 0) + 1);
        return (apiCategory?.subcategories ?? [])
            .filter(s => counts.has(s.id))
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
            .map(s => ({ id: s.id, name: field(s.name_en, s.name_so) || s.name_en, count: counts.get(s.id) ?? 0 }));
    }, [listings, apiCategory, field]);

    const hasUsed = listings.some(l => l.condition?.toLowerCase() === 'used');

    const filtered = useMemo(() => {
        let results = listings.filter(l =>
            (subcategoryId === null || l.subcategory_id === subcategoryId) &&
            (condition === null || l.condition?.toLowerCase() === condition) &&
            (!verifiedOnly || l.owner?.is_verified)
        );
        if (sort === 'popular') results = [...results].sort((a, b) => (b.views || 0) - (a.views || 0));
        else if (sort === 'price_asc') results = [...results].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        else if (sort === 'price_desc') results = [...results].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        else results = [...results].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return results;
    }, [listings, subcategoryId, condition, verifiedOnly, sort]);

    useEffect(() => setVisible(PAGE_STEP), [subcategoryId, condition, verifiedOnly, sort]);

    // One compact row of the shops behind these products.
    const shops: ShopSummary[] = useMemo(() => {
        const byOwner = new Map<number, ShopSummary>();
        for (const l of listings) {
            if (!l.owner) continue;
            const existing = byOwner.get(l.owner_id);
            if (existing) { existing.productCount++; continue; }
            byOwner.set(l.owner_id, {
                id: l.owner_id,
                name: (l.owner as any).business_name || l.owner.full_name || 'Local Seller',
                avatar: l.owner.avatar_url ? resolveMediaUrl(l.owner.avatar_url) || undefined : undefined,
                verified: !!l.owner.is_verified,
                productCount: 1,
            });
        }
        return [...byOwner.values()].sort((a, b) => b.productCount - a.productCount).slice(0, 12);
    }, [listings]);

    const shopCount = new Set(listings.map(l => l.owner_id)).size;
    const filtersActive = subcategoryId !== null || condition !== null || verifiedOnly;
    const clearFilters = () => { setSubcategoryId(null); setCondition(null); setVerifiedOnly(false); };

    return (
        <div className="bg-white dark:bg-neutral-950 min-h-screen pb-20">
            <div className="max-w-[1440px] mx-auto pt-5 md:pt-6 px-4 sm:px-6 lg:px-8">

                {/* ── Breadcrumb + title ─────────────────────────────────── */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
                    <Link to="/" className="hover:text-[#0078E8]">{t('Home')}</Link>
                    <SfIconChevronRight size="xs" />
                    <span className="text-gray-800 dark:text-neutral-200 font-medium truncate">{title}</span>
                </nav>

                <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                    <h1 className="text-2xl md:text-3xl font-black text-gray-950 dark:text-neutral-50 tracking-tight">{title}</h1>
                    {!loading && listings.length > 0 && (
                        <p className="text-sm text-gray-500 dark:text-neutral-400">
                            {listings.length} {t('products')} · {shopCount} {t('shops')}
                        </p>
                    )}
                </div>

                {/* ── Subcategories ───────────────────────────────────────── */}
                {subcategoryOptions.length > 0 && (
                    <div className="mt-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto overscroll-x-contain hide-scrollbar py-1">
                        <button type="button" onClick={() => setSubcategoryId(null)} className={chip(subcategoryId === null)} aria-pressed={subcategoryId === null}>
                            {t('All')}
                        </button>
                        {subcategoryOptions.map(s => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setSubcategoryId(s.id === subcategoryId ? null : s.id)}
                                className={chip(s.id === subcategoryId)}
                                aria-pressed={s.id === subcategoryId}
                            >
                                {s.name} <span className="opacity-60 tabular-nums">{s.count}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Filters + sort ──────────────────────────────────────── */}
                <div className="mt-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto hide-scrollbar py-1">
                        <button type="button" onClick={() => setCondition(condition === 'new' ? null : 'new')} className={chip(condition === 'new')} aria-pressed={condition === 'new'}>
                            {t('Brand new')}
                        </button>
                        {hasUsed && (
                            <button type="button" onClick={() => setCondition(condition === 'used' ? null : 'used')} className={chip(condition === 'used')} aria-pressed={condition === 'used'}>
                                {t('Used')}
                            </button>
                        )}
                        <button type="button" onClick={() => setVerifiedOnly(v => !v)} className={clsx(chip(verifiedOnly), 'inline-flex items-center gap-1.5')} aria-pressed={verifiedOnly}>
                            <ShieldCheck className="w-4 h-4" /> {t('Verified sellers')}
                        </button>
                        {filtersActive && (
                            <button type="button" onClick={clearFilters} className="shrink-0 h-9 px-3 text-sm font-semibold text-[#0078E8] hover:underline">
                                {t('Clear')}
                            </button>
                        )}
                    </div>
                    <SortBar options={SORT_OPTIONS} value={sort} onChange={setSort} withPrice />
                </div>

                {/* ── Products ────────────────────────────────────────────── */}
                <div className="mt-5">
                    {loading ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="animate-pulse space-y-2.5">
                                    <div className="aspect-square rounded-xl bg-gray-100 dark:bg-neutral-900" />
                                    <div className="h-3.5 w-4/5 rounded bg-gray-100 dark:bg-neutral-900" />
                                    <div className="h-3.5 w-1/2 rounded bg-gray-100 dark:bg-neutral-900" />
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800">
                            <PackageSearch className="w-10 h-10 text-[#0078E8] mx-auto mb-3" />
                            <p className="font-bold text-gray-900 dark:text-white">{t('No products here yet')}</p>
                            {filtersActive && (
                                <button type="button" onClick={clearFilters} className="mt-3 text-sm font-semibold text-[#0078E8] hover:underline">
                                    {t('Clear filters')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                                {filtered.slice(0, visible).map((listing, i) => {
                                    const deal = isDealsPage ? getMockProductInfo(listing) : null;
                                    return (
                                        <ListingCard
                                            key={listing.id}
                                            listing={listing}
                                            categoryName={title}
                                            discountPercent={deal?.discountPercent}
                                            originalPrice={deal?.originalPrice}
                                            delay={(i % PAGE_STEP) * 0.02}
                                            priority={i < 4}
                                        />
                                    );
                                })}
                            </div>

                            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                                {visible < filtered.length && (
                                    <button
                                        type="button"
                                        onClick={() => setVisible(v => v + PAGE_STEP)}
                                        className="h-11 px-6 rounded-full bg-[#0078E8] hover:bg-[#0066C7] text-white text-sm font-bold"
                                    >
                                        {t('Show more')} ({filtered.length - visible})
                                    </button>
                                )}
                                {!isDealsPage && (
                                    <Link
                                        to={`/search?category=${encodeURIComponent(slug)}`}
                                        className="h-11 px-6 inline-flex items-center rounded-full ring-1 ring-inset ring-gray-200 dark:ring-neutral-800 text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:ring-[#0078E8] hover:text-[#0078E8]"
                                    >
                                        {t('More filters')} →
                                    </Link>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* ── Shops (one compact strip) ───────────────────────────── */}
                {!loading && shops.length > 0 && (
                    <section className="mt-12">
                        <div className="flex items-end justify-between mb-3">
                            <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white">
                                {t('Shops selling')} {title}
                            </h2>
                            <Link to={`/shops?category=${encodeURIComponent(slug)}`} className="text-sm font-semibold text-[#0078E8] hover:underline shrink-0">
                                {t('See all')}
                            </Link>
                        </div>
                        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-3 overflow-x-auto hide-scrollbar pb-1">
                            {shops.map(shop => (
                                <Link
                                    key={shop.id}
                                    to={`/shop/${shop.id}?category=${encodeURIComponent(category)}`}
                                    className="shrink-0 w-56 flex items-center gap-3 p-3 rounded-xl ring-1 ring-inset ring-gray-100 dark:ring-neutral-800 hover:ring-[#0078E8]/40 transition-colors"
                                >
                                    <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 dark:bg-neutral-900 shrink-0">
                                        {shop.avatar && (
                                            <img
                                                src={optimizeCloudinaryUrl(shop.avatar, { width: 80 }) || shop.avatar}
                                                alt=""
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white">
                                            <span className="truncate">{shop.name}</span>
                                            {shop.verified && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-neutral-400">{shop.productCount} {t('products')}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
