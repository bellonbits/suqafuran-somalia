/**
 * ListingCard
 *
 * The primary card component for Suqafuran marketplace listings.
 * Built on top of Storefront UI primitives (SfButton, SfIconHeart, SfBadge)
 * with Framer Motion animations.
 *
 * Architecture:
 *   Storefront UI (SfButton, SfIconHeart, SfBadge)
 *       ↓
 *   ListingCard (Suqafuran abstraction)
 *       ↓
 *   Marketplace pages (HomePage, CategoryPage, SearchPage …)
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SfButton,
  SfIconFavorite,
  SfIconFavoriteFilled,
  SfBadge,
  SfIconShoppingCart,
  SfIconCheckCircle,
} from '@storefront-ui/react';
import type { Variants } from 'framer-motion';
import { ShieldCheck, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { useFavoritesStore } from '@/store/useFavorites';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { useCurrencyStore } from '@/store/useCurrency';
import { useCart } from '@/store/useCart';
import { formatConvertedPrice } from '@/lib/currency';
import { useLocalizedField } from '@/lib/i18n';
import { FeaturedBadge } from '@/components/ads/FeaturedBadge';
import { optimizeCloudinaryUrl } from '@/services/api';
import type { Listing } from '@/types';

interface ListingCardProps {
  listing: Listing;
  categoryName?: string;
  discountPercent?: number;
  originalPrice?: number;
  showSeller?: boolean;
  isFeatured?: boolean;
  /** 'vertical' (default) = image stacked on top. 'horizontal' = image left, content right. */
  layout?: 'vertical' | 'horizontal';
  /** Animation stagger delay in seconds */
  delay?: number;
  /** High priority image loading for above-the-fold or featured listings */
  priority?: boolean;
}

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop';

// ─────────────────────────────────────────────────────────────────────────────
// Card motion variants - fast, smooth, non-blocking
// ─────────────────────────────────────────────────────────────────────────────
const cardVariants: Variants = {
  hidden: { opacity: 0.85, y: 4 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      delay: Math.min(delay, 0.08),
      ease: 'easeOut',
    },
  }),
};

const imageVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.06, transition: { duration: 0.45, ease: 'easeOut' } },
};

const heartVariants: Variants = {
  liked: { scale: [1, 1.35, 1], transition: { duration: 0.35 } },
  unliked: { scale: 1 },
};

