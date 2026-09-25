/**
 * HomeSections
 *
 * Building blocks for the marketplace homepage layout:
 *   CategoryNavBar   – "All categories" menu + top-category links
 *   HomeHero         – Categories list | campaign carousel | Benefits
 *   CategoryTiles    – photo tiles with product counts
 *   TopSelling       – tabbed product grid
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SfButton,
  SfIconExpandMore,
  SfIconChevronRight,
  SfIconSafetyCheck,
  SfIconLocationOn,
  SfIconEmail,
} from '@storefront-ui/react';
import { clsx } from 'clsx';
import { getCategoryStickerIcon } from '@/lib/categoryIcons';
import { ListingCard } from '@/components/storefront';
import { CampaignCarousel } from './CampaignCarousel';
import type { Listing } from '@/types';
import { categoryPrefetchProps } from '@/lib/prefetch';
import { shortCategoryName } from '@/lib/categoryName';

export interface HomeCategory {
  id: number;
  slug: string;
  name: string;
  image_url?: string;
  active_listing_count?: number;
}

const card = 'bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 rounded-xl';

const SeeAll: React.FC<{ to: string; label?: string }> = ({ to, label = 'See all' }) => (
  <Link to={to} className="inline-flex items-center gap-0.5 text-sm font-semibold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
    {label}
    <SfIconChevronRight size="sm" />
  </Link>
);

// ─── Category nav bar ────────────────────────────────────────────────────────
export const CategoryNavBar: React.FC<{ categories: HomeCategory[] }> = ({ categories }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <nav className="hidden md:flex items-center gap-2" aria-label="Categories">
      <div ref={ref} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-8 px-4 h-11 rounded-lg bg-gray-50 dark:bg-neutral-900 text-sm font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          All categories
          <SfIconExpandMore size="sm" className={clsx('transition-transform', open && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full mt-2 z-30 w-64 max-h-96 overflow-y-auto py-2 bg-white dark:bg-neutral-950 rounded-xl shadow-xl ring-1 ring-gray-100 dark:ring-neutral-800"
            >
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    to={`/${cat.slug}`}
                    {...categoryPrefetchProps(cat.slug)}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-orange-50 dark:hover:bg-neutral-900 hover:text-orange-600"
                  >
                    <img src={getCategoryStickerIcon(cat.slug)} alt="" className="w-6 h-6 object-contain" />
                    <span className="flex-1 truncate">{cat.name}</span>
                    {cat.active_listing_count ? <span className="text-xs text-gray-400">{cat.active_listing_count}</span> : null}
                  </Link>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center overflow-x-auto hide-scrollbar">
        {categories.slice(0, 6).map((cat) => (
          <Link
            key={cat.id}
            to={`/${cat.slug}`}
                    {...categoryPrefetchProps(cat.slug)}
            title={cat.name}
            className="px-3 xl:px-5 h-11 flex items-center text-sm whitespace-nowrap text-gray-800 dark:text-neutral-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
          >
            {shortCategoryName(cat.name)}
          </Link>
        ))}
        <Link
          to="/search?sort=popular"
          className="px-3 xl:px-5 h-11 flex items-center text-sm whitespace-nowrap text-gray-800 dark:text-neutral-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
        >
          Bestsellers
        </Link>
      </div>
    </nav>
  );
};

// ─── Hero: categories | campaign carousel | benefits ─────────────────────────
const BENEFITS = [
  {
    icon: SfIconSafetyCheck,
    title: 'Verified Sellers',
    body: 'Every shop is ID or business verified before it can list products.',
  },
  {
    icon: SfIconLocationOn,
    title: 'Local Markets',
    body: 'Buy from shops in Bakaara, Hamar Weyne and markets across Somalia.',
  },
  {
    icon: SfIconEmail,
    title: 'Chat With Sellers',
    body: 'Message shops directly to ask questions and agree on delivery.',
  },
];

interface HomeHeroProps {
  categories: HomeCategory[];
}

export const HomeHero: React.FC<HomeHeroProps> = ({ categories }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_220px] xl:grid-cols-[300px_minmax(0,1fr)_240px] gap-4 lg:gap-5">
      {/* Categories */}
      <aside className={clsx(card, 'hidden lg:flex flex-col p-6')}>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Categories</h2>
        <ul className="flex-1 space-y-1">
          {categories.slice(0, 7).map((cat) => (
            <li key={cat.id}>
              <Link
                to={`/${cat.slug}`}
                    {...categoryPrefetchProps(cat.slug)}
                className="flex items-center gap-4 py-2 text-[15px] text-gray-800 dark:text-neutral-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors group"
              >
                <img src={getCategoryStickerIcon(cat.slug)} alt="" className="w-7 h-7 object-contain group-hover:scale-110 transition-transform" />
                <span className="truncate">{cat.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="pt-4">
          <SeeAll to="/search" />
        </div>
      </aside>

      <CampaignCarousel categories={categories} />

      {/* Benefits */}
      <aside className={clsx(card, 'hidden lg:flex flex-col p-5')}>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Benefits</h2>
        <div className="flex-1 divide-y divide-gray-100 dark:divide-neutral-800">
          {BENEFITS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="py-4">
              <Icon size="sm" className="text-gray-700 dark:text-neutral-300" />
              <h3 className="mt-2 text-base font-bold text-gray-900 dark:text-white">{title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-gray-600 dark:text-neutral-400">{body}</p>
            </div>
          ))}
        </div>
        <SeeAll to="/seller-dashboard" label="Start Selling" />
      </aside>
    </div>
  );
};

// ─── Photo tiles ─────────────────────────────────────────────────────────────
// Portrait artwork for the tiles, keyed by category slug. Web-sized copies of
// the originals in /public (e.g. public/fashion.png) live in public/categories/.
// Categories without an entry fall back to their admin-set image_url.
const TILE_IMAGES: Record<string, string> = {
  fashion: '/categories/fashion.webp',
  'health-beauty': '/categories/health-beauty.webp',
  'household-items': '/categories/household-items.webp',
  'food-groceries': '/categories/food-groceries.webp',
  electronics: '/categories/electronics.webp',
  vehicles: '/categories/vehicles.webp',
};

export const CategoryTiles: React.FC<{ title: string; categories: HomeCategory[] }> = ({ title, categories }) => {
  // Categories with tile artwork go first (still in listing-count order), so
  // the row keeps its matching set of photos even if counts shift.
  const tiles = [
    ...categories.filter((c) => TILE_IMAGES[c.slug]),
    ...categories.filter((c) => !TILE_IMAGES[c.slug]),
  ].slice(0, 6);

  return (
  <section>
    <div className="flex items-end justify-between mb-5">
      <h2 className="text-xl sm:text-2xl md:text-[28px] font-semibold text-gray-900 dark:text-white">{title}</h2>
      <SeeAll to="/search" />
    </div>
    <div className="flex lg:grid lg:grid-cols-6 gap-4 lg:gap-6 overflow-x-auto hide-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
      {tiles.map((cat, i) => (
        <motion.div
          key={cat.id}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
          className="shrink-0 w-[42vw] max-w-[200px] sm:w-48 lg:w-auto lg:max-w-none"
        >
          <Link
            to={`/${cat.slug}`}
                    {...categoryPrefetchProps(cat.slug)}
            className="group relative block aspect-[13/20] overflow-hidden rounded-md bg-gray-200 dark:bg-neutral-900 shadow-sm"
          >
            {(TILE_IMAGES[cat.slug] || cat.image_url) && (
              <img
                src={TILE_IMAGES[cat.slug] || cat.image_url}
                alt=""
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-5 sm:bottom-8 text-center text-white px-2">
              <p className="text-[15px] sm:text-lg font-bold leading-tight drop-shadow line-clamp-2 [overflow-wrap:anywhere]">{cat.name}</p>
              <p className="text-[13px] text-white/85">{cat.active_listing_count ?? 0} products</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  </section>
  );
};

// ─── Tabbed product grid ─────────────────────────────────────────────────────
export interface TopSellingTab {
  key: string;
  label: string;
  listings: Listing[];
  seeAllHref: string;
  /** Optional per-listing extras (e.g. deal pricing) */
  extras?: (l: Listing) => { discountPercent?: number; originalPrice?: number };
}

export const TopSelling: React.FC<{ tabs: TopSellingTab[]; categoryNameById: Record<number, string> }> = ({ tabs, categoryNameById }) => {
  const translate = useT();
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!tab) return null;

  return (
    <section>
      {/* Phones: title on its own row, tabs full-width and swipeable below it,
          so longer Somali labels aren't squeezed off-screen. */}
      <div className="flex flex-wrap sm:flex-nowrap items-end gap-x-6 md:gap-x-16 border-b border-gray-100 dark:border-neutral-800 mb-6">
        <h2 className="w-full sm:w-auto text-xl sm:text-2xl md:text-[28px] font-semibold text-gray-900 dark:text-white pb-3 shrink-0">{translate('Top Selling')}</h2>
        <div className="w-full sm:w-auto sm:flex-1 min-w-0 flex items-end gap-3 sm:gap-5 overflow-x-auto hide-scrollbar" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={t.key === tab.key}
              onClick={() => setActive(t.key)}
              className={clsx(
                // Phones: equal-width tabs that wrap, so all of them fit on screen
                'flex-1 sm:flex-none pb-3 text-sm leading-tight text-center sm:text-left whitespace-normal sm:whitespace-nowrap border-b-2 -mb-px transition-colors',
                t.key === tab.key
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white font-semibold'
                  : 'border-transparent text-gray-500 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="pb-3 hidden sm:block">
          <SeeAll to={tab.seeAllHref} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
        {tab.listings.slice(0, 12).map((listing, i) => (
          <ListingCard
            key={`${tab.key}-${listing.id}`}
            listing={listing}
            categoryName={categoryNameById[listing.category_id]}
            delay={i * 0.02}
            {...tab.extras?.(listing)}
          />
        ))}
      </div>
    </section>
  );
};

// ─── Built-in poster (pairs with the admin banner) ───────────────────────────
/** Brand poster in the logo colours, same 16:9 card shape as the admin banners. */
export const SellPoster: React.FC<{ title: string; subtitle: string; cta: string }> = ({ title, subtitle, cta }) => (
  <Link
    to="/seller-dashboard"
    className="group relative block aspect-video overflow-hidden rounded-2xl bg-gradient-to-r from-[#0078E8] via-[#0090F0] to-[#00BFFF] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
  >
    {/* logo smile, oversized, as background art */}
    <svg viewBox="0 0 200 40" fill="none" preserveAspectRatio="none" aria-hidden className="absolute -right-8 bottom-1 w-[62%] h-[45%] opacity-90">
      <path d="M4 10 C 50 42, 150 42, 196 8" stroke="#FF9600" strokeWidth="6" strokeLinecap="round" />
      <path d="M182 4 L196 8 L188 20" stroke="#FF9600" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <div aria-hidden className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10" />
    <div className="relative h-full flex flex-col items-start justify-center gap-4 px-6 lg:px-8">
      <div className="min-w-0">
        <p className="text-white font-black uppercase tracking-tight leading-none text-[clamp(20px,2vw,28px)] [overflow-wrap:anywhere]">{title}</p>
        <p className="mt-1.5 text-white/85 text-xs lg:text-sm line-clamp-1">{subtitle}</p>
      </div>
      <span className="shrink-0 inline-flex items-center h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-[#FF9600] group-hover:bg-[#F08800] text-white text-sm font-bold shadow-[0_6px_16px_-6px_rgba(255,150,0,0.8)] transition-colors">
        {cta} <SfIconChevronRight size="sm" />
      </span>
    </div>
  </Link>
);

/** Companion poster to SellPoster, same shape, in the brand orange. */
export const ShopsPoster: React.FC<{ title: string; subtitle: string; cta: string }> = ({ title, subtitle, cta }) => (
  <Link
    to="/shops"
    className="group relative block aspect-video overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF9600] via-[#FF8A00] to-[#F06A00] shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
  >
    <div aria-hidden className="absolute -right-10 -top-16 w-56 h-56 rounded-full bg-white/10" />
    <div aria-hidden className="absolute -left-12 -bottom-20 w-48 h-48 rounded-full bg-white/10" />
    <div className="relative h-full flex flex-col items-start justify-center gap-4 px-6 lg:px-8">
      <div className="min-w-0">
        <p className="text-white font-black uppercase tracking-tight leading-none text-[clamp(20px,2vw,28px)] [overflow-wrap:anywhere]">{title}</p>
        <p className="mt-1.5 text-white/90 text-xs lg:text-sm line-clamp-1">{subtitle}</p>
      </div>
      <span className="shrink-0 inline-flex items-center h-9 lg:h-10 px-4 lg:px-5 rounded-full bg-white group-hover:bg-white/90 text-[#F06A00] text-sm font-bold shadow-[0_6px_16px_-6px_rgba(0,0,0,0.3)] transition-colors">
        {cta} <SfIconChevronRight size="sm" />
      </span>
    </div>
  </Link>
);
