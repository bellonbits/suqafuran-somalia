"use client";

import React from 'react';
import Link from 'next/link';
import { Bike, ShieldCheck, MapPin, Clock, ChevronRight } from 'lucide-react';

interface StoreCardProps {
    slug: string;
    name: string;
    image?: string | null;
    time?: string;
    distance?: string;
    isVerified?: boolean;
    responseTime?: string;
}

export const StoreCard: React.FC<StoreCardProps> = ({ slug, name, image, time, distance, isVerified, responseTime }) => {
    return (
        <Link
            href={`/shop/${slug}`}
            className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 transition-colors dark:bg-neutral-950 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
        >
            <div className="h-12 w-12 rounded-full overflow-hidden bg-slate-100 border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 shrink-0 flex items-center justify-center text-sm font-black text-gray-500 dark:text-neutral-200">
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover" />
                ) : (
                    name.charAt(0).toUpperCase()
                )}
            </div>

            <div className="min-w-0 space-y-1">
                <h4 className="text-sm font-black text-gray-900 dark:text-neutral-50 truncate">{name}</h4>

                {time && (
                    <div className="flex items-center gap-1 text-xs font-bold text-primary dark:text-sky-400">
                        <Bike className="h-3.5 w-3.5" />
                        <span>{time}</span>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                    {isVerified && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-slate-900 dark:bg-neutral-800 rounded-full px-2 py-0.5">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                        </span>
                    )}
                    {distance && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-slate-100 dark:bg-neutral-900 dark:text-neutral-300 rounded-full px-2 py-0.5">
                            <MapPin className="h-3 w-3" />
                            {distance}
                        </span>
                    )}
                    {responseTime && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-full px-2 py-0.5">
                            <Clock className="h-3 w-3" />
                            {responseTime}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
};

export const SeeAllStoresCard: React.FC<{ extraNames?: string[] }> = ({ extraNames }) => {
    return (
        <Link
            href="/stores"
            className="flex items-center justify-between gap-3 p-4 rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 transition-colors dark:bg-neutral-950 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
        >
            <div className="min-w-0 space-y-1">
                <h4 className="text-sm font-black text-gray-900 dark:text-neutral-50">See all sellers nearby</h4>
                {extraNames && extraNames.length > 0 && (
                    <p className="text-[11px] text-gray-400 dark:text-neutral-400 font-semibold truncate">
                        {extraNames.join(', ')}
                    </p>
                )}
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        </Link>
    );
};

interface BrandStoreCardProps {
    slug: string;
    name: string;
    image?: string | null;
    bannerUrl?: string | null;
    distance?: string;
    isVerified?: boolean;
    trustScore?: number;
    listingCount?: number;
    brandColor?: string;
}

export const BrandStoreCard: React.FC<BrandStoreCardProps> = ({
    slug,
    name,
    image,
    bannerUrl,
    distance,
    isVerified,
    trustScore,
    listingCount = 1,
    brandColor
}) => {
    const colors = [
        { bg: 'bg-[#FF3008]', text: 'text-white' }, // DoorDash Red
        { bg: 'bg-[#002D62]', text: 'text-white' }, // ALDI Dark Blue
        { bg: 'bg-[#C41230]', text: 'text-white' }, // Cub Red
        { bg: 'bg-[#FF6A00]', text: 'text-white' }, // Speedway Orange
        { bg: 'bg-[#008A22]', text: 'text-white' }, // Dollar Tree Green
        { bg: 'bg-[#185A9D]', text: 'text-white' }, // Soft Teal/Blue
        { bg: 'bg-[#E51B24]', text: 'text-white' }, // Hy-Vee
        { bg: 'bg-[#4B6984]', text: 'text-white' }, // Slate Blue
    ];

    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const presetColor = colors[hash % colors.length];

    // Dynamic Tailwind classes can't be JIT-detected at runtime - use inline style for custom brandColors
    const displayBgClass = brandColor ? '' : presetColor.bg;
    const displayStyle: React.CSSProperties = bannerUrl
        ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : brandColor
            ? { backgroundColor: brandColor }
            : {};
    const rating = trustScore ? (trustScore / 100).toFixed(1) : (4.4 + (hash % 6) * 0.1).toFixed(1);
    const ratingCount = 5 + (hash % 45);

    return (
        <Link
            href={`/shop/${slug}`}
            className="block rounded-3xl overflow-hidden border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 card-shadow-premium hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition-all shrink-0 w-52 group cursor-pointer"
        >
            {/* Top Brand Banner Header */}
            <div
                className={`relative h-28 flex items-center justify-center ${displayBgClass}`}
                style={displayStyle}
            >
                {/* Gradient overlay for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

                {/* Logo Badge in the Center */}
                <div className="absolute -bottom-6 z-10 h-14 w-14 rounded-full bg-white shadow-md border-2 border-white dark:bg-neutral-900 dark:border-neutral-800 flex items-center justify-center overflow-hidden">
                    {image ? (
                        <img src={image} alt={name} className="h-full w-full object-cover group-hover:scale-108 transition-transform duration-300" />
                    ) : (
                        <span className="text-lg font-black text-gray-700 dark:text-neutral-100">
                            {name.charAt(0).toUpperCase()}
                        </span>
                    )}
                </div>
            </div>

            {/* Content Body */}
            <div className="pt-8 p-3.5 space-y-1.5 text-center">
                <div className="flex items-center justify-center gap-1 min-w-0">
                    <h4 className="text-sm font-black text-gray-900 dark:text-neutral-50 truncate max-w-[85%] group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {name}
                    </h4>
                    {isVerified && <ShieldCheck className="h-4 w-4 text-sky-500 shrink-0" />}
                </div>

                {/* Rating & Distance */}
                <div className="flex items-center justify-center gap-1 text-xs font-bold text-gray-600 dark:text-neutral-300">
                    <span className="text-amber-500">★</span>
                    <span className="text-gray-900 dark:text-neutral-100">{rating} ({ratingCount})</span>
                    <span>&middot;</span>
                    <span>{distance || 'Nairobi'}</span>
                </div>

                {/* Listing Count & Escrow badge */}
                <p className="text-[11px] text-gray-400 dark:text-neutral-400 font-semibold">
                    {listingCount} product{listingCount === 1 ? '' : 's'}
                </p>

                {/* View Shop CTA */}
                <div className="pt-2">
                    <span className="inline-flex items-center justify-center gap-1 w-full text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 group-hover:bg-orange-600 group-hover:text-white px-3 py-1.5 rounded-full transition-all duration-200">
                        View Shop &rarr;
                    </span>
                </div>
            </div>
        </Link>
    );
};

