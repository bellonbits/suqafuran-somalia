"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, Percent, Package } from 'lucide-react';
import { listingsService, PublicShop, makeShopSlug } from '@/services/listings';
import { resolveMediaUrl, optimizeCloudinaryUrl } from '@/services/api';

function getShopBanner(shop: PublicShop): string | null {
  // Prioritize custom shop page banner (Cloudinary URL)
  if (shop.shop_page_banner && typeof shop.shop_page_banner === 'string') {
    if (shop.shop_page_banner.startsWith('http')) return shop.shop_page_banner;
    if (shop.shop_page_banner.startsWith('data:')) return shop.shop_page_banner;
    const resolved = resolveMediaUrl(shop.shop_page_banner);
    if (resolved) return resolved;
  }

  // Fallback to first listing image
  if (shop.cover_image && typeof shop.cover_image === 'string') {
    // If it's already a data URL (base64), use it directly
    if (shop.cover_image.startsWith('data:')) return shop.cover_image;
    // Otherwise resolve it
    const resolved = resolveMediaUrl(shop.cover_image);
    if (resolved) return resolved;
  }

  // No fallback — return null if no custom banner or cover image
  return null;
}

interface GlovoShopCardProps {
  shop: PublicShop;
  index: number;
  // Shop ratings are a hardcoded placeholder (every shop is 4.5) until real
  // per-shop rating aggregation exists -- contexts that rank/highlight shops
  // by a real signal (e.g. product count) should hide it rather than lead
  // with a number that isn't real.
  hideRating?: boolean;
}

