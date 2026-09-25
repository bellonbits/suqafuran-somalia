"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Calendar, RefreshCw, MessageSquare, Eye, Clock } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface SellerRanking {
  rank: number;
  shop_id: number;
  shop_name: string;
  value: number;
}

interface SellerResponseStat {
  seller_id: number;
  seller_name: string;
  chats: number;
  response_rate: number;
  avg_response_seconds: number;
  unanswered: number;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function SellerRankings() {
  const [rankings, setRankings] = useState<SellerRanking[]>([]);
  const [responseStats, setResponseStats] = useState<SellerResponseStat[]>([]);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<"views" | "chats" | "conversions">("views");
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      const [rankingsRes, responseRes] = await Promise.all([
        analyticsService.getSellerRankings(days, metric),
        analyticsService.getSellerResponseAnalytics(days, 20),
      ]);
      setRankings(rankingsRes.data?.rankings || []);
      setResponseStats(responseRes.data?.sellers || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch seller rankings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRankings();
  }, [days, metric]);

  const getMetricLabel = () => {
    switch (metric) {
      case 'views': return 'Shop Views';
      case 'chats': return 'Chat Started';
      case 'conversions': return 'Contacts';
      default: return 'Metric';
    }
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

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
            <Trophy className="w-6 h-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Seller Rankings</h1>
          </div>
          <button
            onClick={fetchRankings}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        {/* Controls */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex gap-4 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white dark:text-white"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">Metric:</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as any)}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white dark:text-white"
            >
              <option value="views">Shop Views</option>
              <option value="chats">Chats Started</option>
              <option value="conversions">Contacts</option>
            </select>
          </div>

          {lastRefresh && (
            <span className="text-xs text-slate-400 dark:text-neutral-400 ml-auto">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Rankings */}
        {rankings.length > 0 && (
          <div className="space-y-4">
            {rankings.map((seller) => (
              <div
                key={seller.shop_id}
                className="bg-white dark:bg-neutral-950 rounded-lg p-6 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="text-3xl font-black w-12 text-center">
                      {getMedalEmoji(seller.rank)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">
                        {seller.shop_name}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-neutral-300">Shop #{seller.shop_id}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-3xl font-black text-orange-600">
                      {seller.value.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-neutral-300">
                      {getMetricLabel()}
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="w-32 h-2 bg-gray-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-orange-600"
                      style={{
                        width: `${Math.min(
                          100,
                          (seller.value / Math.max(...rankings.map((r) => r.value))) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Seller Response Analytics */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Seller Response Analytics</h2>
            <span className="text-xs text-slate-500 dark:text-neutral-400 ml-auto font-medium">Ranked by response rate</span>
          </div>
          {responseStats.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Seller</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Chats</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Response Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Avg Response</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Unanswered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {responseStats.map((seller) => (
                    <tr key={seller.seller_id} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                        {seller.seller_name}
                        <div className="text-xs text-slate-400 dark:text-neutral-400 font-normal">#{seller.seller_id}</div>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{seller.chats}</td>
                      <td className="px-6 py-3 text-sm font-bold">
                        <span className={
                          seller.response_rate >= 80 ? 'text-green-600' :
                          seller.response_rate >= 50 ? 'text-orange-600' : 'text-red-600'
                        }>
                          {seller.response_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{formatDuration(seller.avg_response_seconds)}</td>
                      <td className="px-6 py-3 text-sm">
                        {seller.unanswered > 0 ? (
                          <span className="font-bold text-red-600">{seller.unanswered}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-neutral-400">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-400">
              No seller-buyer conversations recorded for this timeframe yet.
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
