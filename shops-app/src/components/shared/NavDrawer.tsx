"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
    X, Home, Store, PlusCircle, ShoppingBag, Heart, Users, ShieldCheck, LayoutGrid,
    MapPin, Sun, Moon, LogIn, UserPlus, LogOut, Tag,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuth';
import { useAuthModal } from '../../store/useAuthModal';
import { useLocationStore } from '../../store/useLocation';
import { useT } from '../../lib/i18n';
import { LanguageToggle } from './LanguageToggle';
import { CurrencyToggle } from './CurrencyToggle';
import { LocationPickerModal } from './LocationPickerModal';

interface NavDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    darkMode: boolean;
    onToggleDarkMode: () => void;
}

export const NavDrawer: React.FC<NavDrawerProps> = ({ isOpen, onClose, darkMode, onToggleDarkMode }) => {
    const { user, isAuthenticated, logout } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const { city } = useLocationStore();
    const t = useT();
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

    if (!isOpen) return null;

    const navLink = (href: string, icon: React.ReactNode, label: string) => (
        <Link
            href={href}
            onClick={onClose}
            className="flex items-center gap-3.5 px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800"
        >
            {icon}
            {label}
        </Link>
    );

    return (
        <>
            <div className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="fixed inset-y-0 left-0 z-[9999] w-full max-w-xs bg-white dark:bg-neutral-950 shadow-2xl flex flex-col animate-scale-in overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-neutral-800 shrink-0">
                    <img src="/icon1.png" alt="Suqafuran" className="h-7 w-auto object-contain" />
                    <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-neutral-900 text-gray-500 cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1">
                    {navLink('/', <Home className="h-4.5 w-4.5 text-gray-400" />, t('Home'))}
                    {navLink('/home', <Store className="h-4.5 w-4.5 text-gray-400" />, 'Browse Shops')}
                    {navLink('/deals', <Tag className="h-4.5 w-4.5 text-orange-400" />, t('Deals'))}
                    {isAuthenticated ? (
                        navLink('/dashboard?tab=products', <PlusCircle className="h-4.5 w-4.5 text-gray-400" />, t('Sell'))
                    ) : (
                        <button
                            onClick={() => { openAuthModal('signin'); onClose(); }}
                            className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 cursor-pointer text-left"
                        >
                            <PlusCircle className="h-4.5 w-4.5 text-gray-400" /> {t('Sell')}
                        </button>
                    )}

                    {isAuthenticated && (
                        <>
                            {navLink('/favorites', <Heart className="h-4.5 w-4.5 text-gray-400" />, t('Favorites'))}
                            {navLink('/following', <Users className="h-4.5 w-4.5 text-gray-400" />, t('Following'))}
                            {(user?.is_agent || user?.is_admin) && navLink('/agent', <ShieldCheck className="h-4.5 w-4.5 text-gray-400" />, 'Agent Hub')}
                            {user?.is_admin && navLink('/admin', <LayoutGrid className="h-4.5 w-4.5 text-gray-400" />, 'Admin Console')}
                        </>
                    )}

                    <button
                        onClick={() => setIsLocationModalOpen(true)}
                        className="w-full flex items-center gap-3.5 px-5 py-3.5 text-sm font-bold text-gray-800 dark:text-neutral-100 hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 cursor-pointer text-left"
                    >
                        <MapPin className="h-4.5 w-4.5 text-gray-400" />
                        <span className="flex-1 truncate">{city || t('Select Location')}</span>
                    </button>
                </nav>

                <div className="p-5 space-y-3 border-t border-gray-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-2">
                        <LanguageToggle />
                        <CurrencyToggle />
                        <button
                            onClick={onToggleDarkMode}
                            className="rounded-full p-2 bg-slate-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-200 cursor-pointer shrink-0"
                        >
                            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                        </button>
                    </div>

                    {isAuthenticated ? (
                        <button
                            onClick={() => { logout(); onClose(); }}
                            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-100 dark:bg-neutral-900 text-red-500 font-black text-sm py-3 cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" /> {t('Sign Out')}
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { openAuthModal('signin'); onClose(); }}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-gray-200 dark:border-neutral-800 text-gray-800 dark:text-neutral-100 font-black text-sm py-3 cursor-pointer"
                            >
                                <LogIn className="h-4 w-4" /> {t('Sign In')}
                            </button>
                            <button
                                onClick={() => { openAuthModal('signup'); onClose(); }}
                                className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-white font-black text-sm py-3 cursor-pointer"
                            >
                                <UserPlus className="h-4 w-4" /> {t('Sign Up')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <LocationPickerModal isOpen={isLocationModalOpen} onClose={() => setIsLocationModalOpen(false)} />
        </>
    );
};
