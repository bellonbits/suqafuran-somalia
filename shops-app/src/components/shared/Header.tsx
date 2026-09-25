"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Sun, Moon, MapPin, Plus, Bell, User, Menu, X, LogOut, Store, ShoppingCart, LayoutDashboard, Shield, MessageSquare, Settings, ChevronRight, CircleUser } from 'lucide-react';
import { useAuthStore } from '../../store/useAuth';
import { useAuthModal } from '../../store/useAuthModal';
import { useLocationStore } from '../../store/useLocation';
import { useCart } from '../../store/useCart';
import { useT } from '../../lib/i18n';
import { LocationPickerModal } from './LocationPickerModal';
import NotificationCenter from '../NotificationCenter';
import { NotificationBell } from './NotificationBell';
import { LanguageToggle } from './LanguageToggle';
import api, { resolveMediaUrl } from '../../services/api';

export const Header: React.FC = () => {
    const router = useRouter();
    const { user, isAuthenticated, logout } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const { city } = useLocationStore();
    const { getTotalCount } = useCart();
    const t = useT();
    const [searchQuery, setSearchQuery] = useState('');
    // Always default to light theme unless explicitly saved as dark
    const [darkMode, setDarkMode] = useState(
        typeof window !== 'undefined'
            ? localStorage.getItem('theme') === 'dark'
            : false
    );
    const [scrolled, setScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);
    const [userRole, setUserRole] = useState<'admin' | 'agent' | 'seller' | null>(null);
    const [cartOpen, setCartOpen] = useState(false);
    const cartCount = getTotalCount();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleScroll = () => {
                setScrolled(window.scrollY > 10);
            };
            window.addEventListener('scroll', handleScroll, { passive: true });
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, []);

    useEffect(() => {
        if (isAuthenticated && user) {
            const fetchUserStatus = async () => {
                try {
                    // Check seller status
                    const sellerResponse = await api.get(`/sellers/${user.id}/is-seller`);
                    setIsVerifiedSeller(sellerResponse.data?.is_seller === true);

                    // Check user role (admin, agent, seller, etc.)
                    let detectedRole: 'admin' | 'agent' | 'seller' | null = null;
                    
                    // Try /users/me endpoint
                    const roleResponse = await api.get('/users/me').catch(() => null);
                    if (roleResponse?.data?.role) {
                        detectedRole = roleResponse.data.role;
                    }
                    
                    // Fallback: check email for admin/agent keywords
                    if (!detectedRole && user.email) {
                        if (user.email.includes('admin')) detectedRole = 'admin';
                        else if (user.email.includes('agent')) detectedRole = 'agent';
                    }
                    
                    // Fallback: check user object for role properties
                    if (!detectedRole) {
                        if ((user as any).is_admin || (user as any).role === 'admin') detectedRole = 'admin';
                        else if ((user as any).is_agent || (user as any).role === 'agent') detectedRole = 'agent';
                    }
                    
                    setUserRole(detectedRole);

                } catch (error) {
                    setIsVerifiedSeller(false);
                    setUserRole(null);
                }
            };
            fetchUserStatus();
        } else {
            setIsVerifiedSeller(false);
            setUserRole(null);
        }
    }, [isAuthenticated, user?.id]);

    const toggleDarkMode = () => {
        const nextMode = !darkMode;
        setDarkMode(nextMode);
        if (nextMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    return (
        <>
            <header
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
                className={`fixed top-0 inset-x-0 z-50 w-full bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-neutral-800/60 transition-all duration-200 ${scrolled ? 'shadow-md shadow-slate-900/5 dark:shadow-black/20' : 'shadow-sm'}`}
            >
                <div className="max-w-[1440px] mx-auto px-4 md:px-8 h-12 md:h-16 flex items-center justify-between gap-2">

                    {/* Left: Logo + Location */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
                        <Link href="/" className="flex items-center hover:opacity-85 transition-opacity shrink-0">
                            <img src="/icon1.png" alt="Suqafuran" className="h-8 sm:h-9 md:h-10 w-auto object-contain" />
                        </Link>

                        {/* Location Selector - Compact Pill - Visible on all screens */}
                        <button
                            onClick={() => setIsLocationModalOpen(true)}
                            aria-label={city ? `Location: ${city}` : 'Choose location'}
                            className="flex items-center gap-1.5 sm:gap-2 px-2 md:px-3 py-1.5 sm:py-2 rounded-full min-w-0 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors border border-gray-200 dark:border-neutral-800"
                        >
                            <MapPin className="w-4 h-4 text-orange-600 dark:text-orange-500 shrink-0" />
                            <span className="hidden min-[380px]:inline text-xs font-medium text-gray-700 dark:text-neutral-200 truncate max-w-[64px] sm:max-w-[100px] md:max-w-[150px]">
                                {city || t('Location')}
                            </span>
                        </button>
                    </div>

                    {/* Center: Search Bar - Dominant Element */}
                    <form
                        onSubmit={handleSearchSubmit}
                        className="hidden md:flex items-center flex-1 mx-8 max-w-2xl"
                    >
                        <div className="relative w-full">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search products, shops, services..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 rounded-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-gray-900 dark:text-white text-sm font-medium placeholder:text-gray-500 dark:placeholder:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </form>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0">
                        {/* Language Selector -- compact on phones */}
                        <LanguageToggle compact className="sm:hidden" />
                        <div className="hidden sm:flex items-center">
                            <LanguageToggle />
                        </div>

                        {/* Dark Mode - Icon Only */}
                        <button
                            onClick={toggleDarkMode}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors hidden sm:flex"
                            aria-label="Toggle dark mode"
                            title="Toggle dark mode"
                        >
                            {darkMode ? (
                                <Sun className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                            ) : (
                                <Moon className="w-5 h-5 text-gray-600" />
                            )}
                        </button>

                        {/* Notifications Bell */}
                        <div className="hidden lg:block">
                            <NotificationBell />
                        </div>

                        {/* Messages - Icon Only */}
                        <button
                            onClick={() => router.push('/messages')}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors relative hidden lg:flex"
                            title="Messages"
                        >
                            <MessageSquare className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full"></span>
                        </button>

                        {/* Cart - Icon Only with Badge. Visible on mobile by
                        default (not hidden behind sm:/md: like the other
                        header controls) -- the cart is a primary action, not
                        secondary chrome that belongs behind the hamburger
                        menu. */}
                        <button
                            onClick={() => router.push('/checkout')}
                            className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors relative flex items-center justify-center"
                            title="Cart"
                        >
                            <ShoppingCart className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                            {cartCount > 0 && (
                                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-orange-600 text-white rounded-full">
                                    {cartCount}
                                </span>
                            )}
                        </button>

                        {/* Sell Button - Outlined */}
                        {isVerifiedSeller ? (
                            <button
                                onClick={() => router.push('/seller-dashboard/products')}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors border border-orange-600 dark:border-orange-500 flex items-center justify-center hidden sm:flex"
                                title="Seller dashboard"
                            >
                                <Plus className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                            </button>
                        ) : (
                            <button
                                onClick={() => router.push('/seller-dashboard')}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors border border-orange-600 dark:border-orange-500 flex items-center justify-center hidden sm:flex"
                                title="Start selling"
                            >
                                <Store className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                            </button>
                        )}

                        {/* Auth Section */}
                        {isAuthenticated && user ? (
                            <div className="relative hidden sm:block">
                                <button
                                    onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                                    className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center"
                                    title="Profile menu"
                                >
                                    {resolveMediaUrl((user as any).avatar_url) ? (
                                        <img
                                            src={resolveMediaUrl((user as any).avatar_url)!}
                                            alt={user.full_name}
                                            className="w-8 h-8 rounded-full object-cover"
                                            onError={(e) => {
                                                (e.currentTarget as HTMLElement).style.display = 'none';
                                                const fallback = e.currentTarget.parentElement?.querySelector('.avatar-header-fallback') as HTMLElement;
                                                if (fallback) fallback.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div
                                        className="avatar-header-fallback w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold"
                                        style={{ display: resolveMediaUrl((user as any).avatar_url) ? 'none' : 'flex' }}
                                    >
                                        {user.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                </button>

                                {profileMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-950 rounded-lg shadow-lg border border-gray-200 dark:border-neutral-800 z-50">
                                        <div className="p-3 border-b border-gray-100 dark:border-neutral-800">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.full_name}</p>
                                            <p className="text-xs text-gray-500 dark:text-neutral-300">{(user as any).phone || user.email}</p>
                                        </div>
                                        <div className="p-2 space-y-1">
                                            <button
                                                onClick={() => {
                                                    router.push('/account');
                                                    setProfileMenuOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded"
                                            >
                                                Profile
                                            </button>

                                            {userRole === 'admin' && (
                                                <button
                                                    onClick={() => {
                                                        router.push('/admin-dashboard');
                                                        setProfileMenuOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded flex items-center gap-2"
                                                >
                                                    <Shield className="w-4 h-4" />
                                                    Admin Dashboard
                                                </button>
                                            )}

                                            {(userRole === 'admin' || userRole === 'agent') && (
                                                <button
                                                    onClick={() => {
                                                        router.push('/agent-dashboard');
                                                        setProfileMenuOpen(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded flex items-center gap-2"
                                                >
                                                    <LayoutDashboard className="w-4 h-4" />
                                                    Agent Dashboard
                                                </button>
                                            )}

                                            {isVerifiedSeller && (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            router.push('/seller-profile');
                                                            setProfileMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded flex items-center gap-2"
                                                    >
                                                        <User className="w-4 h-4" />
                                                        Seller Profile
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            router.push('/seller-dashboard');
                                                            setProfileMenuOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded flex items-center gap-2"
                                                    >
                                                        <Store className="w-4 h-4" />
                                                        Seller Dashboard
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                onClick={() => {
                                                    logout();
                                                    setProfileMenuOpen(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="hidden sm:flex items-center gap-2">
                                <button
                                    onClick={() => openAuthModal('signin')}
                                    className="px-4 py-2 text-sm font-semibold bg-sky-400 hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-lg transition-colors"
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => openAuthModal('signup')}
                                    className="px-4 py-2 text-sm font-semibold bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-700 text-white rounded-lg transition-colors"
                                >
                                    Sign Up
                                </button>
                            </div>
                        )}

                        {/* Search - compact icon on mobile, since the full
                        search bar now lives prominently in the homepage hero
                        instead of being tucked inside the hamburger menu. */}
                        <button
                            onClick={() => router.push('/search')}
                            className="hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                            aria-label="Search"
                            title="Search"
                        >
                            <Search className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
                        </button>

                        {/* Mobile Menu */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={isMobileMenuOpen}
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Location Modal - Outside header for proper fixed positioning */}
            <LocationPickerModal
                isOpen={isLocationModalOpen}
                onClose={() => setIsLocationModalOpen(false)}
            />

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <>
                    <div
                        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-black/40"
                        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div
                        className="md:hidden fixed inset-x-0 z-40 bg-white dark:bg-neutral-950 border-b border-gray-100 dark:border-neutral-800 px-4 py-3 space-y-2 max-h-[75vh] overflow-y-auto shadow-lg"
                        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
                    >
                    {/* Language, location, search and cart already live in the
                        header/home page, so the menu only holds what doesn't:
                        theme, account pages and sign-in. */}
                    <div className="flex items-center justify-between h-12 px-3">
                        <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">{t('Appearance')}</span>
                        <div
                            className="inline-flex items-center rounded-full p-1 bg-slate-100 dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800"
                            role="radiogroup"
                            aria-label={t('Appearance')}
                        >
                            {[
                                { dark: false, label: t('Light'), Icon: Sun },
                                { dark: true, label: t('Dark'), Icon: Moon },
                            ].map(({ dark, label, Icon }) => {
                                const active = darkMode === dark;
                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => { if (!active) toggleDarkMode(); }}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                                            active
                                                ? 'bg-white text-gray-950 shadow-sm dark:bg-neutral-800 dark:text-white'
                                                : 'text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="border-t border-gray-100 dark:border-neutral-800" />

                    {isAuthenticated && user && (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                                {resolveMediaUrl((user as any).avatar_url) ? (
                                    <img src={resolveMediaUrl((user as any).avatar_url)!} alt={user.full_name} className="w-full h-full object-cover" />
                                ) : (
                                    user.full_name?.charAt(0).toUpperCase()
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.full_name}</p>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{(user as any).phone || user.email}</p>
                            </div>
                        </div>
                    )}

                    <nav className="space-y-1">
                        {[
                            { href: '/account', label: t('Profile'), Icon: CircleUser, show: true },
                            { href: '/settings', label: t('Settings'), Icon: Settings, show: true },
                            { href: '/seller-dashboard', label: t('Seller Dashboard'), Icon: Store, show: isAuthenticated && isVerifiedSeller },
                            { href: '/agent-dashboard', label: t('Agent Dashboard'), Icon: LayoutDashboard, show: isAuthenticated && (userRole === 'admin' || userRole === 'agent') },
                            { href: '/admin-dashboard', label: t('Admin Dashboard'), Icon: Shield, show: isAuthenticated && userRole === 'admin' },
                        ].filter((item) => item.show).map(({ href, label, Icon }) => (
                            <button
                                key={href}
                                onClick={() => { router.push(href); setIsMobileMenuOpen(false); }}
                                className="w-full h-12 flex items-center gap-3 px-3 rounded-xl text-gray-800 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                            >
                                <Icon className="w-5 h-5 text-gray-500 dark:text-neutral-400 shrink-0" />
                                <span className="flex-1 text-left text-sm font-medium">{label}</span>
                                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                            </button>
                        ))}
                    </nav>

                    <div className="border-t border-gray-100 dark:border-neutral-800" />

                    {isAuthenticated ? (
                        <button
                            onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                            className="w-full h-12 flex items-center gap-3 px-3 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                            <LogOut className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-semibold">{t('Sign Out')}</span>
                        </button>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { openAuthModal('signin'); setIsMobileMenuOpen(false); }}
                                className="h-11 text-sm font-semibold bg-sky-400 text-white rounded-xl hover:bg-sky-500 transition-colors"
                            >
                                {t('Sign In')}
                            </button>
                            <button
                                onClick={() => { openAuthModal('signup'); setIsMobileMenuOpen(false); }}
                                className="h-11 text-sm font-semibold bg-orange-600 text-white rounded-xl hover:bg-orange-700 transition-colors"
                            >
                                {t('Sign Up')}
                            </button>
                        </div>
                    )}
                    </div>
                </>
            )}
        </>
    );
};
