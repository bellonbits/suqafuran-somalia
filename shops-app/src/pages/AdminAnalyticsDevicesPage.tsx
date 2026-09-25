"use client";

import React, { useState, useEffect } from 'react';
import { Smartphone, Monitor, Tablet, Calendar, RefreshCw, Zap } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface DeviceMetric {
  device_type: string;
  count: number;
  percentage: number;
}

export default function DeviceAnalytics() {
  const [itemViews, setItemViews] = useState<DeviceMetric[]>([]);
  const [shopViews, setShopViews] = useState<DeviceMetric[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getDeviceAnalytics(days);
      setItemViews(res.data?.item_views_by_device || []);
      setShopViews(res.data?.shop_views_by_device || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch device analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const getDeviceIcon = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return <Smartphone className="w-5 h-5" />;
      case 'tablet': return <Tablet className="w-5 h-5" />;
      case 'desktop': return <Monitor className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getDeviceColor = (device: string) => {
    switch (device.toLowerCase()) {
      case 'mobile': return 'from-blue-400 to-blue-600';
      case 'tablet': return 'from-purple-400 to-purple-600';
      case 'desktop': return 'from-green-400 to-green-600';
      default: return 'from-gray-400 to-gray-600';
    }
  };

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
            <Smartphone className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Device Analytics</h1>
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
        {/* Controls */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white"
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

        {/* Item Views by Device */}
        {itemViews.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Item Views by Device</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
              {itemViews.map((metric) => (
                <div
                  key={metric.device_type}
                  className="p-4 bg-slate-50 dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getDeviceColor(metric.device_type)} flex items-center justify-center text-white mb-3`}>
                    {getDeviceIcon(metric.device_type)}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white capitalize mb-1">
                    {metric.device_type}
                  </h3>
                  <p className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {metric.count.toLocaleString()}
                  </p>
                  <p className="text-sm font-bold text-orange-600">{metric.percentage}%</p>

                  <div className="mt-3 w-full bg-gray-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${getDeviceColor(metric.device_type)}`}
                      style={{ width: `${metric.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shop Views by Device */}
        {shopViews.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Shop Views by Device</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Device</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-700 dark:text-neutral-200">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                  {shopViews.map((metric) => (
                    <tr key={metric.device_type} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                      <td className="px-6 py-3 text-sm font-semibold text-slate-900 dark:text-white capitalize flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getDeviceColor(metric.device_type)} flex items-center justify-center text-white`}>
                          {getDeviceIcon(metric.device_type)}
                        </div>
                        {metric.device_type}
                      </td>
                      <td className="px-6 py-3 text-sm font-bold text-blue-600">
                        {metric.count.toLocaleString()}
                      </td>
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
