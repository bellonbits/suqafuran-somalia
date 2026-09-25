"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Package,
  ArrowUpRight, ArrowDownRight, Filter, SlidersHorizontal,
  Box, Activity, Loader2, RefreshCw, LayoutGrid,
  CheckCircle, Clock, AlertTriangle, Megaphone, Store, UserCheck,
  UserX, ShieldAlert, Flag, UserPlus, MessageSquare
} from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { DashboardLayout } from '@/components/DashboardLayout';
import api from '@/services/api';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';

interface AdminStats {
  total_users: number;
  total_listings: number;
  active_listings: number;
  pending_listings: number;
  pending_promotions: number;
  // Extended fields that may come from enriched endpoint
  total_orders?: number;
  total_revenue?: number;
  new_users_this_week?: number;
  pending_orders?: number;
  // Management Overview
  active_users?: number;
  active_sellers?: number;
  active_buyers?: number;
  total_shops?: number;
  verified_sellers?: number;
  pending_seller_verifications?: number;
  suspended_accounts?: number;
  reported_listings?: number;
  open_disputes?: number;
  new_signups_today?: number;
  new_signups_this_week?: number;
  new_signups_this_month?: number;
  platform_growth_rate?: number;
  marketplace_activity?: { listings_posted_today: number; messages_sent_today: number };
}

