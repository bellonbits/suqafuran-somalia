/**
 * ShopCard
 *
 * Marketplace shop card built on Storefront UI + Framer Motion.
 * Replaces the old StoreCard component.
 *
 * Storefront UI: SfButton, SfBadge, SfIconStar, SfIconCheck
 * Framer Motion: card entrance, image scale, hover elevation
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  SfButton,
  SfBadge,
  SfIconStar,
  SfIconCheck,
  SfIconArrowForward,
} from '@storefront-ui/react';
import type { Variants } from 'framer-motion';
import { MapPin, Package } from 'lucide-react';
import { clsx } from 'clsx';
import { makeShopSlug } from '@/services/listings';
import type { PublicShop } from '@/services/listings';
import { optimizeCloudinaryUrl } from '@/services/api';

interface ShopCardProps {
  shop: PublicShop;
  index?: number;
  hideRating?: boolean;
}

const FALLBACK_BANNERS: Record<string, string> = {
  electronics: '/categories/electronics.png',
  phones: '/categories/phones.png',
  clothing: '/categories/shoes.png',
  shoes: '/categories/shoes.png',
  food: '/categories/grocery.jpg',
  groceries: '/categories/grocery.jpg',
  household: '/categories/house.png',
  property: '/categories/house.png',
  beauty: '/categories/skincare.jpg',
  sports: '/categories/sport.jpg',
  vehicles: '/categories/car.png',
  cars: '/categories/car.png',
  livestock: '/categories/livestock.png',
  babies: '/categories/baby.png',
  kids: '/categories/baby.png',
  services: '/categories/services.png',
};

function getShopBanner(shop: PublicShop): string {
  if (shop.shop_page_banner) return shop.shop_page_banner;
  const cat = (shop.category || '').toLowerCase();
  for (const [key, img] of Object.entries(FALLBACK_BANNERS)) {
    if (cat.includes(key)) return img;
  }
  return '/categories/grocery.jpg';
}

const cardVariants: Variants = {
  hidden: { opacity: 0.85, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i * 0.04, 0.1),
      duration: 0.25,
      ease: 'easeOut',
    },
  }),
};

export const ShopCard: React.FC<ShopCardProps> = ({ shop, index = 0, hideRating = false }) => {
  const [imgError, setImgError] = useState(false);
  const slug = shop.slug || makeShopSlug(shop.shop_name || 'shop', shop.id);
  const rawBanner = getShopBanner(shop);
  const banner = optimizeCloudinaryUrl(rawBanner, { width: 600, quality: 'auto', fetch_format: 'auto' }) || rawBanner;
  const rating = shop.rating ?? 4.5;
  const listingCount = shop.listing_count ?? 0;
  const displayName = shop.shop_name || 'Shop';
  const location = shop.market || shop.shop_address || '';
  const rawLogo = shop.logo_url || shop.owner_avatar_url;
  const logo = optimizeCloudinaryUrl(rawLogo, { width: 100, quality: 'auto', fetch_format: 'auto' }) || rawLogo;

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      custom={index}
      whileHover={{ y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
      className="group w-full"
    >
      <Link to={`/shop/${slug}`} className="block hover:no-underline">
        {/* ── Banner image ───────────────────────────────────────────── */}
        <div
          className="relative w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-neutral-900 border border-gray-100 dark:border-neutral-800/80"
          style={{ aspectRatio: '16 / 9' }}
        >
          {!imgError ? (
            <motion.img
              src={banner}
              alt={shop.shop_name || shop.full_name}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950/30 dark:to-sky-900/20">
              <span className="text-5xl">🏪</span>
            </div>
          )}

          {/* ── Gradient overlay ──────────────────────────────────── */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* ── Logo in bottom-left corner ────────────────────────── */}
          {logo && (
            <div className="absolute bottom-3 left-3 w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-md">
              <img src={logo} alt="" loading="eager" decoding="async" className="w-full h-full object-cover" />
            </div>
          )}

          {/* ── Verified badge ────────────────────────────────────── */}
          {shop.is_verified && (
            <div className="absolute top-2 right-2">
              <SfBadge
                content=""
                placement="top-right"
                className="!bg-sky-500 !w-5 !h-5 !rounded-full !flex !items-center !justify-center"
              >
                <SfIconCheck size="xs" className="text-white" />
              </SfBadge>
            </div>
          )}
        </div>

        {/* ── Text content ───────────────────────────────────────────── */}
        <div className="pt-3 px-0.5 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-[15px] line-clamp-1 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {displayName}
            </h3>
            {shop.is_verified && (
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
                <SfIconCheck size="xs" />
                Verified
              </span>
            )}
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs">
            {!hideRating && (
              <div className="flex items-center gap-0.5 text-amber-500 font-bold">
                <SfIconStar size="xs" className="fill-amber-400 text-amber-400" />
                <span className="text-gray-800 dark:text-neutral-100">{rating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-gray-600 dark:text-neutral-400">
              <Package className="h-3 w-3" />
              <span>{listingCount} listings</span>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-1">
            <SfButton
              size="sm"
              variant="tertiary"
              slotSuffix={<SfIconArrowForward size="xs" />}
              className="!p-0 !text-sky-500 hover:!text-sky-600 !font-bold !text-xs !bg-transparent !border-none !h-auto"
            >
              Visit Shop
            </SfButton>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};
