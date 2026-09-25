"use client";

import React, { useState, useEffect } from 'react';
import { Radio, Activity } from 'lucide-react';
import api from '@/services/api';

export default function LiveEventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, statsRes] = await Promise.all([
          api.get('/admin/monitoring/live/history?limit=10'),
          api.get('/admin/monitoring/overview')
        ]);
        setEvents(eventsRes.data || []);
        setStats(statsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch live events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2 flex items-center gap-2">
          <Radio className="w-8 h-8 text-green-600 animate-pulse" />
          Live Events
        </h1>
        <p className="text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Real-time event streaming from Kafka and WebSocket</p>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 bg-[#02CCFE] rounded-full animate-pulse"></div>
          <span className="font-semibold text-green-900 dark:text-green-300">Live Stream Active</span>
        </div>
        <p className="text-green-800 dark:text-green-400 text-sm">
          WebSocket connection established • Listening for events on kafka:9092
        </p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Event Stream
        </h2>
        <div className="bg-slate-900 dark:bg-black rounded-xl border border-slate-700 p-6 font-mono text-sm text-green-400 overflow-auto max-h-96">
          <div className="space-y-1 text-xs">
            {loading ? (
              <div className="text-slate-400">[Loading events...]</div>
            ) : events.length > 0 ? (
              events.map((event, idx) => (
                <div key={idx}>
                  [{new Date(event.timestamp).toLocaleTimeString()}] → {event.event_type}: {JSON.stringify(event.data || {})}
                </div>
              ))
            ) : (
              <div className="text-slate-400">[No events yet...]</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.events_per_minute || '0'}</div>
          <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Events/min</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.delivery_rate || '0'}%</div>
          <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Delivery Rate</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">{stats.avg_latency || '0'}ms</div>
          <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Avg Latency</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{stats.active_topics || '0'}</div>
          <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Topics</p>
        </div>
      </div>
    </div>
  );
}
