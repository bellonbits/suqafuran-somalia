'use client';

import React, { useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { MonitoringLayout } from '@/components/monitoring/MonitoringLayout';
import { TopicStatusBadge } from '@/components/monitoring/TopicStatusBadge';
import { useKafkaStore } from '@/store/monitoring/useKafkaStore';
import { usePolling } from '@/hooks/monitoring/usePolling';
import { monitoringService } from '@/services/monitoringService';

export default function KafkaTopicsPage() {
  const store = useKafkaStore();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval] = useState(15000);

  // Fetch Kafka topics
  const fetchTopics = useCallback(async () => {
    store.setLoading(true);
    try {
      const data = await monitoringService.getKafkaTopics();
      store.setTopics(data.topics);
    } catch (error) {
      console.error('Failed to fetch Kafka topics:', error);
      store.setError(
        error instanceof Error ? error.message : 'Failed to fetch Kafka topics'
      );
    }
  }, [store]);

  // Set up polling
  usePolling(fetchTopics, refreshInterval, autoRefresh);

  if (store.loading && store.topics.length === 0) {
    return (
      <MonitoringLayout
        onRefresh={fetchTopics}
        isLoading={store.loading}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-slate-600 dark:text-neutral-300">Loading Kafka topics...</p>
          </div>
        </div>
      </MonitoringLayout>
    );
  }

  if (store.error && store.topics.length === 0) {
    return (
      <MonitoringLayout
        onRefresh={fetchTopics}
        isLoading={store.loading}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
      >
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 dark:text-red-400">{store.error}</p>
            <button
              onClick={fetchTopics}
              className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      </MonitoringLayout>
    );
  }

  const laggingTopics = store.topics.filter((t) => t.status === 'lagging').length;
  const stalledTopics = store.topics.filter((t) => t.status === 'stalled').length;

  return (
    <MonitoringLayout
      onRefresh={fetchTopics}
      isLoading={store.loading}
      autoRefresh={autoRefresh}
      onAutoRefreshChange={setAutoRefresh}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Kafka Topics
        </h1>
        <p className="text-slate-600 dark:text-neutral-300">
          {store.topics.length} topics • {laggingTopics} lagging • {stalledTopics} stalled
        </p>
      </div>

      {/* Topics Table */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-4 text-left font-semibold text-slate-900 dark:text-white">
                  Topic Name
                </th>
                <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                  Partitions
                </th>
                <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                  Total Messages
                </th>
                <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                  Messages/sec
                </th>
                <th className="px-4 py-4 text-right font-semibold text-slate-900 dark:text-white">
                  Consumer Lag
                </th>
                <th className="px-4 py-4 text-left font-semibold text-slate-900 dark:text-white">
                  Status
                </th>
                <th className="px-4 py-4 text-center font-semibold text-slate-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
              {store.topics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500 dark:text-neutral-300">
                    No topics available
                  </td>
                </tr>
              ) : (
                store.topics.map((topic) => (
                  <tr
                    key={topic.name}
                    className="hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors"
                  >
                    <td className="px-4 py-4 font-medium text-slate-900 dark:text-white">
                      {topic.name}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {topic.partition_count}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {topic.total_messages.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {topic.messages_per_sec.toFixed(2)} msg/s
                    </td>
                    <td className="px-4 py-4 text-right text-slate-600 dark:text-neutral-300">
                      {topic.consumer_lag.toLocaleString()}
                    </td>
                    <td className="px-4 py-4">
                      <TopicStatusBadge
                        status={topic.status as any}
                        consumerLag={topic.consumer_lag}
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Link
                        href={`/admin/monitoring/kafka/${encodeURIComponent(topic.name)}`}
                        className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 transition-colors"
                      >
                        <span className="text-xs font-medium">View</span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-4 text-right text-xs text-slate-500 dark:text-neutral-300">
        Last updated: {store.lastUpdated?.toLocaleTimeString()}
      </div>
    </MonitoringLayout>
  );
}
