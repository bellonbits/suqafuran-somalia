import React, { useState, useEffect } from 'react';
import Image from '@/shims/next-image';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Package, Users, Settings, LogOut, Menu, X,
  BarChart3, Wallet, Truck, Store, ShoppingCart, MessageSquare,
  Bell, Search, ChevronDown, ChevronRight, Home, Moon, Command,
  CheckCircle, AlertTriangle, Clock, Sparkles, Check, ExternalLink
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: number;
  subItems?: { label: string; href: string }[];
}

interface NotificationItem {
  id: string | number;
  title: string;
  message: string;
  time?: string;
  type?: 'alert' | 'order' | 'promotion' | 'verification' | 'info';
  href?: string;
  read: boolean;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  navItems: NavItem[];
  userRole?: 'admin' | 'agent' | 'seller' | 'rider' | 'user';
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title = "Dashboard",
  navItems,
  userRole = 'admin',
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  // Was local-only state, disconnected from the rest of the app's dark mode
  // (same bug as SellerLayout.tsx had) -- toggling dark mode elsewhere and
  // navigating into admin/agent pages (both use this shared layout) reset
  // it back to light every time. Reading/writing the same
  // document.documentElement + localStorage mechanism Header.tsx uses
  // keeps it in sync everywhere.
  const [darkMode, setDarkMode] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('theme') === 'dark' : false
  );
  const [expandedNav, setExpandedNav] = useState<string | null>('Orders');
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

  const fetchAdminNotifications = async () => {
    try {
      const items: NotificationItem[] = [];

      // 1. Fetch system stats for admin pending alerts
      if (userRole === 'admin') {
        const statsRes = await api.get('/admin/stats').catch(() => null);
        if (statsRes?.data) {
          const stats = statsRes.data;
          if (stats.pending_listings > 0) {
            items.push({
              id: 'sys-pending-listings',
              title: 'Pending Listings',
              message: `${stats.pending_listings} listing${stats.pending_listings > 1 ? 's' : ''} awaiting moderation approval`,
              type: 'alert',
              href: '/admin-listings',
              read: false,
              time: 'Action required'
            });
          }
          if (stats.pending_promotions > 0) {
            items.push({
              id: 'sys-pending-promos',
              title: 'Pending Promotions',
              message: `${stats.pending_promotions} campaign${stats.pending_promotions > 1 ? 's' : ''} pending review`,
              type: 'promotion',
              href: '/admin-marketing',
              read: false,
              time: 'Action required'
            });
          }
        }
      }

      // 2. Fetch in-app user notifications
      const notifRes = await api.get('/notifications/?limit=15').catch(() => null);
      if (notifRes?.data && Array.isArray(notifRes.data)) {
        notifRes.data.forEach((n: any) => {
          const payload = n.data || {};
          const notifTitle = n.title || payload.title || (n.type ? n.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : 'Notification');
          const notifMessage = n.message || payload.message || payload.body || payload.text || 'System update event';
          items.push({
            id: n.id,
            title: notifTitle,
            message: notifMessage,
            time: n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
            type: n.type === 'alert' || n.type === 'issue' ? 'alert' : n.type === 'promotion' ? 'promotion' : 'info',
            href: n.action_url || payload.action_url || payload.href || undefined,
            read: n.is_read === true || n.status === 'read' || n.read === true
          });
        });
      }

      setNotifications(items);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  useEffect(() => {
    fetchAdminNotifications();
    const interval = setInterval(fetchAdminNotifications, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await api.post('/notifications/read-all').catch(() => null);
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const toggleSubmenu = (label: string) => {
    setExpandedNav(prev => (prev === label ? null : label));
  };

  return (
    <div className={`min-h-screen bg-[#F3F4F8] text-[#1E293B] font-sans antialiased flex flex-col md:flex-row p-3 md:p-5 gap-5 overflow-x-hidden ${darkMode ? 'dark bg-black text-white' : ''}`}>

      {/* ── Mobile Sidebar Overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-3 left-3 bottom-3 w-[280px] bg-white dark:bg-neutral-950 rounded-3xl p-4 shadow-2xl border border-slate-100 dark:border-neutral-800 flex flex-col z-50 md:hidden overflow-y-auto"
            >
              {/* Mobile Close Button */}
              <div className="flex items-center justify-between px-2 py-2 mb-4">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { router.push('/admin-dashboard'); setMobileOpen(false); }}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name || 'Admin'} className="w-9 h-9 rounded-2xl object-cover flex-shrink-0 ring-2 ring-indigo-100" />
                  ) : (
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-indigo-400 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0">
                      {user?.full_name?.charAt(0).toUpperCase() || 'A'}
                    </div>
                  )}
                  <div>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight block leading-tight">
                      {user?.full_name?.split(' ')[0] || 'Admin'}
                    </span>
                    <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Admin Panel</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-neutral-900 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Nav Items */}
              <div className="flex-1 space-y-1 pr-1">
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Main</p>
                <nav className="space-y-1">
                  {navItems.map((item, idx) => {
                    const isActive = pathname === item.href;
                    return (
                      <button
                        key={idx}
                        onClick={() => { router.push(item.href); setMobileOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-neutral-900 font-bold shadow-md'
                            : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900/60'
                        }`}
                      >
                        <span className="flex-shrink-0">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-auto bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Footer */}
              <div className="pt-4 border-t border-slate-100 dark:border-neutral-800 space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-slate-50 dark:bg-neutral-900/40">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-neutral-200">
                    <Moon className="w-4 h-4 text-slate-400" />
                    <span>Dark Mode</span>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'} flex items-center`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop Floating Sidebar Component (hidden on mobile) ── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 80 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="hidden md:flex bg-white dark:bg-neutral-950 rounded-3xl p-4 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-neutral-800 flex-col flex-shrink-0 relative z-30 transition-colors"
      >
        {/* Brand Header & Toggle */}
        <div className="flex items-center justify-between px-2 py-2 mb-4">
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => router.push('/admin-dashboard')}
          >
            {/* User avatar as brand identity */}
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || 'Admin'}
                className="w-9 h-9 rounded-2xl object-cover flex-shrink-0 group-hover:scale-105 transition-transform ring-2 ring-indigo-100 dark:ring-indigo-900/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-indigo-400 flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 group-hover:scale-105 transition-transform shadow-sm">
                {user?.full_name?.charAt(0).toUpperCase() || 'A'}
              </div>
            )}
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight block leading-tight">
                  {user?.full_name?.split(' ')[0] || 'Admin'}
                </span>
                <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-400">Admin Panel</span>
              </motion.div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-900 text-slate-400 hover:text-slate-600 transition-colors hidden md:block"
          >
            <X className={`w-4 h-4 transition-transform ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pr-1">
          {/* Main Section */}
          <div>
            {sidebarOpen && (
              <p className="px-3 text-[11px] font-bold text-slate-400 dark:text-neutral-400 uppercase tracking-widest mb-2">
                Main
              </p>
            )}
            <nav className="space-y-1">
              {navItems.map((item, idx) => {
                const isActive = pathname === item.href || (item.subItems && item.subItems.some(sub => pathname === sub.href));
                const isExpanded = expandedNav === item.label;
                const hasSub = item.subItems && item.subItems.length > 0;

                return (
                  <div key={idx} className="space-y-1">
                    <button
                      onClick={() => {
                        if (hasSub && sidebarOpen) {
                          toggleSubmenu(item.label);
                        } else {
                          router.push(item.href);
                        }
                      }}
                      title={!sidebarOpen ? item.label : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-sm font-medium transition-all group ${
                        isActive
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-neutral-900 font-semibold shadow-sm'
                          : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900/60 hover:text-slate-900 dark:hover:text-white'
                      } ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white dark:text-neutral-900' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-neutral-100'}`}>
                          {item.icon}
                        </div>
                        {sidebarOpen && (
                          <span className="truncate text-xs md:text-sm">{item.label}</span>
                        )}
                      </div>

                      {sidebarOpen && (
                        <div className="flex items-center gap-1">
                          {item.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500 text-white">
                              {item.badge}
                            </span>
                          )}
                          {hasSub && (
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {/* Submenu rendering */}
                    {sidebarOpen && hasSub && isExpanded && (
                      <div className="pl-9 pr-2 space-y-1 py-1">
                        {item.subItems?.map((sub, sIdx) => {
                          const isSubActive = pathname === sub.href;
                          return (
                            <button
                              key={sIdx}
                              onClick={() => router.push(sub.href)}
                              className={`w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors ${
                                isSubActive
                                  ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40'
                                  : 'text-slate-500 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900/40'
                              }`}
                            >
                              {sub.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>



        </div>

        {/* Footer controls (Dark Mode Toggle & Logout) */}
        <div className="pt-4 border-t border-slate-100 dark:border-neutral-800/80 space-y-3 flex-shrink-0">
          {/* Dark Mode Switcher */}
          <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'justify-center'} px-3 py-2 rounded-2xl bg-slate-50 dark:bg-neutral-900/40`}>
            {sidebarOpen && (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-neutral-200">
                <Moon className="w-4 h-4 text-slate-400" />
                <span>Dark Mode</span>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              title={!sidebarOpen ? 'Toggle Dark Mode' : undefined}
              className={`${sidebarOpen ? 'w-9 h-5' : 'w-8 h-8 rounded-xl'} rounded-full transition-colors relative p-0.5 ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'} flex items-center justify-${sidebarOpen ? 'start' : 'center'}`}
            >
              {sidebarOpen
                ? <div className={`w-4 h-4 rounded-full bg-white transition-transform ${darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                : <Moon className="w-4 h-4 text-white" />
              }
            </button>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            title={!sidebarOpen ? 'Sign out' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs md:text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </motion.aside>

      {/* ── Main Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between py-2 px-1 mb-5">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-slate-600 dark:text-neutral-200 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowUserMenu(false);
                }}
                title="Notifications"
                className="relative p-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-extrabold px-1 min-w-[18px] h-4 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl border border-slate-100 dark:border-neutral-800 py-3 z-50 overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 pb-3 border-b border-slate-100 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">Notifications</span>
                        {unreadCount > 0 && (
                          <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-50 dark:divide-neutral-800/40">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => {
                              if (notif.href) router.push(notif.href);
                              setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
                              setShowNotifications(false);
                            }}
                            className={`p-3.5 flex gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-900/40 transition-colors ${
                              !notif.read ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : ''
                            }`}
                          >
                            <div className="flex-shrink-0 mt-0.5">
                              {notif.type === 'alert' ? (
                                <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </div>
                              ) : notif.type === 'promotion' ? (
                                <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-500 flex items-center justify-center">
                                  <Sparkles className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
                                  <Bell className="w-3.5 h-3.5" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{notif.title}</p>
                                {notif.time && <span className="text-[10px] text-slate-400 flex-shrink-0">{notif.time}</span>}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">{notif.message}</p>
                            </div>
                            {!notif.read && (
                              <div className="w-2 h-2 rounded-full bg-indigo-500 self-center flex-shrink-0" />
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="py-8 text-center">
                          <Bell className="w-8 h-8 text-slate-200 dark:text-neutral-200 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-slate-400">No notifications</p>
                          <p className="text-[10px] text-slate-300 dark:text-neutral-300">You're all caught up!</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 px-4 border-t border-slate-100 dark:border-neutral-800 text-center">
                      <button
                        onClick={() => {
                          router.push('/admin-monitoring/notifications');
                          setShowNotifications(false);
                        }}
                        className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline py-1 flex items-center justify-center gap-1 w-full"
                      >
                        View all notification logs <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search Input Box with Shortcut pill */}
            <div className="relative hidden sm:flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                placeholder="Search anything"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 rounded-2xl pl-10 pr-12 py-2 text-xs md:text-sm text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 ring-indigo-500/20 shadow-sm w-48 lg:w-64 transition-all"
              />
              <div className="absolute right-3 flex items-center gap-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-100 dark:bg-neutral-900 px-1.5 py-0.5 rounded-md">
                <Command className="w-2.5 h-2.5" /> K
              </div>
            </div>

            {/* Admin Avatar & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 bg-white dark:bg-neutral-950 p-1.5 pr-3 rounded-2xl border border-slate-100 dark:border-neutral-800 shadow-sm hover:border-slate-200 dark:hover:border-neutral-800 transition-colors"
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name || 'User Avatar'}
                    className="w-7 h-7 rounded-xl object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white font-bold text-xs flex items-center justify-center">
                    {user?.full_name?.charAt(0).toUpperCase() || 'A'}
                  </div>
                )}
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white dark:bg-neutral-950 rounded-2xl shadow-xl border border-slate-100 dark:border-neutral-800 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-neutral-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{user?.full_name || 'Admin User'}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@suqafuran.so'}</p>
                    </div>
                    <button
                      onClick={() => { router.push('/admin-dashboard/settings'); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-neutral-900/60 text-xs font-medium text-slate-700 dark:text-neutral-200 transition-colors"
                    >
                      Account Settings
                    </button>
                    <button
                      onClick={() => { router.push('/'); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-neutral-900/60 text-xs font-medium text-slate-700 dark:text-neutral-200 transition-colors"
                    >
                      Back to Shops
                    </button>
                    <hr className="my-1 border-slate-100 dark:border-neutral-800" />
                    <button
                      onClick={() => { handleLogout(); setShowUserMenu(false); }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold text-red-600 dark:text-red-400 transition-colors"
                    >
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Viewport */}
        <main className="flex-1 overflow-y-auto no-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

