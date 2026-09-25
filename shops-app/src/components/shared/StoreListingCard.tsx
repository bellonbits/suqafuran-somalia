"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, MapPin, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DerivedStore } from '../../lib/deriveStores';
import { useCurrencyStore } from '../../store/useCurrency';
import { formatConvertedPrice } from '../../lib/currency';

export const StoreListingCard: React.FC<{ store: DerivedStore }> = ({ store }) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const displayCurrency = useCurrencyStore((s) => s.currency);
    const items = store.previewItems;
    const hasMultiple = items.length > 1;
    const active = items[activeIndex];

    // Only cycle through the other photos (one every ~2s) while hovered/touched;
    // otherwise sit on the first image with no tag, matching a "preview on touch" feel.
    useEffect(() => {
        if (!isActive || !hasMultiple) return;
        const interval = setInterval(() => {
            setActiveIndex((i) => (i + 1) % items.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [isActive, hasMultiple, items.length]);

    useEffect(() => {
        if (!isActive) setActiveIndex(0);
    }, [isActive]);

    const goTo = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((index + items.length) % items.length);
    };

    return (
        <Link
            href={`/shop/${store.slug}`}
            onMouseEnter={() => setIsActive(true)}
            onMouseLeave={() => setIsActive(false)}
            onTouchStart={() => setIsActive((v) => !v)}
            className="block rounded-2xl overflow-hidden hover:opacity-95 transition-opacity"
        >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-neutral-900 group">
                {items.length > 0 ? (
                    items.map((item, i) => (
                        <img
                            key={i}
                            src={item.image}
                            alt=""
                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${i === activeIndex ? 'opacity-100' : 'opacity-0'}`}
                        />
                    ))
                ) : (
                    <div className="h-full w-full flex items-center justify-center text-3xl font-black text-gray-300 dark:text-neutral-200">
                        {store.name.charAt(0).toUpperCase()}
                    </div>
                )}

                {/* Top-left promo tag: real listing title + price from the active slide, shown only while hovered/touched */}
                {isActive && active && (
                    <span className="absolute left-2.5 top-2.5 max-w-[85%] truncate rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-gray-800 shadow">
                        {active.title} - {formatConvertedPrice(active?.price ?? 0, active.currency, displayCurrency)}
                    </span>
                )}

                {hasMultiple && (
                    <>
                        <button
                            onClick={(e) => goTo(e, activeIndex - 1)}
                            aria-label="Previous photo"
                            className={`absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 text-gray-700 shadow-md flex items-center justify-center transition-opacity cursor-pointer ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            onClick={(e) => goTo(e, activeIndex + 1)}
                            aria-label="Next photo"
                            className={`absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 text-gray-700 shadow-md flex items-center justify-center transition-opacity cursor-pointer ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>

                        <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1">
                            {items.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={(e) => goTo(e, i)}
                                    aria-label={`Go to photo ${i + 1}`}
                                    className={`h-1.5 rounded-full transition-all cursor-pointer ${i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="pt-2.5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-gray-900 dark:text-neutral-50 truncate">{store.name}</h4>
                    {store.isVerified && <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0" />}
                </div>

                <div className="flex items-center gap-1 text-[13px] text-gray-500 dark:text-neutral-300">
                    <Tag className="h-3 w-3" />
                    <span>{store.listingCount} listing{store.listingCount === 1 ? '' : 's'}</span>
                    {store.distance && (
                        <>
                            <span>&middot;</span>
                            <MapPin className="h-3 w-3" />
                            <span>{store.distance}</span>
                        </>
                    )}
                </div>

                {store.responseTime && (
                    <p className="text-[13px] text-gray-500 dark:text-neutral-300">{store.responseTime}</p>
                )}
            </div>
        </Link>
    );
};
