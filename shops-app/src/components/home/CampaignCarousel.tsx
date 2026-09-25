/**
 * CampaignCarousel
 *
 * Homepage hero: one campaign slide per category, all sharing a single
 * layout so the set reads as one Suqafuran campaign --
 *
 *   EYEBROW
 *   HEADLINE LINE 1
 *   HEADLINE LINE 2   (logo blue, with the logo's orange "smile" swoosh)
 *   Description
 *   [ CTA ]  · N products          [ circular hero image ]
 *
 * Colours come from the logo: blue #0078E8 and swoosh orange #FF9600,
 * with sky #00BFFF as a soft tint. Product counts are the real
 * `active_listing_count` from /listings/categories -- never hard-coded.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { SfButton, SfIconChevronLeft, SfIconChevronRight, SfIconArrowForward } from '@storefront-ui/react';
import { clsx } from 'clsx';
import { useLanguageStore } from '@/store/useLanguage';
import { categoryPrefetchProps } from '@/lib/prefetch';

// ─── Campaign copy & art ─────────────────────────────────────────────────────
interface Campaign {
  eyebrow: string;
  headline: [string, string];
  /** Somali headline -- written as a whole, since word order differs from English */
  headlineSo: [string, string];
  description: string;
  cta: string;
  /** Local square hero (public/categories/hero). Falls back to the category's image_url. */
  image?: string;
  /** CSS object-position for the circular crop */
  focus?: string;
}

// Order here is the slide order. Only categories that exist (and have
// active listings) in the API response are shown, so routes always resolve.
const CAMPAIGNS: Record<string, Campaign> = {
  fashion: {
    eyebrow: 'Trending now',
    headline: ['Fresh', 'Fashion'],
    headlineSo: ['Dhar', 'Cusub'],
    description: 'Styles for Every Day',
    cta: 'Shop Fashion',
    image: '/categories/hero/fashion.webp',
    focus: '50% 20%',
  },
  'health-beauty': {
    eyebrow: 'Look & feel your best',
    headline: ['Beauty', 'Essentials'],
    headlineSo: ['Baahiyaha', 'Quruxda'],
    description: 'Care Made for You',
    cta: 'Explore Beauty',
    image: '/categories/hero/health-beauty.webp?v=2',
  },
  'household-items': {
    eyebrow: 'Trending now',
    headline: ['Everyday', 'Essentials'],
    headlineSo: ['Baahiyaha', 'Maalinlaha'],
    description: 'Household Items',
    cta: 'Shop Household',
    image: '/categories/hero/household-items.webp?v=2',
  },
  'food-groceries': {
    eyebrow: 'Fresh picks',
    headline: ['Fresh', 'Food & Groceries'],
    headlineSo: ['Cunto Cusub', '& Raashin'],
    description: 'Everyday Essentials',
    cta: 'Shop Groceries',
    image: '/categories/hero/food-groceries.webp?v=2',
  },
  electronics: {
    eyebrow: 'Power your day',
    headline: ['Smart', 'Electronics'],
    headlineSo: ['Elektaroonig', 'Casri ah'],
    description: 'Tech for Everyday Life',
    cta: 'Shop Electronics',
    image: '/categories/hero/electronics.webp?v=2',
  },
  vehicles: {
    eyebrow: 'Find your next ride',
    headline: ['Cars', '& Vehicles'],
    headlineSo: ['Baabuur', '& Gaadiid'],
    description: 'From Everyday Cars to More',
    cta: 'Explore Vehicles',
    image: '/categories/hero/vehicles.webp?v=2',
  },
  'leisure-sports': {
    eyebrow: 'Move. Play. Enjoy.',
    headline: ['Leisure', '& Sports'],
    headlineSo: ['Madadaalo', '& Isboorti'],
    description: 'Gear for Every Adventure',
    cta: 'Explore Sports',
  },
};

export interface CampaignCategory {
  id: number;
  slug: string;
  name: string;
  image_url?: string;
  active_listing_count?: number;
}

interface Slide {
  category: CampaignCategory;
  campaign: Campaign;
  image?: string;
}

// Ask Cloudinary for a small square instead of the full-size original.
function optimiseRemote(url?: string): string | undefined {
  if (!url) return url;
  const marker = '/image/upload/';
  if (url.includes('res.cloudinary.com') && url.includes(marker) && !url.includes('/c_fill')) {
    return url.replace(marker, `${marker}c_fill,g_auto,w_800,h_800,q_auto,f_auto/`);
  }
  return url;
}

export function buildCampaignSlides(categories: CampaignCategory[]): Slide[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  return Object.entries(CAMPAIGNS).flatMap(([slug, campaign]) => {
    const category = bySlug.get(slug);
    if (!category) return [];
    return [{ category, campaign, image: campaign.image ?? optimiseRemote(category.image_url) }];
  });
}

