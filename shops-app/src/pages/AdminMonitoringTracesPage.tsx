"use client";

import React, { useState, useEffect } from 'react';
import { Zap, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import api from '@/services/api';

export default function TracesPage() {
  const [traces, setTraces] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTraces = async () => {
      try {
        const [tracesRes, statsRes] = await Promise.all([
          api.get('/admin/monitoring/traces/search?limit=10'),
          api.get('/admin/monitoring/traces/stats')
        ]);
        setTraces(tracesRes.data || []);
        setStats(statsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch traces:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTraces();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2">Distributed Traces</h1>
        <p className="text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Request tracing via Jaeger and OpenTelemetry</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Traces</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.total_traces || '0'}</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">In 24 hours</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Avg Duration</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.avg_duration || '0'}ms</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Per request</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Success Rate</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.success_rate || '0'}%</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Last hour</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Slow Traces</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.slow_traces || '0'}</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">&gt; 500ms</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-4">Recent Traces</h2>
        <div className="space-y-2">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading traces...</div>
          ) : traces.length > 0 ? (
            traces.map((trace, idx) => (
              <div key={idx} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400 dark:text-neutral-300">{new Date(trace.start_time).toLocaleTimeString()}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">{trace.service_name || trace.service}</span>
                    <span className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300">{trace.operation_name || trace.operation}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-mono font-bold text-slate-900 dark:text-white dark:text-white">{trace.duration || '0'}ms</div>
                    {(trace.duration || 0) > 500 && (
                      <div className="text-xs text-orange-600 dark:text-orange-400">Slow</div>
                    )}
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded ${
                    trace.status === 'success' || !trace.error
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-orange-50 dark:bg-orange-950/30 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                  }`}>
                    {trace.status || (trace.error ? 'error' : 'success')}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 py-8">No traces found</div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          💡 <strong>Jaeger UI:</strong> Access detailed traces at{' '}
          <a href="http://165.22.13.173:16686" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
            http://165.22.13.173:16686
          </a>
        </p>
      </div>
    </div>
  );
}