const addedBannerVariants: Variants = {
  hidden: { opacity: 0, y: 8, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.2 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  categoryName,
  discountPercent,
  originalPrice,
  showSeller = false,
  isFeatured = false,
  layout = 'vertical',
  delay = 0,
  priority = false,
}) => {
  const [addedToCart, setAddedToCart] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const { isAuthenticated } = useAuthStore();
  const openAuthModal = useAuthModal((s) => s.open);
  const isFavorite = useFavoritesStore((s) => s.isFavorite(listing.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const displayCurrency = useCurrencyStore((s) => s.currency);
  const addItem = useCart((s) => s.addItem);
  const field = useLocalizedField();

  const rawImage =
    listing.images && listing.images.length > 0 ? listing.images[0] : FALLBACK_IMAGE;
  const displayImage =
    optimizeCloudinaryUrl(rawImage, { width: 500, quality: 'auto', fetch_format: 'auto' }) || rawImage;

  const title = field(listing.title_en, listing.title_so) || listing.title_en;

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }
    toggleFavorite(listing.id);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: String(listing.id),
      title,
      price: listing?.price ?? 0,
      quantity: 1,
      image: displayImage,
      owner_id: listing.owner_id,
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  // ── Price block ─────────────────────────────────────────────────────────
  const PriceBlock = (
    <div className="flex items-baseline gap-1.5 flex-wrap">
      <span className="text-[15px] font-black text-gray-900 dark:text-neutral-50">
        {formatConvertedPrice(listing?.price ?? 0, listing.currency, displayCurrency)}
      </span>
      {!!originalPrice && originalPrice > (listing?.price ?? 0) && (
        <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 line-through">
          {formatConvertedPrice(originalPrice, listing.currency, displayCurrency)}
        </span>
      )}
    </div>
  );

  // ── Seller info ─────────────────────────────────────────────────────────
  const SellerBlock = showSeller && listing.owner && (
    <div className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-neutral-400">
      <span className="font-semibold truncate">{listing.owner.full_name}</span>
      {listing.owner.is_verified && (
        <ShieldCheck className="h-3 w-3 text-sky-500 shrink-0" />
      )}
    </div>
  );

  // ── Overlay badges ──────────────────────────────────────────────────────
  const OverlayBadges = (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
      {!!discountPercent && (
        <SfBadge
          content={`-${discountPercent}%`}
          className="!bg-rose-500 !text-white !font-extrabold !text-[10px] !px-2 !py-0.5 !rounded"
          placement="top-left"
        />
      )}
      {isFeatured && <FeaturedBadge size="sm" />}
      {listing.condition && listing.condition !== 'new' && (
        <span className="rounded-full bg-slate-900/75 backdrop-blur-sm px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
          {listing.condition}
        </span>
      )}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────────
  // HORIZONTAL layout
  // ──────────────────────────────────────────────────────────────────────────
  if (layout === 'horizontal') {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        custom={delay}
      >
        <Link
          to={`/listing/${listing.id}`}
          state={{ listing }}
          className="flex gap-3 w-full hover:no-underline group"
        >
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-slate-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800">
            <motion.img
              src={displayImage}
              alt={title}
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              fetchPriority={priority ? 'high' : 'auto'}
              variants={imageVariants}
              initial="rest"
              animate={isHovered ? 'hover' : 'rest'}
            />
            {OverlayBadges}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div className="space-y-1">
              <h3 data-no-translate className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-neutral-50 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {title}
              </h3>
              {categoryName && (
                <p className="text-xs text-gray-500 dark:text-neutral-400">{categoryName}</p>
              )}
              {SellerBlock}
            </div>
            <div className="flex items-center justify-between mt-2">
              {PriceBlock}
              <div className="flex items-center gap-2">
                <SfButton
                  size="sm"
                  variant="tertiary"
                  onClick={handleToggleFavorite}
                  className={clsx(
                    '!rounded-full !w-9 !h-9 !p-0 !border !border-gray-200 dark:!border-neutral-700 !bg-white dark:!bg-neutral-900',
                    isFavorite && '!text-red-500'
                  )}
                  aria-label="Toggle favourite"
                >
                  {isFavorite ? (
                    <SfIconFavoriteFilled className="text-red-500" size="sm" />
                  ) : (
                    <SfIconFavorite size="sm" />
                  )}
                </SfButton>
                <SfButton
                  size="sm"
                  onClick={handleAddToCart}
                  className="!rounded-full !w-9 !h-9 !p-0 !bg-sky-500 hover:!bg-sky-600 !text-white !border-transparent"
                  aria-label="Add to cart"
                >
                  <SfIconShoppingCart size="sm" />
                </SfButton>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // VERTICAL layout (default — grid/carousel card)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={delay}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group w-full"
    >
      <Link
        to={`/listing/${listing.id}`}
        state={{ listing }}
        className="block hover:no-underline"
      >
        {/* ── Image container ─────────────────────────────────────────── */}
        <div
          className="relative aspect-square rounded-2xl overflow-hidden bg-slate-50 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800/80"
          style={{ contain: 'layout paint', transform: 'translateZ(0)' }}
        >
          <motion.img
            src={displayImage}
            alt={title}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            variants={imageVariants}
            initial="rest"
            animate={isHovered ? 'hover' : 'rest'}
          />

          {OverlayBadges}

          {/* ── Location pill (bottom left) ────────────────────────── */}
          {listing.location && (
            <motion.div
              className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-[9px] font-semibold px-2 py-1 rounded-full z-10 max-w-[60%] truncate"
              initial={{ opacity: 0, y: 4 }}
              animate={isHovered ? { opacity: 1, y: 0 } : { opacity: 0.7, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{listing.location}</span>
            </motion.div>
          )}

          {/* ── Favourite button (top right) ───────────────────────── */}
          <motion.div
            animate={isFavorite ? 'liked' : 'unliked'}
            variants={heartVariants}
            className="absolute top-2 right-2 z-10"
          >
            <SfButton
              size="sm"
              variant="tertiary"
              onClick={handleToggleFavorite}
              className={clsx(
                '!rounded-full !w-9 !h-9 !p-0 !bg-white/90 dark:!bg-neutral-900/90 !backdrop-blur-sm',
                '!border !border-gray-200/60 dark:!border-neutral-700/60',
                '!shadow-sm hover:!shadow-md !transition-shadow',
                isFavorite ? '!text-red-500' : '!text-gray-500 dark:!text-neutral-300'
              )}
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? (
                <SfIconFavoriteFilled className="text-red-500" size="sm" />
              ) : (
                <SfIconFavorite size="sm" />
              )}
            </SfButton>
          </motion.div>

          {/* ── Add to cart button (bottom right) ─────────────────── */}
          <AnimatePresence mode="wait">
            {addedToCart ? (
              <motion.div
                key="added"
                variants={addedBannerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1.5 rounded-full shadow-lg"
              >
                <SfIconCheckCircle size="xs" />
                Added!
              </motion.div>
            ) : (
              <motion.div
                key="add"
                variants={addedBannerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="absolute bottom-2.5 right-2.5 z-10"
              >
                <SfButton
                  size="sm"
                  onClick={handleAddToCart}
                  className="!rounded-full !w-9 !h-9 !p-0 !bg-sky-500 hover:!bg-sky-600 !text-white !border-transparent !shadow-md hover:!shadow-[0_4px_16px_rgba(14,165,233,0.5)] !transition-shadow"
                  aria-label="Add to cart"
                >
                  <SfIconShoppingCart size="sm" />
                </SfButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Text content ────────────────────────────────────────────── */}
        <div className="pt-2.5 space-y-1">
          <h3 data-no-translate className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-neutral-50 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors duration-200">
            {title}
          </h3>

          {categoryName && (
            <p className="text-[11px] font-medium text-gray-500 dark:text-neutral-400 uppercase tracking-wide">
              {categoryName}
            </p>
          )}

          {PriceBlock}
          {SellerBlock}
        </div>
      </Link>
    </motion.div>
  );
};
