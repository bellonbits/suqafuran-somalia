'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RefreshCw, Pause, Play } from 'lucide-react';

interface MonitoringLayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  isLoading?: boolean;
  autoRefresh?: boolean;
  onAutoRefreshChange?: (enabled: boolean) => void;
}

const MONITORING_PAGES = [
  { label: 'Overview', href: '/admin/monitoring' },
  { label: 'Kafka Topics', href: '/admin/monitoring/kafka' },
  { label: 'Notifications', href: '/admin/monitoring/notifications' },
  { label: 'Traces', href: '/admin/monitoring/traces' },
  { label: 'Live Events', href: '/admin/monitoring/live' },
  { label: 'Alerts', href: '/admin/monitoring/alerts' },
];

export const MonitoringLayout: React.FC<MonitoringLayoutProps> = ({
  children,
  onRefresh,
  isLoading = false,
  autoRefresh = true,
  onAutoRefreshChange,
}) => {
  const pathname = usePathname();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                System Monitoring
              </h1>
              <p className="text-sm text-slate-600 dark:text-neutral-300 mt-1">
                Real-time dashboard for Kafka, notifications, and system health
              </p>
            </div>

            {/* Refresh Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-200 disabled:opacity-50 transition-colors"
                title="Refresh data"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing || isLoading ? 'animate-spin' : ''}`}
                />
                <span className="text-sm font-medium hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={() => onAutoRefreshChange?.(!autoRefresh)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                    : 'bg-slate-100 text-slate-700 dark:bg-neutral-900 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-800'
                }`}
                title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              >
                {autoRefresh ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span className="text-sm font-medium hidden sm:inline">
                  {autoRefresh ? 'Pause' : 'Live'}
                </span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex overflow-x-auto gap-1 pb-4 -mx-4 sm:mx-0 px-4 sm:px-0">
            {MONITORING_PAGES.map((page) => {
              const isActive = pathname === page.href;
              return (
                <Link
                  key={page.href}
                  href={page.href}
                  className={`px-4 py-2 rounded-t-lg font-medium text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-neutral-950 text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                      : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-200'
                  }`}
                >
                  {page.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
