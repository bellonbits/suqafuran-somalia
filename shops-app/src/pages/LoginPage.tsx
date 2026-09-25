"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuth';

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    useEffect(() => {
        // If user is already logged in, redirect to shops
        if (user) {
            router.replace('/shops');
        } else {
            // Redirect to home which will show auth modal
            router.replace('/');
        }
    }, [user, router]);

    return null;
}
