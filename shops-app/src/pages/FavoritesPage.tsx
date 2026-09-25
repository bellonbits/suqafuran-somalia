"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { favoritesService } from '@/services/favorites';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { ProductCard } from '@/components/features/ProductCard';
import type { Listing } from '@/types';

export default function FavoritesPage() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const [favorites, setFavorites] = useState<Listing[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated) return;
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        favoritesService.getMyFavorites()
            .then(setFavorites)
            .catch(() => setFavorites([]))
            .finally(() => setLoading(false));
    }, [isHydrated, isAuthenticated]);

    if (isHydrated && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
                <Heart className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="font-bold text-gray-500">Sign in to see your saved listings.</p>
                <button onClick={() => openAuthModal('signin')} className="text-primary font-black hover:underline cursor-pointer">Sign In</button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <h1 className="text-2xl font-black text-gray-900 dark:text-neutral-50 font-poppins">My Favorites</h1>

            {loading ? (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-2xl bg-gray-100 dark:bg-neutral-950 animate-pulse" />
                    ))}
                </div>
            ) : favorites.length > 0 ? (
                <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                    {favorites.map((listing) => (
                        <ProductCard key={listing.id} listing={listing} />
                    ))}
                </div>
            ) : (
                <div className="py-16 text-center space-y-3">
                    <Heart className="h-10 w-10 text-gray-300 mx-auto" />
                    <p className="font-bold text-gray-500">No favorites yet</p>
                    <p className="text-sm text-gray-400">Tap the heart icon on any listing to save it here.</p>
                    <Link href="/" className="inline-block text-primary font-black hover:underline">Browse listings</Link>
                </div>
            )}
        </div>
    );
}
