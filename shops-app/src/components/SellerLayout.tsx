"use client";

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, ShoppingCart, Warehouse,
  Users, MessageSquare, Megaphone, Star, BarChart3,
  DollarSign, Store, Settings, LogOut, Menu, X,
  ChevronRight, ChevronDown, Home, ArrowLeft, Zap, TrendingUp,
  ShieldCheck, FileUp, UserCog, Search, Bell, Moon, Sun,
  Command, HelpCircle, ExternalLink, Sparkles
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import { AuthModal } from '@/components/shared/AuthModal';

interface NavGroupItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
  subItems?: { label: string; href: string }[];
}

function getPageLabel(pathname: string): string {
  if (pathname === '/seller-dashboard') return 'Dashboard';
  if (pathname === '/seller-dashboard/products') return 'Products List';
  if (pathname === '/seller-dashboard/orders') return 'Orders List';
  if (pathname === '/seller-dashboard/customers') return 'Customers';
  if (pathname === '/seller-dashboard/inventory') return 'Inventory & Stock';
  if (pathname === '/seller-dashboard/messages') return 'Inbox Messages';
  if (pathname === '/seller-dashboard/analytics') return 'Analytics Report';
  if (pathname === '/seller-dashboard/subscription') return 'Subscription Plans';
  if (pathname === '/seller-dashboard/featured-ads') return 'Promotions & Ads';
  if (pathname === '/seller-dashboard/verification') return 'Shop Verification';
  if (pathname === '/seller-dashboard/products/bulk-import') return 'Bulk Import';
  if (pathname === '/seller-dashboard/products/add') return 'Add Product';
  if (pathname === '/seller-dashboard/settings/staff') return 'Staff Accounts';
  if (pathname === '/seller-dashboard/settings') return 'Settings';
  return 'Seller Hub';
}