export function GlovoShopCard({ shop, index, hideRating }: GlovoShopCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use banner from shop data (already included in main response)
  const banner = imgError ? null : getShopBanner(shop);
  const initial = shop.shop_name?.[0]?.toUpperCase() || 'S';

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (previewImages !== null) return; // already fetched (or fetch in flight)
    hoverTimerRef.current = setTimeout(async () => {
      try {
        const listings = await listingsService.getListings({ owner_id: shop.id, limit: 8 });
        const images = listings
          .map((l) => l.images?.[0])
          .filter((url): url is string => !!url)
          .map((url) => resolveMediaUrl(url) || url);
        setPreviewImages(images);
      } catch {
        setPreviewImages([]);
      }
    }, 200);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const showPreview = isHovered && previewImages && previewImages.length > 0;

  // Let a finger-swipe/mouse-drag across the preview strip scroll it instead
  // of navigating to the shop — only a real tap (no meaningful movement)
  // should follow the link.
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const handlePreviewPointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = true;
  };
  const handlePreviewPointerUp = () => {
    // Small delay so the auto-scroll doesn't immediately yank the strip
    // right after the user lets go.
    setTimeout(() => { isDraggingRef.current = false; }, 600);
  };
  const handlePreviewClick = (e: React.MouseEvent) => {
    const start = dragStartRef.current;
    if (start && (Math.abs(e.clientX - start.x) > 8 || Math.abs(e.clientY - start.y) > 8)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Auto-scroll the preview strip on its own (pauses while the user is
  // dragging/swiping it), looping seamlessly through the duplicated images.
  // setInterval rather than requestAnimationFrame — rAF gets throttled in
  // some embedded/background rendering contexts, setInterval is reliable.
  useEffect(() => {
    if (!showPreview) return;
    const intervalId = setInterval(() => {
      const el = stripRef.current;
      if (el && !isDraggingRef.current) {
        const half = el.scrollWidth / 2;
        if (half > 0) {
          el.scrollLeft += 1;
          if (el.scrollLeft >= half) {
            el.scrollLeft -= half;
          }
        }
      }
    }, 20);
    return () => clearInterval(intervalId);
  }, [showPreview]);

  // Build a clean slug: prefer the API-returned slug if it looks like a real
  // name-based slug (not a raw numeric ID); otherwise derive it from the name.
  const shopSlug = (shop.slug && !/^\d+$/.test(shop.slug))
    ? shop.slug
    : makeShopSlug(shop.shop_name, shop.id);

  // Use real data from API response
  const ratingPercent = shop.rating ? Math.round(shop.rating * 20) : 85;
  const hasPromo = false; // No promo data in API yet
  const promoText = hasPromo ? '-10% some items' : null;
  const market = shop.market || shop.location || 'Bakaara Market (Mogadishu)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.28, ease: 'easeOut' }}
    >
      <Link
        href={`/shop/${shopSlug}`}
        className="group block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleMouseEnter}
      >

        {/* ─── Banner (16:7 aspect ratio - shorter) ──────────────────────── */}
        <div className="relative aspect-[16/7] w-full rounded-lg overflow-hidden bg-gray-200 dark:bg-neutral-900">
          {showPreview ? (
            /* Preview: auto-scrolling strip of the shop's product photos,
               finger/mouse-swipeable to browse at your own pace too */
            <>
              <div
                ref={stripRef}
                className="no-scrollbar absolute inset-0 flex overflow-x-auto"
                onPointerDown={handlePreviewPointerDown}
                onPointerUp={handlePreviewPointerUp}
                onClick={handlePreviewClick}
              >
                {[...previewImages!, ...previewImages!].map((src, i) => (
                  <img
                    key={i}
                    src={optimizeCloudinaryUrl(src, { width: 250 }) || src}
                    alt=""
                    loading="eager"
                    decoding="async"
                    className="h-full aspect-square object-cover shrink-0"
                    draggable={false}
                  />
                ))}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
            </>
          ) : banner ? (
            <>
              <img
                src={optimizeCloudinaryUrl(banner, { width: 500 }) || banner}
                alt={shop.shop_name}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                onError={() => setImgError(true)}
              />
              {/* Subtle dark gradient at bottom for logo legibility */}
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-black/30 to-transparent" />
            </>
          ) : (
            /* Fallback: Shop initial on gradient background */
            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center">
              <span className="text-4xl font-black text-white">{initial}</span>
            </div>
          )}

          {/* Promo badge — top-left */}
          {promoText && (
            <div className="absolute top-2.5 left-2.5 bg-[#e81f44] text-white text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-0.5">
              <Percent className="w-2.5 h-2.5 stroke-[3]" />
              {promoText}
            </div>
          )}

          {/* Verified badge — top-right */}
          {shop.is_verified && (
            <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full tracking-wide">
              VERIFIED
            </div>
          )}

          {/* Shop logo — bottom-left, Glovo-style circle (always shown) */}
          <div className="absolute bottom-2.5 left-3 w-10 h-10 rounded-full bg-white dark:bg-neutral-950 border-2 border-white dark:border-neutral-800 shadow-md overflow-hidden flex items-center justify-center">
            {shop.logo_url ? (
              <img
                src={resolveMediaUrl(shop.logo_url) || ''}
                alt={shop.shop_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-xs">
                {initial}
              </div>
            )}
          </div>
        </div>

        {/* ─── Details below banner ─────────────────────────────── */}
        <div className="mt-3 px-0.5">
          <h3 data-no-translate className="font-extrabold text-gray-900 dark:text-white text-[14px] leading-snug group-hover:text-orange-500 transition-colors truncate">
            {shop.shop_name}
          </h3>

          {/* Market row (directly under shop name) */}
          <div className="mt-0.5 text-[12px] font-semibold text-gray-500 dark:text-neutral-300 truncate">
            {market}
          </div>

          {/* Metrics row: rating, or product count when rating is hidden -- no delivery time, this is P2P classifieds, not a delivery service */}
          <div className="flex items-center gap-2 mt-1.5 text-[12px] font-semibold text-gray-500 dark:text-neutral-300 flex-nowrap overflow-hidden">
            {hideRating ? (
              <div className="flex items-center gap-1 shrink-0 font-bold">
                <Package className="w-3 h-3 text-orange-500 shrink-0" />
                <span className="truncate">{shop.listing_count ?? 0} products</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0 font-bold">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                <span className="truncate">{ratingPercent}%</span>
              </div>
            )}
          </div>
        </div>

      </Link>
    </motion.div>
  );
}
