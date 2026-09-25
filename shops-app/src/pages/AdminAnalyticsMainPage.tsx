"use client";

import React, { useState, useEffect } from 'react';
import { BarChart3, Eye, Store, TrendingUp, RefreshCw, Calendar, MessageSquare, Heart, Phone, Search, AlertCircle, Flame, DollarSign } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface OverviewStats {
  total_visitors: number;
  unique_users: number;
  total_searches: number;
  chat_clicks: number;
  favorites_added: number;
  conversion_rate: number;
  total_views: number;
  whatsapp_clicks: number;
  call_clicks: number;
}

interface SearchQuery {
  query: string;
  search_count: number;
  avg_results: number;
}

interface CategoryPerf {
  category_id: number;
  category_name: string;
  view_count: number;
  listing_count: number;
  ctr: number;
}

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

interface HotListing {
  listing_id: number;
  listing_title: string;
  views: number;
  chats: number;
  favorites: number;
  pct_change: number;
}

interface SalesChannel {
  channel: string;
  orders: number;
  revenue: number;
  revenue_share: number;
}

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [topSearches, setTopSearches] = useState<SearchQuery[]>([]);
  const [noResultSearches, setNoResultSearches] = useState<SearchQuery[]>([]);
  const [categoryPerf, setCategoryPerf] = useState<CategoryPerf[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [hotListings, setHotListings] = useState<HotListing[]>([]);
  const [salesChannels, setSalesChannels] = useState<SalesChannel[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [overviewRes, searchRes, catRes, funnelRes, hotRes, attributionRes] = await Promise.all([
        analyticsService.getOverview(days),
        analyticsService.getSearchAnalytics(days),
        analyticsService.getCategoryAnalytics(days),
        analyticsService.getConversionFunnel(days),
        analyticsService.getHotListings(1, 6),
        analyticsService.getSalesAttribution(days),
      ]);

      setOverview(overviewRes.data || {});
      setTopSearches(searchRes.data?.top_searches || []);
      setNoResultSearches(searchRes.data?.no_result_searches || []);
      setCategoryPerf(catRes.data?.categories || []);
      setFunnelData(funnelRes.data?.funnel || []);
      setHotListings(hotRes.data?.listings || []);
      setSalesChannels(attributionRes.data?.channels || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [days]);

  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  return (
    <DashboardLayout title="Realtime Analytics" navItems={navItems} userRole="admin">
    <AnalyticsTabs />
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900/40 dark:bg-black">
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-orange-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analytics Dashboard</h1>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        {/* Controls & Live Polling */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-300" />
              <label className="text-sm font-semibold text-slate-900 dark:text-white">Period:</label>
              <select
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white"
              >
                <option value={1}>Today (24h)</option>
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 dark:border-neutral-800 pl-4">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Live Intent Stream Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-xs text-slate-400 dark:text-neutral-400">
                Auto-synced: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Now
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Visitors</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview.total_visitors.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Searches</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{overview.total_searches.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Chats</p>
              <p className="text-2xl font-black text-blue-600 mt-1">{overview.chat_clicks.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">WhatsApp</p>
              <p className="text-2xl font-black text-green-600 mt-1">{overview.whatsapp_clicks.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Favorites</p>
              <p className="text-2xl font-black text-red-600 mt-1">{overview.favorites_added.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Conversion</p>
              <p className="text-2xl font-black text-orange-600 mt-1">{overview.conversion_rate}%</p>
            </div>
          </div>
        )}

        {/* Conversion Funnel */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Conversion Funnel</h2>
            <span className="text-xs text-slate-500 dark:text-neutral-400 font-medium">Intent & Conversion Stages</span>
          </div>
          <div className="p-6 space-y-4">
            {funnelData.length > 0 ? (
              funnelData.map((stage, idx) => (
                <div key={idx}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{stage.stage}</span>
                    <span className="text-sm text-slate-500 dark:text-neutral-400">{stage.count.toLocaleString()} ({stage.percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-neutral-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all"
                      style={{ width: `${stage.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Tracking Funnel Initialized</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  User visits, searches, chats, and WhatsApp clicks will populate real-time conversion percentages here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Top Searches & Missing Inventory */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Searches</h2>
            </div>
            {topSearches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-neutral-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Query</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Searches</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Avg Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                    {topSearches.map((search, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                        <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white">{search.query}</td>
                        <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{search.search_count}</td>
                        <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{search.avg_results}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-400">
                No search queries logged in this time window.
              </div>
            )}
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-red-900 dark:text-red-300">No Results Searches</h2>
              <span className="text-xs text-red-700 dark:text-red-400 ml-auto font-medium">Missing Inventory</span>
            </div>
            {noResultSearches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-red-100 dark:bg-red-900/40">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-red-900 dark:text-red-300">Query</th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-red-900 dark:text-red-300">Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-200 dark:divide-red-800">
                    {noResultSearches.map((search, idx) => (
                      <tr key={idx} className="hover:bg-red-100 dark:hover:bg-red-900/30">
                        <td className="px-6 py-3 text-sm font-semibold text-red-900 dark:text-red-300">{search.query}</td>
                        <td className="px-6 py-3 text-sm text-red-900 dark:text-red-300">{search.search_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-red-700 dark:text-red-400">
                All buyer searches currently return matching listings.
              </div>
            )}
          </div>
        </div>

        {/* Category Performance */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Category Performance</h2>
          </div>
          {categoryPerf.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Views</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Listings</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {categoryPerf.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white">{cat.category_name}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{cat.view_count.toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{cat.listing_count}</td>
                      <td className="px-6 py-3 text-sm font-bold text-green-600">{cat.ctr}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-400">
              No category view statistics recorded for this timeframe yet.
            </div>
          )}
        </div>

        {/* Hot Listings */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Hot Listings</h2>
            <span className="text-xs text-slate-500 dark:text-neutral-400 ml-auto font-medium">Last 24h momentum</span>
          </div>
          {hotListings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
              {hotListings.map((item) => (
                <div key={item.listing_id} className="p-4 bg-slate-50 dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">
                      🔥 {item.listing_title}
                    </h3>
                    {item.pct_change > 0 && (
                      <span className="flex-shrink-0 text-[11px] font-bold text-green-600">
                        +{item.pct_change}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-neutral-400">
                    <span>{item.views.toLocaleString()} views</span>
                    <span>{item.chats.toLocaleString()} chats</span>
                    <span>{item.favorites.toLocaleString()} wishlists</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-400">
              No listing activity in the last 24 hours yet.
            </div>
          )}
        </div>

        {/* Sales Attribution */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sales Attribution</h2>
            <span className="text-xs text-slate-500 dark:text-neutral-400 ml-auto font-medium">By signup channel</span>
          </div>
          {salesChannels.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Channel</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Orders</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Revenue</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {salesChannels.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white">{c.channel}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{c.orders}</td>
                      <td className="px-6 py-3 text-sm font-bold text-green-600">{c.revenue.toLocaleString()}</td>
                      <td className="px-6 py-3 text-sm text-slate-900 dark:text-white">{c.revenue_share}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 dark:text-neutral-400">
              No completed orders recorded for this timeframe yet.
            </div>
          )}
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
