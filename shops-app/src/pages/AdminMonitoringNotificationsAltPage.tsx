'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import { MonitoringLayout } from '@/components/monitoring/MonitoringLayout';
import { FunnelChart } from '@/components/monitoring/FunnelChart';
import { NotificationEventsList } from '@/components/monitoring/NotificationEventsList';
import { useNotificationStore } from '@/store/monitoring/useNotificationStore';
import { usePolling } from '@/hooks/monitoring/usePolling';
import { monitoringService } from '@/services/monitoringService';

const CHANNELS = ['sms', 'email', 'push'];
const STATUSES = ['sent', 'failed', 'pending', 'delivered'];
const EVENT_TYPES = [
  'auth.otp.requested',
  'auth.signup.success',
  'payments.mpesa.success',
  'catalog.product.created',
];

export default function NotificationsMonitoringPage() {
  const store = useNotificationStore();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState<'funnel' | 'summary' | 'events'>('funnel');

  // Fetch all notification data
  const fetchNotificationData = useCallback(async () => {
    store.setFunnelLoading(true);
    store.setSummaryLoading(true);
    store.setEventsLoading(true);

    try {
      const [funnelRes, summaryRes, eventsRes] = await Promise.all([
        monitoringService.getNotificationFunnel({
          channel: store.filterChannel || undefined,
          eventType: store.filterEventType || undefined,
        }),
        monitoringService.getNotificationSummary({
          channel: store.filterChannel || undefined,
        }),
        monitoringService.getNotificationEvents({
          skip: store.eventsSkip,
          limit: store.eventsLimit,
          status: store.filterStatus || undefined,
          eventType: store.filterEventType || undefined,
          channel: store.filterChannel || undefined,
          userId: store.filterUserId || undefined,
        }),
      ]);

      store.setFunnel(funnelRes.funnel);
      store.setSummary(summaryRes.summary);
      store.setEvents(eventsRes.events, eventsRes.total);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch notification data';
      store.setFunnelError(errorMsg);
      store.setSummaryError(errorMsg);
      store.setEventsError(errorMsg);
    }
  }, [store]);

  // Set up polling
  usePolling(fetchNotificationData, 15000, autoRefresh);

  const handleFilterChange = (key: string, value: any) => {
    store.setFilters({
      [key === 'channel' ? 'channel' : key === 'eventType' ? 'eventType' : key === 'status' ? 'status' : 'userId']:
        value,
    });
    store.setEventsPage(0, store.eventsLimit); // Reset to first page
  };

  const clearFilters = () => {
    store.setFilters({
      channel: null,
      eventType: null,
      status: null,
      userId: null,
    });
  };

  const hasActiveFilters =
    store.filterChannel || store.filterEventType || store.filterStatus || store.filterUserId;

  return (
    <MonitoringLayout
      onRefresh={fetchNotificationData}
      isLoading={store.funnelLoading || store.summaryLoading || store.eventsLoading}
      autoRefresh={autoRefresh}
      onAutoRefreshChange={setAutoRefresh}
    >
      {/* Filter Bar */}
      <div className="mb-6 bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs px-2 py-1 rounded text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Channel Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-200 mb-2">
              Channel
            </label>
            <select
              value={store.filterChannel || ''}
              onChange={(e) => handleFilterChange('channel', e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Channels</option>
              {CHANNELS.map((ch) => (
                <option key={ch} value={ch}>
                  {ch}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-200 mb-2">
              Event Type
            </label>
            <select
              value={store.filterEventType || ''}
              onChange={(e) => handleFilterChange('eventType', e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Event Types</option>
              {EVENT_TYPES.map((evt) => (
                <option key={evt} value={evt}>
                  {evt}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-200 mb-2">
              Status
            </label>
            <select
              value={store.filterStatus || ''}
              onChange={(e) => handleFilterChange('status', e.target.value || null)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* User ID Search */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-neutral-200 mb-2">
              User ID
            </label>
            <input
              type="number"
              placeholder="Search by user ID..."
              value={store.filterUserId || ''}
              onChange={(e) => handleFilterChange('userId', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-slate-200 dark:border-neutral-800">
        {['funnel', 'summary', 'events'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-orange-600 dark:text-orange-400 border-orange-600'
                : 'text-slate-600 dark:text-neutral-300 border-transparent hover:text-slate-900 dark:hover:text-neutral-100'
            }`}
          >
            {tab === 'funnel'
              ? 'Funnel'
              : tab === 'summary'
                ? 'Summary'
                : 'Individual Events'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'funnel' && (
        <div className="space-y-6">
          {store.funnel.map((funnelItem) => (
            <FunnelChart
              key={`${funnelItem.event_type}-${funnelItem.channel}`}
              stages={funnelItem.stages}
              title={`${funnelItem.event_type} (${funnelItem.channel})`}
              height={250}
            />
          ))}
          {store.funnel.length === 0 && !store.funnelLoading && (
            <div className="text-center py-12 text-slate-500 dark:text-neutral-300">
              No funnel data available
            </div>
          )}
        </div>
      )}

      {activeTab === 'summary' && (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-4 text-left font-semibold text-slate-900 dark:text-white">
                    Event Type
                  </th>
                  <th className="px-4 py-4 text-left font-semibold text-slate-900 dark:text-white">
                    Channel
                  </th>
                  <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                    Sent
                  </th>
                  <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                    Failed
                  </th>
                  <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                    Success Rate
                  </th>
                  <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                    Avg Delivery
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
                {store.summary.map((item) => (
                  <tr
                    key={`${item.event_type}-${item.channel}`}
                    className={`hover:bg-slate-50 dark:hover:bg-neutral-900 ${
                      item.failure_rate > 5 ? 'bg-red-50 dark:bg-red-900/10' : ''
                    }`}
                  >
                    <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                      {item.event_type}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-neutral-300">
                      {item.channel}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {item.sent.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-red-600 dark:text-red-400">
                      {item.failed.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          item.success_rate > 95
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : item.success_rate > 90
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              : 'bg-rose-50 dark:bg-rose-950/30 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {item.success_rate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {item.avg_delivery_time_ms}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="space-y-4">
          <NotificationEventsList
            events={store.events}
            isLoading={store.eventsLoading}
            onRetry={fetchNotificationData}
          />

          {/* Pagination */}
          {store.eventsTotal > store.eventsLimit && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-600 dark:text-neutral-300">
                Showing {store.eventsSkip + 1}-{Math.min(store.eventsSkip + store.eventsLimit, store.eventsTotal)} of{' '}
                {store.eventsTotal}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    store.setEventsPage(Math.max(0, store.eventsSkip - store.eventsLimit), store.eventsLimit)
                  }
                  disabled={store.eventsSkip === 0}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-neutral-700 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    store.setEventsPage(store.eventsSkip + store.eventsLimit, store.eventsLimit)
                  }
                  disabled={store.eventsSkip + store.eventsLimit >= store.eventsTotal}
                  className="px-3 py-1 rounded border border-slate-300 dark:border-neutral-700 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </MonitoringLayout>
  );
}
