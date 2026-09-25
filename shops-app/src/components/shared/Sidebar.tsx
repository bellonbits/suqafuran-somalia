"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Tag, LogIn } from 'lucide-react';
import { useAuthStore } from '../../store/useAuth';
import { useAuthModal } from '../../store/useAuthModal';
import { useSidebarStore } from '../../store/useSidebar';
import { getCategoryIcon } from '../../lib/categoryIcons';

/* ─────────────────────────────────────────────────────────────────────────────
   CANONICAL PLATFORM CATEGORIES
   These are the 17 fixed marketplace categories used across the platform.
   Each maps to a route slug and a display label.
───────────────────────────────────────────────────────────────────────────── */
export const CANONICAL_CATEGORIES = [
    { name: 'Commercial Equipment', slug: 'commercial-equipment' },
    { name: 'Electronics',          slug: 'electronics' },
    { name: 'Land & Farms',         slug: 'land-farms' },
    { name: 'Leisure & Sports',     slug: 'leisure-sports' },
    { name: 'Repair & Construction',slug: 'repair-construction' },
    { name: 'Food & Groceries',     slug: 'food-groceries' },
    { name: 'Beauty & Personal Care', slug: 'beauty-personal-care' },
    { name: 'Clothing & Shoes',     slug: 'clothing-shoes' },
    { name: 'Household Items',      slug: 'household-items' },
    { name: 'Vehicles',             slug: 'vehicles' },
    { name: 'Livestock',            slug: 'livestock' },
    { name: 'Property',             slug: 'property' },
    { name: 'Services',             slug: 'services' },
    { name: 'Jobs',                 slug: 'jobs' },
    { name: 'Agriculture & Food',   slug: 'agriculture-food' },
    { name: 'Phones',               slug: 'phones' },
    { name: 'Babies & Kids',        slug: 'babies-kids' },
] as const;

const STATIC_ITEMS = [
    { name: 'Home',  path: '/home',  icon: Home },
    { name: 'Deals', path: '/deals', icon: Tag  },
];

export const Sidebar: React.FC = () => {
    const pathname = usePathname();
    const { isAuthenticated } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const collapsed = useSidebarStore((s) => s.collapsed);

    // Hide on workspace routes — these have their own nav
    const isWorkspaceRoute =
        pathname.startsWith('/admin') ||
        pathname.startsWith('/agent') ||
        pathname.startsWith('/dashboard');
    if (isWorkspaceRoute) return null;

    const categoryItems = CANONICAL_CATEGORIES.map(cat => ({
        name: cat.name,
        path: `/${cat.slug}`,
        icon: getCategoryIcon(cat.slug),
    }));

    const allItems = [...STATIC_ITEMS, ...categoryItems];

    return (
        <aside
            className={`${
                collapsed ? 'w-16' : 'w-60'
            } border-r border-gray-100 bg-white hidden md:flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 dark:border-neutral-800 dark:bg-neutral-950 overflow-y-auto shrink-0 pb-6 scrollbar-thin scrollbar-thumb-gray-200 transition-all duration-200`}
        >
            <div className="py-4 space-y-0.5">
                {allItems.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');

                    return (
                        <Link
                            key={idx}
                            href={item.path}
                            title={collapsed ? item.name : undefined}
                            className={`relative flex items-center text-xs font-semibold transition-all ${
                                collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-5 py-2.5'
                            } ${
                                isActive
                                    ? 'text-[#FF3008] bg-red-50/60 dark:bg-red-500/10 dark:text-red-400 font-bold'
                                    : 'text-gray-600 hover:bg-slate-50 hover:text-gray-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-50'
                            }`}
                        >
                            {/* Active indicator bar */}
                            {isActive && (
                                <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#FF3008] dark:bg-red-400 rounded-r" />
                            )}
                            <Icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span className="leading-tight">{item.name}</span>}
                        </Link>
                    );
                })}
            </div>

            {!isAuthenticated && (
                <div className={`${collapsed ? 'px-2' : 'px-5'} pt-4 border-t border-gray-100 dark:border-neutral-800`}>
                    <button
                        onClick={() => openAuthModal('signin')}
                        title={collapsed ? 'Sign up or Login' : undefined}
                        className={`flex items-center text-xs font-bold text-gray-700 hover:text-[#FF3008] dark:text-neutral-100 dark:hover:text-red-400 cursor-pointer ${
                            collapsed ? 'justify-center w-full' : 'gap-3'
                        }`}
                    >
                        <LogIn className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Sign up or Login</span>}
                    </button>
                </div>
            )}
        </aside>
    );
};