// ─── Brand art ───────────────────────────────────────────────────────────────
const ORANGE = '#FF9600';

/** The logo's orange smile, reused as the campaign's signature mark. */
const Swoosh: React.FC<{ className?: string; strokeWidth?: number }> = ({ className, strokeWidth = 7 }) => (
  <svg viewBox="0 0 200 40" fill="none" preserveAspectRatio="none" className={className} aria-hidden>
    <path d="M4 10 C 50 42, 150 42, 196 8" stroke={ORANGE} strokeWidth={strokeWidth} strokeLinecap="round" />
    <path d="M182 4 L196 8 L188 20" stroke={ORANGE} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Carousel ────────────────────────────────────────────────────────────────
const SLIDE_MS = 20000;
const SWIPE_PX = 60;

export const CampaignCarousel: React.FC<{ categories: CampaignCategory[] }> = ({ categories }) => {
  const slides = buildCampaignSlides(categories);
  const reduceMotion = useReducedMotion();
  const language = useLanguageStore((st) => st.language);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  const count = slides.length;
  const paused = hovered || focused || pageHidden || !!reduceMotion;

  const go = useCallback((next: number, dir: 1 | -1) => {
    if (count === 0) return;
    setDirection(dir);
    setIndex(((next % count) + count) % count);
  }, [count]);
  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  // Autoplay -- keyed on index so a manual change restarts the timer.
  useEffect(() => {
    if (paused || count < 2) return;
    const id = setTimeout(next, SLIDE_MS);
    return () => clearTimeout(id);
  }, [paused, count, index, next]);

  useEffect(() => {
    const onVis = () => setPageHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Warm the next slide's image so it never flashes in blank.
  useEffect(() => {
    const upcoming = slides[(index + 1) % Math.max(count, 1)]?.image;
    if (upcoming) new Image().src = upcoming;
  }, [index, count]); // eslint-disable-line react-hooks/exhaustive-deps

  if (count === 0) {
    return <div className="h-[196px] min-[380px]:h-[208px] sm:h-[400px] lg:h-auto lg:min-h-[420px] lg:self-stretch rounded-xl bg-gray-50 dark:bg-neutral-900 animate-pulse" />;
  }

  const safeIndex = index % count;
  const { category, campaign, image } = slides[safeIndex];
  const products = category.active_listing_count ?? 0;
  const headline = language === 'en' ? campaign.headline : campaign.headlineSo;

  const variants = {
    enter: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * -40 }),
  };

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label="Featured categories"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false); }}
      className="relative h-[196px] min-[380px]:h-[208px] sm:h-[400px] lg:h-auto lg:min-h-[420px] lg:self-stretch overflow-hidden rounded-xl border border-gray-100 dark:border-neutral-800 bg-gradient-to-br from-white via-[#F5FAFF] to-[#E8F4FF] dark:from-neutral-950 dark:via-neutral-950 dark:to-[#06203d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0078E8]"
    >
      {/* Soft brand-sky glow, fixed so slides change on a stable backdrop */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 w-[420px] h-[420px] rounded-full bg-[#00BFFF]/10 blur-2xl" />

      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={category.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduceMotion ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          drag={count > 1 ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE_PX) next();
            else if (info.offset.x > SWIPE_PX) prev();
          }}
          role="group"
          aria-roledescription="slide"
          aria-label={`${safeIndex + 1} of ${count}: ${category.name}`}
          className="absolute inset-0 grid grid-cols-[minmax(0,1fr)_auto] items-center sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] touch-pan-y"
        >
          {/* ── Copy ──────────────────────────────────────────────── */}
          <div className="relative z-10 pl-5 pr-1 pb-5 sm:pb-0 sm:pl-10 lg:pl-12 sm:pr-2">
            <p className="flex items-center gap-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-[#0078E8] dark:text-[#4DB0FF]">
              <span className="w-4 sm:w-6 h-[3px] rounded-full bg-[#FF9600] shrink-0" aria-hidden />
              {campaign.eyebrow}
            </p>

            <h2 data-no-translate className="mt-2 sm:mt-4 font-black uppercase tracking-tight leading-[0.95] text-[clamp(19px,6vw,25px)] sm:text-[42px] lg:text-[46px] xl:text-[54px] [text-wrap:balance]">
              <span className="block text-[#0A1F44] dark:text-white">{headline[0]}</span>
              <span className="relative inline-block text-[#0078E8] dark:text-[#4DB0FF]">
                {headline[1]}
                <Swoosh className="absolute left-0 -bottom-2 sm:-bottom-4 w-full h-2 sm:h-4" />
              </span>
            </h2>

            <p className="hidden sm:block mt-7 text-lg text-gray-600 dark:text-neutral-300">{campaign.description}</p>

            <div className="mt-4 sm:mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
              <SfButton
                as={Link}
                to={`/${category.slug}`}
                {...categoryPrefetchProps(category.slug)}
                draggable={false}
                slotSuffix={<SfIconArrowForward size="sm" />}
                className="!h-9 sm:!h-12 !px-4 sm:!px-6 !text-sm sm:!text-base !rounded-full !bg-[#0078E8] hover:!bg-[#0066C7] active:!bg-[#0058AD] !text-white !font-bold !shadow-[0_8px_20px_-6px_rgba(0,120,232,0.55)]"
              >
                {campaign.cta}
              </SfButton>
              {products > 0 && (
                <span className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-[#FF9600]" aria-hidden />
                  {products.toLocaleString()} products
                </span>
              )}
            </div>
          </div>

          {/* ── Hero image ────────────────────────────────────────── */}
          <div className="relative h-full flex items-center justify-center pr-6 pb-5 sm:pb-0 sm:pr-8">
            <div className="relative w-[112px] min-[380px]:w-[124px] aspect-square sm:w-[78%] max-w-[340px] lg:max-w-[380px]">
              {/* sky disc offset behind the photo */}
              <div aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 sm:translate-x-5 sm:translate-y-5 rounded-full bg-[#00BFFF]/20 dark:bg-[#00BFFF]/15" />
              {/* blue ring */}
              <div aria-hidden className="absolute -inset-1.5 sm:-inset-3 rounded-full border-2 border-dashed border-[#0078E8]/25" />
              {image ? (
                <img
                  src={image}
                  alt={`${category.name} products available on Suqafuran`}
                  width={800}
                  height={800}
                  draggable={false}
                  loading={safeIndex === 0 ? 'eager' : 'lazy'}
                  // @ts-expect-error -- fetchpriority is valid HTML, not yet in React 18 types
                  fetchpriority={safeIndex === 0 ? 'high' : 'auto'}
                  style={{ objectPosition: campaign.focus ?? '50% 50%' }}
                  className="relative w-full h-full object-cover rounded-full ring-4 sm:ring-[6px] ring-white dark:ring-neutral-900 shadow-[0_24px_60px_-20px_rgba(10,31,68,0.45)] select-none"
                />
              ) : (
                <div className="relative w-full h-full rounded-full bg-[#E8F4FF] dark:bg-neutral-900 ring-[6px] ring-white dark:ring-neutral-900" />
              )}
              {/* orange swoosh hugging the bottom of the disc */}
              <Swoosh className="absolute -bottom-3 sm:-bottom-6 left-[8%] w-[84%] h-4 sm:h-9" strokeWidth={6} />
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Controls ─────────────────────────────────────────────── */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between px-3 sm:px-8 lg:px-10 pb-1 sm:pb-5">
          <div className="flex items-center" role="tablist" aria-label="Choose a category slide">
            {slides.map((s, i) => {
              const active = i === safeIndex;
              return (
                <button
                  key={s.category.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`Show ${s.category.name}`}
                  onClick={() => go(i, i > safeIndex ? 1 : -1)}
                  className="p-2 -m-0.5 group"
                >
                  <span
                    className={clsx(
                      'relative block h-2 rounded-full overflow-hidden transition-all duration-300',
                      active ? 'w-8 bg-[#0078E8]/20' : 'w-2 bg-gray-300 dark:bg-neutral-700 group-hover:bg-gray-400'
                    )}
                  >
                    {active && (
                      <motion.span
                        key={`${s.category.id}-${paused}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-[#0078E8]"
                        initial={{ width: paused ? '100%' : '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: paused ? 0 : SLIDE_MS / 1000, ease: 'linear' }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <SfButton
              variant="tertiary"
              square
              onClick={prev}
              aria-label="Previous slide"
              className="!w-10 !h-10 !rounded-full !bg-white/90 dark:!bg-neutral-900/90 !ring-1 !ring-gray-200 dark:!ring-neutral-700 !text-[#0A1F44] dark:!text-white hover:!bg-white hover:!text-[#0078E8]"
            >
              <SfIconChevronLeft size="sm" />
            </SfButton>
            <SfButton
              variant="tertiary"
              square
              onClick={next}
              aria-label="Next slide"
              className="!w-10 !h-10 !rounded-full !bg-white/90 dark:!bg-neutral-900/90 !ring-1 !ring-gray-200 dark:!ring-neutral-700 !text-[#0A1F44] dark:!text-white hover:!bg-white hover:!text-[#0078E8]"
            >
              <SfIconChevronRight size="sm" />
            </SfButton>
          </div>
        </div>
      )}

      {/* Announce slide changes only when the user drives them */}
      <p className="sr-only" aria-live={paused ? 'polite' : 'off'}>
        {`Slide ${safeIndex + 1} of ${count}: ${campaign.headline.join(' ')}`}
      </p>
    </section>
  );
};

