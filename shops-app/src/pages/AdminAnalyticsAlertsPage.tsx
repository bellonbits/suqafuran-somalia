"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Bell, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface Alert {
  id: string;
  alert_type: string;
  metric: string;
  threshold: number;
  comparison: string;
  description: string;
}

interface AlertEvent {
  id: string;
  alert_type: string;
  metric_value: number;
  threshold: number;
  entity_type: string | null;
  entity_id: number | null;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [status, setStatus] = useState<"triggered" | "acknowledged" | "resolved">("triggered");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [alertsRes, eventsRes] = await Promise.all([
        analyticsService.getAlerts(),
        analyticsService.getAlertEvents(status),
      ]);
      setAlerts(alertsRes.data?.alerts || []);
      setAlertEvents(eventsRes.data?.events || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [status]);

  const handleAcknowledge = async (eventId: string) => {
    try {
      await analyticsService.acknowledgeAlert(eventId);
      fetchData();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
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
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Alert Management</h1>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        {/* Alert Rules */}
        {alerts.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex items-center gap-2">
              <Bell className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Active Alert Rules</h2>
              <span className="ml-auto text-sm text-slate-400 dark:text-neutral-300">{alerts.length} rules</span>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-neutral-800">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-6 hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900 dark:text-white dark:text-white">{alert.alert_type}</h3>
                      <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">{alert.description}</p>
                      <div className="mt-2 flex gap-3 text-xs font-semibold">
                        <span className="px-2 py-1 bg-blue-50 dark:bg-blue-950/30 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {alert.metric}
                        </span>
                        <span className="px-2 py-1 bg-slate-100 dark:bg-neutral-900 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 dark:text-neutral-200 rounded">
                          {alert.comparison} {alert.threshold}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {alert.notify_admin && (
                        <span className="px-2 py-1 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/30 dark:bg-orange-900/30 rounded">
                          Admin
                        </span>
                      )}
                      {alert.notify_seller && (
                        <span className="px-2 py-1 text-xs font-bold text-green-600 bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 rounded">
                          Seller
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert Events */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-neutral-800 dark:border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white dark:text-white">Alert Events</h2>
            </div>
            <div className="flex gap-2">
              {(['triggered', 'acknowledged', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                    status === s
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 dark:bg-neutral-900 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 dark:text-neutral-200'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)} ({alertEvents.length})
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-neutral-800">
            {alertEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-neutral-300">
                No {status} alerts
              </div>
            ) : (
              alertEvents.map((event) => (
                <div key={event.id} className="p-6 hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-neutral-900/50">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {status === 'triggered' && (
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                        )}
                        {status === 'acknowledged' && (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        {status === 'resolved' && (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        )}
                        <h3 className="font-bold text-slate-900 dark:text-white dark:text-white capitalize">
                          {event.alert_type}
                        </h3>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">{event.message}</p>
                      <p className="text-xs text-slate-400 dark:text-neutral-400 mt-2">
                        Value: {event.metric_value.toLocaleString()} (threshold: {event.threshold})
                      </p>
                      <p className="text-xs text-slate-400 dark:text-neutral-300 mt-1">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>

                    {status === 'triggered' && (
                      <button
                        onClick={() => handleAcknowledge(event.id)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
