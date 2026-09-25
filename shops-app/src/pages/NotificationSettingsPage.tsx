"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Loader2, Check, MessageSquare, Tag, Search, Newspaper, Megaphone, Store, ShieldCheck, Gift } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/useAuth';

interface Preferences {
    new_messages: boolean;
    listing_updates: boolean;
    price_drops: boolean;
    saved_search_matches: boolean;
    marketplace_digest: boolean;
    promotional_emails: boolean;
    seller_tips: boolean;
    verification_campaigns: boolean;
    seasonal_campaigns: boolean;
}

const TOGGLES: { key: keyof Preferences; icon: React.ElementType; title: string; description: string }[] = [
    { key: 'new_messages', icon: MessageSquare, title: 'New messages', description: 'When a buyer or seller messages you' },
    { key: 'listing_updates', icon: Tag, title: 'Listing updates', description: 'Approvals, rejections, and status changes on your listings' },
    { key: 'price_drops', icon: Tag, title: 'Price drops', description: 'When something you saved gets cheaper' },
    { key: 'saved_search_matches', icon: Search, title: 'Saved search matches', description: 'New listings matching a search you saved' },
    { key: 'marketplace_digest', icon: Newspaper, title: 'Weekly digest', description: "A weekly roundup of what's new on Suqafuran" },
    { key: 'promotional_emails', icon: Megaphone, title: 'Promotions & recommendations', description: 'Trending items, personalized picks, shop spotlights' },
    { key: 'seller_tips', icon: Store, title: 'Seller tips', description: 'Advice for growing your shop, if you sell on Suqafuran' },
    { key: 'verification_campaigns', icon: ShieldCheck, title: 'Verification reminders', description: 'Nudges to verify your account or shop' },
    { key: 'seasonal_campaigns', icon: Gift, title: 'Seasonal offers', description: 'Holiday and seasonal promotions' },
];

export default function NotificationSettingsPage() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const [prefs, setPrefs] = useState<Preferences | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isHydrated) return;
        api.get('/marketing/email-preferences')
            .then((res) => setPrefs(res.data))
            .catch(() => setError('Could not load your notification settings.'))
            .finally(() => setLoading(false));
    }, [isHydrated]);

    const toggle = async (key: keyof Preferences) => {
        if (!prefs) return;
        const next = { ...prefs, [key]: !prefs[key] };
        setPrefs(next);
        setSavingKey(key);
        try {
            await api.put('/marketing/email-preferences', { [key]: next[key] });
        } catch {
            setPrefs(prefs);
            setError('Failed to save -- please try again.');
        } finally {
            setSavingKey(null);
        }
    };

    if (!isHydrated || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-[#6cd4ff]" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <p className="text-gray-600 dark:text-neutral-300">Sign in to manage your notification settings.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black pt-20 pb-32">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4" /> Back to Account
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-2xl bg-[#e0f7ff] dark:bg-sky-950/40">
                        <Bell className="w-5 h-5 text-[#0ea5e9]" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Notification Settings</h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mb-8">
                    Choose which emails you'd like to receive from Suqafuran. Transactional emails needed to run your account (like password resets) always go through.
                </p>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="space-y-3">
                    {TOGGLES.map(({ key, icon: Icon, title, description }) => (
                        <div
                            key={key}
                            className="flex items-center gap-4 p-5 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-sm"
                        >
                            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 shrink-0">
                                <Icon className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-900 dark:text-white text-sm">{title}</p>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{description}</p>
                            </div>
                            <button
                                role="switch"
                                aria-checked={!!prefs?.[key]}
                                aria-label={title}
                                onClick={() => toggle(key)}
                                disabled={savingKey === key}
                                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${
                                    prefs?.[key] ? 'bg-[#00a082]' : 'bg-gray-200 dark:bg-neutral-800'
                                } disabled:opacity-60`}
                            >
                                <span
                                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform flex items-center justify-center ${
                                        prefs?.[key] ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                >
                                    {savingKey === key && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
                                    {savingKey !== key && prefs?.[key] && <Check className="w-3 h-3 text-[#00a082]" />}
                                </span>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
