"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface ProductCarouselSectionProps {
    title: string;
    subtitle?: string;
    /** Emoji/icon shown before the title, e.g. "🔥" for Today's Deals */
    icon?: React.ReactNode;
    viewAllHref?: string;
    children: React.ReactNode;
}

// Horizontal-scroll section shell shared by every product/shop carousel
// (homepage Featured Products/Today's Deals/Popular Shops/Products by
// Category, and CategoryPage's per-store showcase). No horizontal padding
// of its own -- callers already sit inside a page container that applies
// it once, so this doesn't double it up. Content-agnostic on purpose --
// callers wrap each card in their own fixed-width flex item so this works
// for both product and shop cards without near-duplicate section components.
export function ProductCarouselSection({ title, subtitle, icon, viewAllHref, children }: ProductCarouselSectionProps) {
    return (
        <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <h2 className="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {icon}
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">{subtitle}</p>
                    )}
                </div>
                {viewAllHref && (
                    <Link
                        href={viewAllHref}
                        className="text-sm font-bold text-orange-500 hover:text-orange-600 flex items-center gap-0.5 shrink-0"
                    >
                        View All <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>
            <div className="flex gap-3 overflow-x-auto overscroll-x-contain hide-scrollbar pb-2">
                {children}
            </div>
        </section>
    );
}
