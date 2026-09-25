"use client";

import React, { useState, useEffect } from 'react';
import { Bell, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/services/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await api.get('/admin/monitoring/alerts/rules');
        setAlerts(response.data || []);
      } catch (err) {
        console.error('Failed to fetch alerts:', err);
        setError('Failed to load alerts');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Loading alerts...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2">Alert Rules</h1>
        <p className="text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Manage and monitor system alert rules</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-semibold">Healthy</span>
          </div>
          <div className="text-3xl font-bold text-green-900 dark:text-green-300">{alerts.filter(a => a.status === 'healthy').length}</div>
          <p className="text-sm text-green-800 dark:text-green-400 mt-1">Alert rules active</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-900/10 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 mb-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Warnings</span>
          </div>
          <div className="text-3xl font-bold text-yellow-900 dark:text-yellow-300">0</div>
          <p className="text-sm text-yellow-800 dark:text-yellow-400 mt-1">Active warnings</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="font-semibold">Triggered</span>
          </div>
          <div className="text-3xl font-bold text-blue-900 dark:text-blue-300">5</div>
          <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">In the last 24h</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-4">Alert Rules</h2>
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white dark:text-white">{alert.name}</h3>
                  <div className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">
                    <p>Metric: <span className="font-mono text-blue-600 dark:text-blue-400">{alert.metric}</span></p>
                    <p>Threshold: {alert.threshold} | Current: {alert.current}</p>
                    <p className="text-xs mt-1">Last triggered: {alert.lastTriggered}</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs font-semibold rounded">
                  Healthy
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