interface Order {
  id: number;
  total_amount?: number;
  contacted_whatsapp?: boolean;
  contacted_call?: boolean;
  contacted_message?: boolean;
  customer?: { full_name?: string; email?: string };
  seller?: { shop_name?: string };
  items?: any[];
  created_at?: string;
  status?: string;
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/admin/orders?limit=8'),
      ]);

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) {
        const raw = ordersRes.value.data;
        setOrders(Array.isArray(raw) ? raw.slice(0, 8) : []);
      }
    } catch (err: any) {
      setError('Failed to load dashboard data');
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const metrics = stats ? [
    {
      icon: <Users className="w-5 h-5" />,
      label: 'Total Users',
      value: stats.total_users?.toLocaleString() ?? '—',
      subtext: stats.new_users_this_week ? `+${stats.new_users_this_week} this week` : 'Registered users',
      trend: 'up' as const,
      trendPercent: 8,
      color: 'blue' as const,
    },
    {
      icon: <Box className="w-5 h-5" />,
      label: 'Total Listings',
      value: stats.total_listings?.toLocaleString() ?? '—',
      subtext: `${stats.active_listings?.toLocaleString() ?? 0} active`,
      color: 'purple' as const,
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      label: 'Active Listings',
      value: stats.active_listings?.toLocaleString() ?? '—',
      subtext: `${stats.pending_listings?.toLocaleString() ?? 0} pending review`,
      trend: 'up' as const,
      trendPercent: 5,
      color: 'green' as const,
    },
    {
      icon: <Megaphone className="w-5 h-5" />,
      label: 'Pending Promotions',
      value: stats.pending_promotions?.toLocaleString() ?? '—',
      subtext: 'Awaiting approval',
      color: stats.pending_promotions > 0 ? 'orange' as const : 'green' as const,
    },
  ] : [];

  const overviewMetrics = stats ? [
    {
      icon: <UserCheck className="w-5 h-5" />,
      label: 'Active Users',
      value: stats.active_users?.toLocaleString() ?? '—',
      subtext: `of ${stats.total_users?.toLocaleString() ?? 0} total`,
      color: 'green' as const,
    },
    {
      icon: <Store className="w-5 h-5" />,
      label: 'Active Sellers',
      value: stats.active_sellers?.toLocaleString() ?? '—',
      subtext: `${stats.active_buyers?.toLocaleString() ?? 0} active buyers`,
      color: 'blue' as const,
    },
    {
      icon: <Package className="w-5 h-5" />,
      label: 'Total Shops',
      value: stats.total_shops?.toLocaleString() ?? '—',
      subtext: 'Verified, active listings',
      color: 'purple' as const,
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      label: 'Verified Sellers',
      value: stats.verified_sellers?.toLocaleString() ?? '—',
      subtext: `${stats.pending_seller_verifications?.toLocaleString() ?? 0} pending review`,
      color: stats.pending_seller_verifications ? 'orange' as const : 'green' as const,
    },
    {
      icon: <UserX className="w-5 h-5" />,
      label: 'Suspended Accounts',
      value: stats.suspended_accounts?.toLocaleString() ?? '—',
      subtext: 'Currently suspended',
      color: stats.suspended_accounts ? 'orange' as const : 'green' as const,
    },
    {
      icon: <Flag className="w-5 h-5" />,
      label: 'Reported Listings',
      value: stats.reported_listings?.toLocaleString() ?? '—',
      subtext: 'Pending review',
      color: stats.reported_listings ? 'orange' as const : 'green' as const,
    },
    {
      icon: <ShieldAlert className="w-5 h-5" />,
      label: 'Open Disputes',
      value: stats.open_disputes?.toLocaleString() ?? '—',
      subtext: 'Awaiting resolution',
      color: stats.open_disputes ? 'orange' as const : 'green' as const,
    },
    {
      icon: <UserPlus className="w-5 h-5" />,
      label: 'New Signups Today',
      value: stats.new_signups_today?.toLocaleString() ?? '—',
      subtext: `${stats.new_signups_this_week ?? 0} this week · ${stats.new_signups_this_month ?? 0} this month`,
      color: 'blue' as const,
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      label: 'Platform Growth Rate',
      value: stats.platform_growth_rate !== undefined ? `${stats.platform_growth_rate > 0 ? '+' : ''}${stats.platform_growth_rate}%` : '—',
      subtext: 'Signups vs. prior 30 days',
      trend: (stats.platform_growth_rate ?? 0) >= 0 ? 'up' as const : 'down' as const,
      color: (stats.platform_growth_rate ?? 0) >= 0 ? 'green' as const : 'orange' as const,
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      label: 'Marketplace Activity',
      value: `${stats.marketplace_activity?.listings_posted_today ?? 0}`,
      subtext: `listings + ${stats.marketplace_activity?.messages_sent_today ?? 0} messages today`,
      color: 'purple' as const,
    },
  ] : [];

  // Quick action hub items
  const quickLinks = [
    { label: 'Users', icon: Users, href: '/admin-users', color: 'bg-blue-50 text-blue-600 border-blue-100', desc: 'Manage accounts' },
    { label: 'Listings', icon: LayoutGrid, href: '/admin-listings', color: 'bg-purple-50 text-purple-600 border-purple-100', desc: 'Review posts' },
    { label: 'Verifications', icon: CheckCircle, href: '/admin-verifications', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', desc: 'ID checks' },
    { label: 'Orders', icon: ShoppingCart, href: '/admin-orders', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', desc: 'Track orders' },
    { label: 'Fraud', icon: AlertTriangle, href: '/admin-fraud', color: 'bg-rose-50 text-rose-600 border-rose-100', desc: 'Flagged activity' },
    { label: 'Promotions', icon: Megaphone, href: '/admin-marketing', color: 'bg-amber-50 text-amber-600 border-amber-100', desc: 'Campaigns' },
    { label: 'Reports', icon: Activity, href: '/admin-reports', color: 'bg-slate-50 text-slate-600 border-slate-200', desc: 'Analytics' },
    { label: 'Shops', icon: Package, href: '/admin-shops', color: 'bg-teal-50 text-teal-600 border-teal-100', desc: 'Store mgmt' },
  ];

  if (loading) {
    return (
      <DashboardLayout navItems={navItems} userRole="admin">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400 font-medium">Loading dashboard data…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout navItems={navItems} userRole="admin">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
          <p className="text-sm text-slate-500 font-medium">{error}</p>
          <button
            onClick={() => loadDashboardData()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} userRole="admin">
      <div className="space-y-6 pb-12">

        {/* Subheader Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400 font-medium">Live platform overview & metrics</p>
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-xs font-bold text-slate-600 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Real Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
            >
              <MetricCard {...metric} />
            </motion.div>
          ))}
        </div>

        {/* Management Overview */}
        {overviewMetrics.length > 0 && (
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-3">Management Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {overviewMetrics.map((metric, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <MetricCard {...metric} />
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Middle Row: Platform Health + Quick Links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Listing Health Bar Card */}
          {stats && (
            <div className="lg:col-span-1 bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" /> Listing Health
              </h3>
              <div className="space-y-4">
                {[
                  { label: 'Active', value: stats.active_listings, total: stats.total_listings, color: 'bg-emerald-500' },
                  { label: 'Pending Review', value: stats.pending_listings, total: stats.total_listings, color: 'bg-amber-400' },
                  { label: 'Other', value: Math.max(0, stats.total_listings - stats.active_listings - stats.pending_listings), total: stats.total_listings, color: 'bg-slate-200' },
                ].map((bar, i) => {
                  const pct = stats.total_listings > 0 ? Math.round((bar.value / stats.total_listings) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-600 dark:text-neutral-200">{bar.label}</span>
                        <span className="font-extrabold text-slate-900 dark:text-white">{bar.value?.toLocaleString()} <span className="text-slate-400 font-medium">({pct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${bar.color} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pending Promotions Alert */}
              {stats.pending_promotions > 0 && (
                <div className="mt-5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {stats.pending_promotions} promotion{stats.pending_promotions > 1 ? 's' : ''} pending
                    </span>
                  </div>
                  <Link href="/admin-marketing" className="text-[10px] font-extrabold text-amber-600 hover:underline">
                    Review →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Quick Action Hub */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-5">Quick Navigation</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickLinks.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link key={idx} href={item.href}>
                    <motion.div
                      whileHover={{ y: -2 }}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col gap-2 ${item.color} hover:shadow-sm`}
                    >
                      <Icon className="w-5 h-5" />
                      <div>
                        <p className="text-xs font-extrabold">{item.label}</p>
                        <p className="text-[10px] opacity-60 font-medium">{item.desc}</p>
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: Recent Orders (real data) */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Recent Orders</h3>
            <Link
              href="/admin-orders"
              className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1 rounded-xl"
            >
              View all →
            </Link>
          </div>

          {orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-neutral-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="pb-3">Customer</th>
                    <th className="pb-3 hidden sm:table-cell">Shop</th>
                    <th className="pb-3 hidden md:table-cell">Items</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Contact</th>
                    <th className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40 text-xs">
                  {orders.map((order) => {
                    const contacted = order.contacted_whatsapp || order.contacted_call || order.contacted_message;
                    const date = order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
                    return (
                      <tr key={order.id} className="hover:bg-slate-50/80 dark:hover:bg-neutral-900/30 transition-colors">
                        <td className="py-3.5 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] flex-shrink-0">
                              {(order.customer?.full_name || '?').charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[100px]">{order.customer?.full_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-slate-500 hidden sm:table-cell truncate max-w-[100px]">
                          {order.seller?.shop_name || '—'}
                        </td>
                        <td className="py-3.5 text-slate-500 hidden md:table-cell">
                          {order.items?.length ?? 0} item{order.items?.length === 1 ? '' : 's'}
                        </td>
                        <td className="py-3.5 font-extrabold text-slate-900 dark:text-white">
                          Ksh {(order.total_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2 py-0.5 rounded-xl text-[10px] font-extrabold ${contacted ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'}`}>
                            {contacted ? 'Contacted' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400 text-right">{date}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <ShoppingCart className="w-10 h-10 text-slate-200 dark:text-neutral-200" />
              <p className="text-sm font-semibold text-slate-400">No orders yet</p>
              <p className="text-xs text-slate-300 dark:text-neutral-300">Orders will appear here once customers check out</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;

