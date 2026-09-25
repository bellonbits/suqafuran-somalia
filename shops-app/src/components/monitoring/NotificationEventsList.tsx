'use client';

import React, { useState } from 'react';
import {
  Check,
  AlertTriangle,
  Clock,
  Copy,
  RotateCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { monitoringService } from '../../services/monitoringService';

interface NotificationEvent {
  id: string;
  event_id: string;
  event_type: string;
  channel: string;
  provider: string;
  user_id: number;
  status: 'sent' | 'failed' | 'pending' | 'delivered';
  error_message: string | null;
  correlation_id: string;
  trace_id: string;
  dispatched_at: string;
  delivered_at: string | null;
  delivery_time_ms: number | null;
  [key: string]: any;
}

interface NotificationEventsListProps {
  events: NotificationEvent[];
  isLoading?: boolean;
  onRetry?: (notificationId: string) => void;
}

export const NotificationEventsList: React.FC<NotificationEventsListProps> = ({
  events,
  isLoading = false,
  onRetry,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const handleRetry = async (notificationId: string) => {
    setRetryingIds((prev) => new Set(prev).add(notificationId));
    try {
      await monitoringService.retryNotification(notificationId);
      onRetry?.(notificationId);
      alert('Notification queued for retry');
    } catch (error) {
      alert('Failed to retry notification');
      console.error(error);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Check className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Check className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (events.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center h-40 bg-slate-50 dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800">
        <p className="text-slate-500 dark:text-neutral-300">No notification events found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <div
          key={event.id}
          className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden"
        >
          {/* Main Row */}
          <div
            className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
            onClick={() =>
              setExpandedId(expandedId === event.id ? null : event.id)
            }
          >
            {/* Status Icon */}
            <div className="shrink-0">{getStatusIcon(event.status)}</div>

            {/* Event Type & Channel */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 dark:text-white text-sm">
                {event.event_type}
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-300">
                {event.channel} via {event.provider}
              </p>
            </div>

            {/* User ID */}
            <div className="hidden sm:block">
              <p className="text-sm text-slate-700 dark:text-neutral-200 font-mono text-xs">
                User {event.user_id}
              </p>
            </div>

            {/* Status Badge */}
            <div className={`px-2.5 py-1.5 rounded-full text-xs font-medium ${getStatusBadgeColor(event.status)}`}>
              {event.status}
            </div>

            {/* Delivery Time */}
            {event.delivery_time_ms && (
              <div className="hidden md:block text-xs text-slate-600 dark:text-neutral-300">
                {event.delivery_time_ms}ms
              </div>
            )}

            {/* Expand Toggle */}
            <button className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200">
              {expandedId === event.id ? (
                <ChevronUp className="h-5 w-5" />
              ) : (
                <ChevronDown className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Expanded Details */}
          {expandedId === event.id && (
            <div className="border-t border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 p-4 space-y-4">
              {/* Error Message (if failed) */}
              {event.error_message && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
                    Error
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300 font-mono break-words">
                    {event.error_message}
                  </p>
                </div>
              )}

              {/* IDs (copy-to-clipboard) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Correlation ID */}
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-neutral-300 mb-1">
                    Correlation ID
                  </p>
                  <button
                    onClick={() => copyToClipboard(event.correlation_id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-800 rounded border border-slate-200 dark:border-neutral-700 text-xs font-mono text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <span className="truncate">{event.correlation_id}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </div>

                {/* Trace ID */}
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-neutral-300 mb-1">
                    Trace ID
                  </p>
                  <button
                    onClick={() => copyToClipboard(event.trace_id)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-white dark:bg-neutral-800 rounded border border-slate-200 dark:border-neutral-700 text-xs font-mono text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 transition-colors"
                  >
                    <span className="truncate">{event.trace_id}</span>
                    <Copy className="h-3 w-3 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="font-medium text-slate-600 dark:text-neutral-300 mb-1">
                    Dispatched
                  </p>
                  <p className="text-slate-700 dark:text-neutral-200">
                    {new Date(event.dispatched_at).toLocaleString()}
                  </p>
                </div>
                {event.delivered_at && (
                  <div>
                    <p className="font-medium text-slate-600 dark:text-neutral-300 mb-1">
                      Delivered
                    </p>
                    <p className="text-slate-700 dark:text-neutral-200">
                      {new Date(event.delivered_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Retry Button (for failed only) */}
              {event.status === 'failed' && (
                <button
                  onClick={() => handleRetry(event.id)}
                  disabled={retryingIds.has(event.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded font-medium text-sm transition-colors"
                >
                  <RotateCw className="h-4 w-4" />
                  {retryingIds.has(event.id) ? 'Retrying...' : 'Retry Notification'}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
