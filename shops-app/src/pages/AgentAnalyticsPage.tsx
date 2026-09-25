"use client";

import React, { useEffect, useState } from 'react';
import {
  BarChart3, TrendingUp, Users, Activity, Store, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Eye, Target, Zap, Clock
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import api from '@/services/api';
import { promotionService } from '@/services';

const agentNavItems = [
  { label: 'Agent Dashboard', icon: <Activity className="w-5 h-5" />, href: '/agent-dashboard' },
  { label: 'Agent Shops', icon: <Store className="w-5 h-5" />, href: '/agent-shops' },
  { label: 'Agent Listings', icon: <ShoppingBag className="w-5 h-5" />, href: '/agent-listings' },
  { label: 'Agent Earnings', icon: <TrendingUp className="w-5 h-5" />, href: '/agent-earnings' },
  { label: 'Agent Analytics', icon: <Users className="w-5 h-5" />, href: '/agent-analytics' },
];

export default function AgentAnalyticsPage() {
  const [conversions, setConversions] = useState<any>(null);
  const [marketing, setMarketing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadAnalytics(); }, []);

  const loadAnalytics = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [convRes, mktRes] = await Promise.allSettled([
        api.get('/promotions/agent/conversions').catch(() => null),
        promotionService.getConversions().catch(() => null),
      ]);
      if (convRes.status === 'fulfilled' && convRes.value) setConversions(convRes.value.data);
      if (mktRes.status === 'fulfilled' && mktRes.value) setMarketing(mktRes.value);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const metrics = [
    {
      label: 'Total Listings',
      value: conversions?.total_listings?.toLocaleString() || marketing?.active_listings?.toLocaleString() || '0',
      trend: '+23%',
      trendUp: true,
      icon: ShoppingBag,
      iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600',
    },
    {
      label: 'Total Views',
      value: conversions?.total_views?.toLocaleString() || '0',
      trend: '+18%',
      trendUp: true,
      icon: Eye,
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600',
    },
    {
      label: 'Conversion Rate',
      value: conversions?.conversion_rate ? `${conversions.conversion_rate}%` : marketing?.conversion_rate ? `${(marketing.conversion_rate * 100).toFixed(1)}%` : '0%',
      trend: '+8%',
      trendUp: true,
      icon: Target,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600',
    },
    {
      label: 'Avg Days to Sale',
      value: `${conversions?.avg_days_to_sale || 0}d`,
      trend: '-5%',
      trendUp: false,
      icon: Clock,
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600',
    },
  ];

  const funnelMetrics = [
    { label: 'Total Signups', value: marketing?.total_users || 0, pct: 100 },
    { label: 'Posted Listings', value: marketing?.users_with_ads || 0, pct: marketing?.total_users ? Math.round((marketing.users_with_ads / marketing.total_users) * 100) : 0 },
    { label: 'Completed Sales', value: conversions?.total_sales || 0, pct: marketing?.total_users ? Math.round(((conversions?.total_sales || 0) / marketing.total_users) * 100) : 0 },
  ];

  if (loading) {
    return (
      <DashboardLayout title="Agent Analytics" navItems={agentNavItems} userRole="agent">
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-semibold text-slate-400">Loading Analytics Portal…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agent Analytics" navItems={agentNavItems} userRole="agent">
      <div className="space-y-6 pb-12">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Analytics Report</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Conversion funnels, listing performance and signup metrics</p>
          </div>
          <button
            onClick={() => loadAnalytics(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, i) => {
            const Icon = m.icon;
            return (
              <div key={i} className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{m.label}</p>
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${m.iconBg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{m.value}</h2>
                <div className="flex items-center gap-1.5 mt-2">
                  {m.trendUp ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span className={`text-[11px] font-bold ${m.trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>{m.trend} vs last month</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] space-y-5">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-500" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Signup → Listing → Sale Conversion Funnel</h3>
          </div>

          <div className="space-y-4">
            {funnelMetrics.map((f, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200">{f.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{f.value.toLocaleString()}</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-sky-50 text-sky-600' : i === 1 ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {f.pct}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-sky-500' : i === 1 ? 'bg-indigo-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(f.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" /> Signups Performance
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-neutral-900/40 rounded-2xl text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{marketing?.signups_today || 0}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">Signed Up Today</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-neutral-900/40 rounded-2xl text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{marketing?.signups_week || 0}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">This Week</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-sky-500" /> Ads Performance
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-neutral-900/40 rounded-2xl text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{marketing?.ads_today || 0}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">Ads Posted Today</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-neutral-900/40 rounded-2xl text-center">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{marketing?.ads_week || 0}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-1">This Week</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
