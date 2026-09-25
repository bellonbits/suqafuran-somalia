"use client";

import React from 'react';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { ListingWizard } from '@/components/features/ListingWizard';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PostAdPage() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const navigate = useNavigate();

    if (isHydrated && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
                <p className="font-bold text-gray-500">Sign in to post an ad.</p>
                <button
                    onClick={() => openAuthModal('signin')}
                    className="text-primary font-black hover:underline cursor-pointer"
                >
                    Sign In
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
            {/* No title here -- SellerLayout's mobile top bar already shows
            "Add Product" for this route, so a second heading right below it
            was pure duplication. The back button is still needed: it's the
            only quick way back without opening the drawer menu. */}
            <div className="mb-6 md:hidden">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
            </div>
            <ListingWizard />
        </div>
    );
}
