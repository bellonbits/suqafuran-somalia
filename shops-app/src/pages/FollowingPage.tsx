"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, ShieldCheck, UserMinus } from 'lucide-react';
import { followsService } from '@/services/follows';
import { resolveMediaUrl } from '@/services/api';
import { makeShopSlug } from '@/services/listings';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import type { User } from '@/types';

function UserRow({ user, action }: { user: User; action?: React.ReactNode }) {
    const avatar = resolveMediaUrl(user.avatar_url);
    return (
        <Link
            href={`/shop/${makeShopSlug(user.business_name || user.full_name, user.id)}`}
            className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 bg-white hover:bg-slate-50 dark:bg-neutral-950 dark:border-neutral-800 dark:hover:bg-neutral-900/60"
        >
            <div className="h-11 w-11 rounded-full overflow-hidden bg-slate-100 border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 shrink-0 flex items-center justify-center text-sm font-black text-gray-500 dark:text-neutral-200">
                {avatar ? <img src={avatar} alt={user.full_name} className="h-full w-full object-cover" /> : user.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <h4 className="text-sm font-bold text-gray-900 dark:text-neutral-50 truncate">{user.full_name}</h4>
                {user.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-accent shrink-0" />}
            </div>
            {action}
        </Link>
    );
}

export default function FollowingPage() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const [tab, setTab] = useState<'followers' | 'following'>('followers');
    const [followers, setFollowers] = useState<User[]>([]);
    const [following, setFollowing] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isHydrated || !isAuthenticated) {
            setLoading(false);
            return;
        }
        Promise.all([
            followsService.getMyFollowers().catch(() => []),
            followsService.getMyFollowing().catch(() => []),
        ]).then(([f, g]) => {
            setFollowers(f);
            setFollowing(g);
        }).finally(() => setLoading(false));
    }, [isHydrated, isAuthenticated]);

    const handleUnfollow = async (userId: number) => {
        setFollowing((prev) => prev.filter((u) => u.id !== userId));
        try {
            await followsService.unfollowUser(userId);
        } catch (err) {
            console.error('Failed to unfollow', err);
        }
    };

    if (isHydrated && !isAuthenticated) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
                <Users className="h-10 w-10 text-gray-300 mx-auto" />
                <p className="font-bold text-gray-500">Sign in to see your followers and following.</p>
                <button onClick={() => openAuthModal('signin')} className="text-primary font-black hover:underline cursor-pointer">Sign In</button>
            </div>
        );
    }

    const list = tab === 'followers' ? followers : following;

    return (
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            <h1 className="text-2xl font-black text-gray-900 dark:text-neutral-50 font-poppins">Followers & Following</h1>

            <div className="flex gap-2 border-b border-gray-100 dark:border-neutral-800">
                {(['followers', 'following'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 cursor-pointer ${
                            tab === t ? 'border-primary text-primary dark:text-sky-400' : 'border-transparent text-gray-400'
                        }`}
                    >
                        {t === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-16 rounded-2xl bg-gray-100 dark:bg-neutral-950 animate-pulse" />
                    ))}
                </div>
            ) : list.length > 0 ? (
                <div className="space-y-2">
                    {list.map((u) => (
                        <UserRow
                            key={u.id}
                            user={u}
                            action={tab === 'following' ? (
                                <button
                                    onClick={(e) => { e.preventDefault(); handleUnfollow(u.id); }}
                                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold bg-slate-100 text-gray-600 hover:bg-red-50 hover:text-red-500 dark:bg-neutral-900 dark:text-neutral-200 cursor-pointer"
                                >
                                    <UserMinus className="h-3.5 w-3.5" />
                                    Unfollow
                                </button>
                            ) : undefined}
                        />
                    ))}
                </div>
            ) : (
                <p className="py-12 text-center text-sm font-semibold text-gray-400">
                    {tab === 'followers' ? 'No followers yet.' : "You're not following anyone yet."}
                </p>
            )}
        </div>
    );
}
