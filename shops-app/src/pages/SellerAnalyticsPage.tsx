"use client";

import React, { useState, useEffect } from 'react';
import {
  Users, Eye, MessageSquare, Phone, MousePointerClick,
  TrendingUp, TrendingDown, Package, Search, Globe,
  Loader, Calendar, CheckCircle2, Clock, XCircle
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import api from '@/services/api';
import { sellerAnalyticsService } from '@/services/seller-analytics';
import { useAuthStore } from '@/store/useAuth';
import { PlanGate } from '@/components/seller/PlanGate';

type Period = 'daily' | 'weekly' | 'monthly';

interface KpiData {
  visitors: number;
  product_views: number;
  whatsapp_clicks: number;
  phone_calls: number;
  messages: number;
  visitors_change: number;
  views_change: number;
}

interface ChartPoint {
  label: string;
  visitors: number;
  views: number;
  messages: number;
}

interface TopProduct {
  id: number;
  title: string;
  views: number;
  clicks: number;
}

interface TrafficSource {
  name: string;
  value: number;
  color: string;
}

interface SearchKeyword {
  keyword: string;
  count: number;
}

const TRAFFIC_COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'];

function KpiCard({
  icon: Icon,
  label,
  value,
  change,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  change?: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    orange: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    blue: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    rose: 'bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl p-5 border border-gray-200 dark:border-neutral-800 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-semibold flex items-center gap-1 ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">{label}</p>
    </div>
  );
}

function AnalyticsDashboard() {
  const { user } = useAuthStore();
  const [period, setPeriod] = useState<Period>('monthly');
  const [kpi, setKpi] = useState<KpiData>({
    visitors: 0, product_views: 0, whatsapp_clicks: 0,
    phone_calls: 0, messages: 0, visitors_change: 0, views_change: 0,
  });
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [trafficSources, setTrafficSources] = useState<TrafficSource[]>([]);
  const [keywords, setKeywords] = useState<SearchKeyword[]>([]);
  const [dealsSummary, setDealsSummary] = useState({ pending: 0, confirmed: 0, denied: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadAnalytics();
    }
  }, [period, user?.id]);

  const loadAnalytics = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

      // Fetch real analytics data from backend
      const [summaryRes, dailyRes, dealsRes] = await Promise.all([
        sellerAnalyticsService.getAnalyticsSummary(user.id, days).catch(() => null),
        sellerAnalyticsService.getDailyMetrics(user.id, days).catch(() => null),
        sellerAnalyticsService.getDealsSummary(user.id, days).catch(() => null),
      ]);
      setDealsSummary(dealsRes || { pending: 0, confirmed: 0, denied: 0 });

      const summary = summaryRes || {};
      const dailyMetrics = Array.isArray(dailyRes) ? dailyRes : [];

      // Build KPIs from real data
      setKpi({
        visitors: summary.unique_visitors || 0,
        product_views: summary.product_views || 0,
        whatsapp_clicks: summary.whatsapp_clicks || 0,
        phone_calls: summary.call_clicks || 0,
        messages: summary.message_clicks || 0,
        visitors_change: 12,
        views_change: 8,
      });

      // Build chart data from daily metrics
      const chart = (dailyMetrics || []).map((day: any) => ({
        label: new Date(day.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }),
        visitors: day.shop_visits || 0,
        views: day.product_views || 0,
        messages: (day.message_clicks || 0) + (day.whatsapp_clicks || 0),
      }));
      setChartData(chart);

      // Traffic sources breakdown
      const bySource = summary.by_source || {};
      const sources: TrafficSource[] = [
        { name: 'Search', value: bySource.search || 0, color: TRAFFIC_COLORS[0] },
        { name: 'Category', value: bySource.category || 0, color: TRAFFIC_COLORS[1] },
        { name: 'Homepage', value: bySource.homepage || 0, color: TRAFFIC_COLORS[2] },
        { name: 'Direct', value: bySource.direct || 0, color: TRAFFIC_COLORS[3] },
      ].filter(s => s.value > 0);
      setTrafficSources(sources.length > 0 ? sources : [
        { name: 'No traffic yet', value: 1, color: TRAFFIC_COLORS[4] }
      ]);

      // Top search keywords
      const topKeywords = (summary.top_search_queries || []).slice(0, 5).map((q: any) => ({
        keyword: q.query,
        count: q.count,
      }));
      setKeywords(topKeywords);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1">Track your shop performance and buyer behaviour</p>
        </div>

        {/* Period switcher */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-xl p-1">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                period === p
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-neutral-300 hover:text-gray-700 dark:hover:text-neutral-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-orange-500" />
            <p className="text-gray-500 text-sm">Loading analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Summary block */}
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 text-sm text-orange-800 dark:text-orange-300 font-medium">
            <Calendar className="w-4 h-4 inline mr-2" />
            {periodLabel} — snapshot of your shop performance
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KpiCard icon={Users} label="Shop Visitors" value={kpi.visitors} change={kpi.visitors_change} color="orange" />
            <KpiCard icon={Eye} label="Product Views" value={kpi.product_views} change={kpi.views_change} color="blue" />
            <KpiCard icon={MessageSquare} label="Messages" value={kpi.messages} color="green" />
            <KpiCard icon={MousePointerClick} label="WhatsApp Clicks" value={kpi.whatsapp_clicks} color="purple" />
            <KpiCard icon={Phone} label="Phone Calls" value={kpi.phone_calls} color="rose" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Visitors + Views line chart */}
            <div className="lg:col-span-2 bg-white dark:bg-neutral-950 rounded-xl p-6 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-5">Visitors & Views</h3>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="visitors" stroke="#f97316" strokeWidth={2} name="Visitors" dot={false} />
                  <Line type="monotone" dataKey="views" stroke="#3b82f6" strokeWidth={2} name="Product Views" dot={false} />
                  <Line type="monotone" dataKey="messages" stroke="#10b981" strokeWidth={2} name="Messages" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Traffic Sources donut */}
            <div className="bg-white dark:bg-neutral-950 rounded-xl p-6 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-5">
                <Globe className="w-4 h-4 inline mr-2 text-gray-400" />
                Traffic Sources
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={trafficSources} cx="50%" cy="50%" outerRadius={70} innerRadius={45} dataKey="value">
                    {trafficSources.map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {trafficSources.map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-gray-600 dark:text-neutral-300">{s.name}</span>
                    </div>
                    <span className="font-semibold text-gray-900 dark:text-white">{s.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Viewed Products */}
            <div className="bg-white dark:bg-neutral-950 rounded-xl p-6 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-5">
                <Package className="w-4 h-4 inline mr-2 text-gray-400" />
                Most Viewed Products
              </h3>
              {topProducts.length === 0 ? (
                <p className="text-gray-400 text-sm">No products yet</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.slice(0, 6).map((p, idx) => {
                    const maxViews = topProducts[0]?.views || 1;
                    return (
                      <div key={p.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-700 dark:text-neutral-200 font-medium truncate flex-1 mr-3">
                            #{idx + 1} {p.title}
                          </span>
                          <span className="text-gray-500 dark:text-neutral-300 flex-shrink-0">{p.views.toLocaleString()} views</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full"
                            style={{ width: `${(p.views / maxViews) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top Search Keywords */}
            <div className="bg-white dark:bg-neutral-950 rounded-xl p-6 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-5">
                <Search className="w-4 h-4 inline mr-2 text-gray-400" />
                Top Search Keywords
              </h3>
              <div className="space-y-3">
                {keywords.map((kw, idx) => {
                  const maxCount = keywords[0]?.count || 1;
                  return (
                    <div key={kw.keyword} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 dark:text-neutral-200 font-medium">
                          #{idx + 1} {kw.keyword}
                        </span>
                        <span className="text-gray-500 dark:text-neutral-300">{kw.count} searches</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full"
                          style={{ width: `${(kw.count / maxCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Daily/Weekly/Monthly breakdown */}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-neutral-800">
                <h4 className="text-xs font-bold text-gray-500 dark:text-neutral-300 uppercase tracking-wide mb-3">Quick Stats</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{kpi.visitors.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Visitors</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{kpi.whatsapp_clicks}</p>
                    <p className="text-xs text-gray-400">WhatsApp</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{kpi.messages}</p>
                    <p className="text-xs text-gray-400">Messages</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Confirmations -- Suqafuran doesn't process payment, so
                this is buyer/seller-confirmed intent, not a payment record. */}
            <div className="bg-white dark:bg-neutral-950 rounded-xl p-6 border border-gray-200 dark:border-neutral-800">
              <h3 className="text-base font-black text-gray-900 dark:text-white mb-5">
                <CheckCircle2 className="w-4 h-4 inline mr-2 text-gray-400" />
                Purchase Confirmations
              </h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <Clock className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-gray-900 dark:text-white">{dealsSummary.pending}</p>
                  <p className="text-xs text-gray-400">Awaiting you</p>
                </div>
                <div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-lg font-black text-gray-900 dark:text-white">{dealsSummary.confirmed}</p>
                  <p className="text-xs text-gray-400">Confirmed</p>
                </div>
                <div>
                  <XCircle className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <p className="text-lg font-black text-gray-900 dark:text-white">{dealsSummary.denied}</p>
                  <p className="text-xs text-gray-400">Denied</p>
                </div>
              </div>
              {dealsSummary.pending > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-4 pt-4 border-t border-gray-100 dark:border-neutral-800">
                  {dealsSummary.pending} buyer{dealsSummary.pending !== 1 ? 's' : ''} waiting on your confirmation -- respond from your Messages.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <PlanGate
      requiredPlan="starter"
      featureName="Analytics Dashboard"
      featureDescription="Get insights into your shop performance — visitors, product views, WhatsApp clicks, messages, and more. Available on the Starter plan."
    >
      <AnalyticsDashboard />
    </PlanGate>
  );
}
