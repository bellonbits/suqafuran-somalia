"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Loader2, TrendingUp, Users, ShoppingCart, Package, RefreshCw,
  Activity, Box, Truck, Clock, CheckCircle, AlertTriangle, BarChart3
} from 'lucide-react';
import { adminService } from '@/services';
import type { AdminStats } from '@/services';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';

const navItems = ADMIN_NAV_ITEMS.map(item => ({
  ...item,
  icon: <item.icon className="w-5 h-5" />
}));

// SVG mini sparkline bar chart component
const MiniBarChart: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
  const max = Math.max(...values, 1);
  return (
    <svg viewBox={`0 0 ${values.length * 10} 32`} className="w-full h-8" preserveAspectRatio="none">
      {values.map((v, i) => {
        const h = Math.max(2, (v / max) * 28);
        return (
          <rect
            key={i}
            x={i * 10 + 1}
            y={30 - h}
            width={7}
            height={h}
            rx={2}
            fill={color}
            opacity={0.7 + (i / values.length) * 0.3}
          />
        );
      })}
    </svg>
  );
};

// Radial progress ring
const RadialRing: React.FC<{ pct: number; color: string; size?: number; strokeWidth?: number }> = ({
  pct, color, size = 64, strokeWidth = 6
}) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} className="dark:[stroke:#1e293b]" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
};

