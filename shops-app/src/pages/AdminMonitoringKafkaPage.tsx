"use client";

import React, { useState, useEffect } from 'react';
import { Network, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import api from '@/services/api';

export default function KafkaPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKafkaData = async () => {
      try {
        const [topicsRes, statsRes] = await Promise.all([
          api.get('/admin/monitoring/kafka/topics'),
          api.get('/admin/monitoring/kafka/health')
        ]);
        setTopics(topicsRes.data || []);
        setStats(statsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch Kafka data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchKafkaData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2">Kafka Streams</h1>
        <p className="text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Monitor message brokers and event streams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">Broker Status</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-300">{stats.broker_status || 'Unknown'}</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-green-900 dark:text-green-300">Throughput</span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300">{stats.throughput || '0'} msg/s</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-900/10 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-purple-900 dark:text-purple-300">Topics</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-300">{topics.length}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-900/10 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-semibold text-orange-900 dark:text-orange-300">Consumer Lag</span>
          </div>
          <div className="text-2xl font-bold text-orange-900 dark:text-orange-300">{stats.total_lag || '0'} msgs</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-4">Topics</h2>
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading topics...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Topic</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Partitions</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Messages</th>
                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Consumer Lag</th>
                </tr>
              </thead>
              <tbody>
                {topics.length > 0 ? (
                  topics.map((topic, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-neutral-800 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/50">
                      <td className="px-4 py-3 text-sm text-slate-900 dark:text-white dark:text-white font-mono">{topic.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">{topic.partition_count || topic.partitions}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">{(topic.message_count || topic.messages || 0).toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm">
                        {(topic.consumer_lag || topic.lag) === 0 ? (
                          <span className="text-green-600 dark:text-green-400">0</span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">{topic.consumer_lag || topic.lag}</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-center text-slate-400">No topics found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
