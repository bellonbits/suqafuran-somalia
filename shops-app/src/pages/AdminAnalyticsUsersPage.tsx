"use client";

import React, { useState, useEffect } from 'react';
import { Users, TrendingUp, Calendar, RefreshCw, Store, CheckCircle } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface UserStats {
  new_users: number;
  returning_users: number;
  total_active_sellers: number;
  verified_sellers: number;
  top_users: Array<{
    user_id: number;
    user_name: string;
    searches: number;
    clicks: number;
    chats: number;
    visits: number;
  }>;
}

export default function UserAnalytics() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getUserAnalytics(days);
      setStats(res.data || null);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch user analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  return (
    <DashboardLayout title="Realtime Analytics" navItems={navItems} userRole="admin">
    <AnalyticsTabs />
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900/40 dark:bg-black">
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-green-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">User Analytics</h1>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        {/* Controls */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white dark:text-white"
            >
              <option value={1}>1 day</option>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
          {lastRefresh && (
            <span className="text-xs text-slate-400 dark:text-neutral-400 ml-auto">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">New Users</p>
              <p className="text-3xl font-black text-green-600 mt-2">{stats.new_users.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Returning</p>
              <p className="text-3xl font-black text-blue-600 mt-2">{stats.returning_users.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Active Sellers</p>
              <p className="text-3xl font-black text-purple-600 mt-2">{stats.total_active_sellers.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Verified</p>
              <p className="text-3xl font-black text-orange-600 mt-2">{stats.verified_sellers.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Top Users */}
        {stats && stats.top_users.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Top Users by Engagement</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900/40 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">User Name</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Visits</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Searches</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200 dark:text-neutral-200">Chats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {stats.top_users.map((user, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-neutral-900">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white dark:text-white">
                        <div>{user.user_name}</div>
                        <div className="text-xs text-slate-400 dark:text-neutral-300">#{user.user_id}</div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white dark:text-white">{user.visits}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white dark:text-white">{user.searches}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white dark:text-white">{user.clicks}</td>
                      <td className="px-6 py-3 text-sm font-bold text-orange-600">{user.chats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