export const SellerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  // Was local-only state (useState(false)), disconnected from the rest of
  // the app's dark mode -- toggling dark mode on the homepage and then
  // navigating here reset it back to light, and this component's own root
  // div carried both the `dark` toggle class and `dark:bg-*` utilities on
  // itself, which Tailwind never applies (the dark: selector needs `dark`
  // on an ANCESTOR, not the same element) -- descendants went dark
  // correctly, but this root div's own background stayed stuck white.
  // Reading/writing the same document.documentElement + localStorage
  // mechanism Header.tsx uses fixes both problems at once.
  const [darkMode, setDarkMode] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false
  );
  const [expandedSection, setExpandedSection] = useState<string | null>('My Shop');
  const [searchQuery, setSearchQuery] = useState('');

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const currentPageLabel = getPageLabel(pathname);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.innerWidth < 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleSection = (label: string) => {
    setExpandedSection(prev => (prev === label ? null : label));
  };

  // SadaxCart navigation structure
  const mainMenu: NavGroupItem[] = [
    { label: 'Home', icon: <Home className="w-4 h-4" />, href: '/seller-dashboard' },
    {
      label: 'My Shop',
      icon: <Store className="w-4 h-4" />,
      href: '/seller-dashboard/products',
      subItems: [
        { label: 'Products', href: '/seller-dashboard/products' },
        { label: 'Orders', href: '/seller-dashboard/orders' },
        { label: 'Customers', href: '/seller-dashboard/customers' },
        { label: 'Inventory', href: '/seller-dashboard/inventory' },
      ],
    },
    {
      label: 'Shop Management',
      icon: <Package className="w-4 h-4" />,
      href: '/seller-dashboard/shop',
      subItems: [
        { label: 'Shop Profile', href: '/seller-dashboard/shop' },
        { label: 'Staff Accounts', href: '/seller-dashboard/settings/staff' },
        { label: 'Verification', href: '/seller-dashboard/verification' },
        { label: 'Bulk Import', href: '/seller-dashboard/products/bulk-import' },
      ],
    },
    { label: 'Analytics Report', icon: <BarChart3 className="w-4 h-4" />, href: '/seller-dashboard/analytics' },
    { label: 'Inbox', icon: <MessageSquare className="w-4 h-4" />, href: '/seller-dashboard/messages' },
  ];

  const othersMenu: NavGroupItem[] = [
    { label: 'Promotion', icon: <Megaphone className="w-4 h-4" />, href: '/seller-dashboard/featured-ads', badge: 'PRO' },
    { label: 'Subscription', icon: <Zap className="w-4 h-4" />, href: '/seller-dashboard/subscription', badge: 'PRO' },
    { label: 'Settings', icon: <Settings className="w-4 h-4" />, href: '/seller-dashboard/settings' },
    { label: 'Help & Support', icon: <HelpCircle className="w-4 h-4" />, href: '/seller-dashboard/reports' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-800 dark:text-neutral-50 font-sans antialiased flex flex-col md:flex-row p-3 md:p-5 gap-5 overflow-x-hidden">

      {/* ── Desktop Floating Sidebar (SadaxCart style) ── */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-neutral-950 rounded-3xl p-4 border border-slate-100 dark:border-neutral-800 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex-shrink-0 relative z-30 transition-colors">
        {/* Brand Header */}
        <div
          className="flex items-center gap-3 px-2 py-2 mb-4 cursor-pointer group"
          onClick={() => navigate('/seller-dashboard')}
        >
          <div className="w-9 h-9 rounded-2xl bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight block leading-tight">
              {user?.business_name || 'Suqafuran'}
            </span>
            <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Seller Studio</span>
          </div>
        </div>

        {/* Sidebar Search Input (SadaxCart ⌘ + S pill) */}
        <div className="relative mb-5 px-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl pl-9 pr-10 py-2 text-xs text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-extrabold text-slate-400 bg-slate-200/60 dark:bg-neutral-800 px-1 py-0.5 rounded-md">
            ⌘ S
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1">
          {/* Main Menu */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2">
              Main Menu
            </p>
            <nav className="space-y-1">
              {mainMenu.map((item, idx) => {
                const isExpanded = expandedSection === item.label;
                const hasSub = item.subItems && item.subItems.length > 0;
                const isActive = pathname === item.href || (hasSub && item.subItems!.some(sub => pathname === sub.href));

                if (hasSub) {
                  return (
                    <div key={idx} className="space-y-1">
                      <button
                        onClick={() => toggleSection(item.label)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs md:text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-slate-100 dark:bg-neutral-900 text-slate-900 dark:text-white font-bold'
                            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={isActive ? 'text-sky-500' : 'text-slate-400'}>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="pl-9 space-y-1 overflow-hidden"
                          >
                            {item.subItems!.map((sub, sIdx) => {
                              const isSubActive = pathname === sub.href;
                              return (
                                <Link
                                  key={sIdx}
                                  to={sub.href}
                                  className={`block px-3 py-2 rounded-xl text-xs transition-colors ${
                                    isSubActive
                                      ? 'text-sky-600 dark:text-teal-400 font-extrabold bg-sky-50 dark:bg-teal-950/30'
                                      : 'text-slate-500 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }

                return (
                  <Link
                    key={idx}
                    to={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs md:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                        : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Others Menu */}
          <div>
            <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2">
              Others
            </p>
            <nav className="space-y-1">
              {othersMenu.map((item, idx) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={idx}
                    to={item.href}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs md:text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/20'
                        : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900/60 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-sky-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section (Upgrade to Premium & Profile Widget) */}
        <div className="pt-4 border-t border-slate-100 dark:border-neutral-800/80 space-y-3 flex-shrink-0">
          
          {/* Upgrade to Premium Card */}
          <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 p-4 rounded-3xl text-white shadow-lg shadow-sky-500/20 relative overflow-hidden group">
            <div className="absolute -right-3 -bottom-3 w-16 h-16 rounded-full bg-white/10 blur-sm pointer-events-none group-hover:scale-125 transition-transform" />
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-[10px] font-extrabold tracking-wider uppercase bg-white/20 px-2 py-0.5 rounded-full">PRO SELLER</span>
            </div>
            <p className="text-xs font-black text-white leading-tight">Upgrade to Premium</p>
            <p className="text-[10px] text-sky-100 mt-1 leading-relaxed">
              Get unlimited product listings, verified seller badge & priority search ranking.
            </p>
            <button
              onClick={() => navigate('/seller-dashboard/subscription')}
              className="mt-3 w-full py-2 bg-white text-sky-600 hover:bg-sky-50 rounded-2xl text-xs font-extrabold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1"
            >
              <span>Upgrade Now</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Profile Widget */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-neutral-900/40 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl p-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={user.full_name || 'Seller'} className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                  {user?.full_name?.charAt(0).toUpperCase() || 'S'}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 dark:text-neutral-50 truncate">{user?.full_name || 'Store Owner'}</p>
                <p className="text-[10px] text-slate-400 truncate">Store Manager</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile Top Bar (Phone Responsive Header) ── */}
      <header className="md:hidden flex items-center justify-between bg-white dark:bg-neutral-950 px-4 py-3 rounded-2xl border border-slate-100 dark:border-neutral-800 shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-slate-600 dark:text-neutral-200 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-sky-500 flex items-center justify-center text-white font-extrabold text-xs">
              <Store className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{currentPageLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-900 text-slate-500 dark:text-neutral-300"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* ── Mobile Slide-over Drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)' }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white dark:bg-neutral-950 z-50 p-5 flex flex-col justify-between shadow-2xl md:hidden overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-sky-500 flex items-center justify-center text-white">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-slate-900 dark:text-white">{user?.business_name || 'Suqafuran'}</p>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Seller Studio</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-slate-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Mobile Navigation List */}
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main Menu</p>
                    <div className="space-y-1">
                      {mainMenu.map((item, idx) => (
                        <Link
                          key={idx}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold ${
                            pathname === item.href
                              ? 'bg-sky-500 text-white font-bold'
                              : 'text-slate-600 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Others</p>
                    <div className="space-y-1">
                      {othersMenu.map((item, idx) => (
                        <Link
                          key={idx}
                          to={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-semibold ${
                            pathname === item.href
                              ? 'bg-sky-500 text-white font-bold'
                              : 'text-slate-600 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900'
                          }`}
                        >
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Drawer Logout */}
              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800">
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Canvas Viewport ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden mb-16 md:mb-0">
        {/* Desktop Header Navigation Bar */}
        <header className="hidden md:flex items-center justify-between py-2 px-1 mb-5">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link to="/seller-dashboard" className="flex items-center gap-1 hover:text-sky-600 font-semibold">
              <Home className="w-3.5 h-3.5" /> <span>Home</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-extrabold text-slate-800 dark:text-neutral-50">{currentPageLabel}</span>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Global Search Input with ⌘ K Shortcut */}
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                placeholder="Search orders, products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl pl-10 pr-12 py-2 text-xs text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500/20 shadow-sm w-48 lg:w-64 transition-all"
              />
              <div className="absolute right-3 flex items-center gap-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded-md">
                <Command className="w-2.5 h-2.5" /> K
              </div>
            </div>

            {/* Dark Mode Switcher */}
            <button
              onClick={toggleDarkMode}
              className="p-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <Link to="/seller-dashboard/messages">
              <button className="relative p-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm transition-colors">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 bg-sky-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                  3
                </span>
              </button>
            </Link>

            {/* Back to Marketplace */}
            <Link
              to="/"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-xs font-bold text-slate-600 dark:text-neutral-200 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span>Back to Marketplace</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          </div>
        </header>

        {/* Dynamic Inner Page Canvas */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          {children}
        </main>
      </div>

      {/* ── Mobile Fixed Bottom Navigation Bar (Ultra Phone Responsive) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-neutral-800 px-4 py-2 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-safe">
        {[
          { label: 'Home', icon: Home, href: '/seller-dashboard' },
          { label: 'Products', icon: Package, href: '/seller-dashboard/products' },
          { label: 'Orders', icon: ShoppingCart, href: '/seller-dashboard/orders' },
          { label: 'Inbox', icon: MessageSquare, href: '/seller-dashboard/messages' },
          { label: 'Settings', icon: Settings, href: '/seller-dashboard/settings' },
        ].map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;
          return (
            <Link
              key={idx}
              to={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-2xl transition-all ${
                isActive ? 'text-sky-600 dark:text-teal-400 font-extrabold scale-105' : 'text-slate-400 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-500' : ''}`} />
              <span className="text-[10px]">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <AuthModal />
    </div>
  );
};