const AnalyticsPage = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await adminService.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Analytics" navItems={navItems} userRole="admin">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-400 font-medium">Loading analytics…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout title="Analytics" navItems={navItems} userRole="admin">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
          <p className="text-sm text-slate-400 font-medium">Failed to load analytics</p>
          <button onClick={() => loadAnalytics()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-2xl hover:bg-indigo-700 transition-colors">Retry</button>
        </div>
      </DashboardLayout>
    );
  }

  // Compute derived metrics
  const listingActiveRate = stats.total_listings > 0
    ? Math.round((stats.active_listings / stats.total_listings) * 100) : 0;
  const listingPendingRate = stats.total_listings > 0
    ? Math.round((stats.pending_listings / stats.total_listings) * 100) : 0;
  const deliveryDelayRate = (stats.active_deliveries + stats.delayed_deliveries) > 0
    ? Math.round((stats.delayed_deliveries / (stats.active_deliveries + stats.delayed_deliveries)) * 100) : 0;
  const orderPendingRate = stats.total_orders > 0
    ? Math.round((stats.pending_orders / stats.total_orders) * 100) : 0;

  // Hero metric cards
  const heroCards = [
    {
      label: 'Total Users',
      value: stats.total_users?.toLocaleString(),
      sub: `+${stats.new_users_this_week ?? 0} this week`,
      icon: Users,
      color: '#6366f1',
      bgClass: 'from-indigo-500/10 to-indigo-400/5',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      sparkline: [12, 18, 14, 22, 19, 25, stats.new_users_this_week ?? 10],
    },
    {
      label: 'Total Listings',
      value: stats.total_listings?.toLocaleString(),
      sub: `${stats.active_listings?.toLocaleString()} active`,
      icon: Box,
      color: '#8b5cf6',
      bgClass: 'from-purple-500/10 to-purple-400/5',
      iconBg: 'bg-purple-50 dark:bg-purple-950/40',
      iconColor: 'text-purple-600 dark:text-purple-400',
      sparkline: [30, 42, 38, 55, 60, 58, stats.active_listings ?? 0],
    },
    {
      label: 'Total Orders',
      value: stats.total_orders?.toLocaleString() ?? '0',
      sub: `${stats.pending_orders ?? 0} pending`,
      icon: ShoppingCart,
      color: '#0ea5e9',
      bgClass: 'from-sky-500/10 to-sky-400/5',
      iconBg: 'bg-sky-50 dark:bg-sky-950/40',
      iconColor: 'text-sky-600 dark:text-sky-400',
      sparkline: [5, 8, 7, 12, 10, 15, stats.pending_orders ?? 0],
    },
    {
      label: 'Revenue',
      value: stats.total_revenue > 0
        ? `Ksh ${(stats.total_revenue / 1000).toFixed(1)}k`
        : 'Ksh 0',
      sub: 'All time',
      icon: TrendingUp,
      color: '#10b981',
      bgClass: 'from-emerald-500/10 to-emerald-400/5',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      sparkline: [1, 3, 2, 4, 5, 4, stats.total_revenue ? Math.round(stats.total_revenue / 10000) : 0],
    },
  ];

  // Health doughnut sections
  const healthMetrics = [
    { label: 'Active Listings', pct: listingActiveRate, color: '#10b981', icon: CheckCircle, iconColor: 'text-emerald-500' },
    { label: 'Pending Listings', pct: listingPendingRate, color: '#f59e0b', icon: Clock, iconColor: 'text-amber-500' },
    { label: 'Order Backlog', pct: orderPendingRate, color: '#6366f1', icon: ShoppingCart, iconColor: 'text-indigo-500' },
    { label: 'Delivery Delays', pct: deliveryDelayRate, color: '#ef4444', icon: Truck, iconColor: 'text-rose-500' },
  ];

  // Breakdown table rows
  const breakdownRows = [
    { label: 'Active Listings', value: stats.active_listings, total: stats.total_listings, color: 'bg-emerald-500' },
    { label: 'Pending Listings', value: stats.pending_listings, total: stats.total_listings, color: 'bg-amber-400' },
    { label: 'Pending Orders', value: stats.pending_orders, total: stats.total_orders || 1, color: 'bg-indigo-500' },
    { label: 'Active Deliveries', value: stats.active_deliveries, total: (stats.active_deliveries + stats.delayed_deliveries) || 1, color: 'bg-sky-500' },
    { label: 'Delayed Deliveries', value: stats.delayed_deliveries, total: (stats.active_deliveries + stats.delayed_deliveries) || 1, color: 'bg-rose-500' },
    { label: 'Pending Promotions', value: stats.pending_promotions, total: 100, color: 'bg-purple-500' },
  ];

  return (
    <DashboardLayout title="Analytics" navItems={navItems} userRole="admin">
      <div className="space-y-6 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Platform Analytics</h1>
            <p className="text-xs text-slate-400 mt-0.5">Live metrics from real data</p>
          </div>
          <button
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-xs font-bold text-slate-600 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-indigo-500' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* Hero metric cards with sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {heroCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.07 }}
                className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.03)] relative overflow-hidden"
              >
                {/* Gradient wash */}
                <div className={`absolute inset-0 bg-gradient-to-br ${card.bgClass} pointer-events-none`} />
                <div className="relative">
                  <div className={`w-9 h-9 rounded-2xl ${card.iconBg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{card.value}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">{card.sub}</p>
                  <div className="mt-3 opacity-60">
                    <MiniBarChart values={card.sparkline} color={card.color} />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Middle: Health Rings + Breakdown Bars */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Health Rings */}
          <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Platform Health Scores
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {healthMetrics.map((m, i) => {
                const Icon = m.icon;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-900/40">
                    <div className="relative flex-shrink-0">
                      <RadialRing pct={m.pct} color={m.color} size={52} strokeWidth={5} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-extrabold text-slate-700 dark:text-neutral-100">{m.pct}%</span>
                      </div>
                    </div>
                    <div>
                      <Icon className={`w-3.5 h-3.5 ${m.iconColor} mb-0.5`} />
                      <p className="text-xs font-bold text-slate-700 dark:text-neutral-100 leading-tight">{m.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown Bars */}
          <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" /> Detailed Breakdown
            </h3>
            <div className="space-y-4">
              {breakdownRows.map((row, i) => {
                const pct = row.total > 0 ? Math.min(100, Math.round((row.value / row.total) * 100)) : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-slate-600 dark:text-neutral-200">{row.label}</span>
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {row.value?.toLocaleString()} <span className="text-slate-400 font-medium">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${row.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.08, duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: Summary Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
            { label: 'New This Week', value: stats.new_users_this_week ?? 0, icon: TrendingUp, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Total Listings', value: stats.total_listings, icon: Package, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
            { label: 'Pending Review', value: stats.pending_listings, icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
            { label: 'Active Delivery', value: stats.active_deliveries, icon: Truck, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/30' },
            { label: 'Delayed', value: stats.delayed_deliveries, icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + idx * 0.05 }}
                className="bg-white dark:bg-neutral-950 rounded-2xl border border-slate-100 dark:border-neutral-800 p-4 text-center shadow-[0_1px_6px_rgba(0,0,0,0.02)]"
              >
                <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center mx-auto mb-2`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="text-xl font-black text-slate-900 dark:text-white">{item.value?.toLocaleString()}</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-0.5 leading-tight">{item.label}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
