'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { advertisingService, HomepageBanner } from '@/services/advertising';
import { useWindowSize } from '@/hooks/use-window-size';
import { optimizeCloudinaryUrl } from '@/services/api';

const AUTO_SLIDE_MS = 5000;
const TRANSITION_MS = 400;
const CARD_SLIDE_MS = 10000;

interface HomepageBannerRotationProps {
  /**
   * Show every banner as a card in a horizontally swipeable strip (about
   * 1.2 cards visible on phones, 3 on desktop) instead of one rotating
   * strip. `secondary` is appended as the last card.
   */
  pair?: boolean;
  secondary?: ReactNode;
  /**
   * Built-in cards used only to top the strip up to a full row of 3 when
   * there aren't enough banners.
   */
  fillers?: ReactNode[];
}

const MIN_CARDS = 3;

export function HomepageBannerRotation({ pair = false, secondary, fillers = [] }: HomepageBannerRotationProps = {}) {
  const navigate = useNavigate();
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [impressionTracked, setImpressionTracked] = useState<Set<number>>(new Set());
  const { width } = useWindowSize();

  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const data = await advertisingService.getActiveBanners();
      setBanners(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMobile = width < 768;

  // Rotator: track an impression for the banner on screen
  useEffect(() => {
    if (pair || banners.length === 0) return;
    const id = banners[currentIndex].id;
    if (impressionTracked.has(id)) return;

    const timer = setTimeout(async () => {
      await advertisingService.trackBannerImpression(id);
      setImpressionTracked(prev => new Set([...prev, id]));
    }, 100); // Small delay to ensure banner is visible

    return () => clearTimeout(timer);
  }, [pair, currentIndex, banners, impressionTracked]);

  // Card strip: track an impression once a card is at least half scrolled
  // into view.
  useEffect(() => {
    const strip = stripRef.current;
    if (!pair || !strip || banners.length === 0) return;
    const seen = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = Number((entry.target as HTMLElement).dataset.bannerId);
        if (!entry.isIntersecting || seen.has(id)) return;
        seen.add(id);
        advertisingService.trackBannerImpression(id);
      });
    }, { root: strip, threshold: 0.5 });
    strip.querySelectorAll<HTMLElement>('[data-banner-id]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pair, banners]);

  const goTo = (index: number, dir: 'next' | 'prev') => {
    setDirection(dir);
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsTransitioning(false);
    }, TRANSITION_MS / 2);
  };

  const handlePrev = () => {
    goTo((currentIndex - 1 + banners.length) % banners.length, 'prev');
  };

  const handleNext = () => {
    goTo((currentIndex + 1) % banners.length, 'next');
  };

  // Card strip: advance one card every CARD_SLIDE_MS, wrapping back to the
  // start at the end. Pauses while the user hovers or touches the strip.
  useEffect(() => {
    const strip = stripRef.current;
    if (!pair || !strip) return;
    let paused = false;
    const pause = () => { paused = true; };
    const resume = () => { paused = false; };
    strip.addEventListener('pointerenter', pause);
    strip.addEventListener('pointerleave', resume);
    strip.addEventListener('touchstart', pause, { passive: true });
    strip.addEventListener('touchend', resume);

    const interval = setInterval(() => {
      const first = strip.firstElementChild as HTMLElement | null;
      const max = strip.scrollWidth - strip.clientWidth;
      if (paused || !first || max <= 0) return;
      const step = first.offsetWidth + parseFloat(getComputedStyle(strip).columnGap || '0');
      const next = strip.scrollLeft >= max - 4 ? 0 : Math.min(strip.scrollLeft + step, max);
      strip.scrollTo({ left: next, behavior: 'smooth' });
    }, CARD_SLIDE_MS);

    return () => {
      clearInterval(interval);
      strip.removeEventListener('pointerenter', pause);
      strip.removeEventListener('pointerleave', resume);
      strip.removeEventListener('touchstart', pause);
      strip.removeEventListener('touchend', resume);
    };
  }, [pair, loading, banners.length]);

  // Auto-rotate banners (rotator only; the card strip slides on its own timer)
  const rotates = !pair && banners.length > 1;
  useEffect(() => {
    if (!rotates) return;

    const interval = setInterval(() => {
      goTo((currentIndex + 1) % banners.length, 'next');
    }, AUTO_SLIDE_MS);

    return () => clearInterval(interval);
  }, [rotates, banners.length, currentIndex]);

  if (loading || (banners.length === 0 && !(pair && secondary))) return null;

  const imageFor = (banner: HomepageBanner) =>
    isMobile && banner.mobile_image_url ? banner.mobile_image_url : banner.image_url;

  const openBanner = async (banner: HomepageBanner) => {
    await advertisingService.trackBannerClick(banner.id);

    const link = banner.button_link;
    const isExternal = /^https?:\/\//i.test(link) && !link.includes(window.location.host);

    if (isExternal) {
      window.open(link, '_blank', 'noopener,noreferrer');
    } else {
      // Internal path (may be a full URL on our own host, or a relative path)
      const path = link.replace(/^https?:\/\/[^/]+/i, '');
      navigate(path);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (banners.length <= 1) return;
    const SWIPE_THRESHOLD = 50;
    if (touchDeltaX.current > SWIPE_THRESHOLD) {
      handlePrev();
    } else if (touchDeltaX.current < -SWIPE_THRESHOLD) {
      handleNext();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  // Offer-card look: 16:9 with a 16px radius. The full-width rotator is
  // capped at a fixed height from md up so it doesn't dominate the page.
  const frame = pair ? 'aspect-video' : 'aspect-video md:aspect-auto md:h-[260px] lg:h-[300px]';
  const radius = 'rounded-2xl';

  const poster = (banner: HomepageBanner, primary: boolean) => (
    // The uploaded creative is the whole message (title, offer, and CTA are
    // already part of the designed graphic), so the entire image is just a
    // clickable link with no extra overlay.
    <button
      onClick={() => openBanner(banner)}
      className={`block w-full ${frame}`}
      aria-label={banner.title}
    >
      <img
        key={banner.id}
        src={optimizeCloudinaryUrl(imageFor(banner), { width: pair ? 800 : 1920 }) || imageFor(banner)}
        alt={banner.title}
        loading={primary ? 'eager' : 'lazy'}
        fetchPriority={primary ? 'high' : 'auto'}
        className={`w-full h-full object-cover transition-all ease-out ${
          !pair && isTransitioning
            ? direction === 'next'
              ? 'opacity-0 -translate-x-6'
              : 'opacity-0 translate-x-6'
            : 'opacity-100 translate-x-0'
        }`}
        style={{ transitionDuration: `${TRANSITION_MS}ms` }}
      />
    </button>
  );

  if (pair) {
    const card = 'shrink-0 snap-start w-[82%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]';
    return (
      // py-3/-my-3 leaves room for the card shadow inside the scroll container
      <div ref={stripRef} className="flex gap-4 overflow-x-auto overscroll-x-contain snap-x snap-mandatory hide-scrollbar py-3 -my-3">
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            data-banner-id={banner.id}
            className={`${card} relative bg-gray-900 overflow-hidden ${radius} shadow-[0_4px_12px_rgba(0,0,0,0.08)]`}
          >
            {poster(banner, i === 0)}
          </div>
        ))}
        {secondary && <div className={card}>{secondary}</div>}
        {fillers
          .slice(0, Math.max(0, MIN_CARDS - banners.length - (secondary ? 1 : 0)))
          .map((filler, i) => <div key={`filler-${i}`} className={card}>{filler}</div>)}
      </div>
    );
  }

  const currentBanner = banners[currentIndex];

  return (
    <div
      className={`relative w-full bg-gray-900 overflow-hidden ${radius} shadow-[0_10px_40px_rgba(0,0,0,0.08)]`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {poster(currentBanner, true)}

      {/* Navigation arrows (desktop only — mobile uses swipe) */}
      {rotates && (
        <>
          <button
            onClick={handlePrev}
            className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full transition-colors left-4 p-2`}
            aria-label="Previous banner"
          >
            <ChevronLeft className="w-6 h-6 text-gray-900" />
          </button>
          <button
            onClick={handleNext}
            className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-10 bg-white/80 hover:bg-white rounded-full transition-colors right-4 p-2`}
            aria-label="Next banner"
          >
            <ChevronRight className="w-6 h-6 text-gray-900" />
          </button>
        </>
      )}

      {/* Dot indicators */}
      {rotates && (
        <div className={`absolute left-1/2 -translate-x-1/2 flex gap-2 z-10 bottom-4`}>
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goTo(index, index > currentIndex ? 'next' : 'prev')}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-8' : 'bg-white/50 w-2'
              }`}
              aria-label={`Go to banner ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
