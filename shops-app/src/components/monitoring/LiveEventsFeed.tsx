'use client';

import React, { useRef, useEffect } from 'react';
import { AlertCircle, Check, Clock, Zap } from 'lucide-react';
import { useLiveEventsStore } from '../../store/monitoring/useLiveEventsStore';
import type { LiveEvent } from '../../services/liveEventsService';

export const LiveEventsFeed: React.FC = () => {
  const store = useLiveEventsStore();
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (store.autoScroll && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [store.filteredEvents, store.autoScroll]);

  const getEventIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Check className="h-4 w-4 text-green-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      default:
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  const formatEventType = (type: string) => {
    return type.split('.').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  if (store.filteredEvents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50 dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800">
        <Clock className="h-12 w-12 text-slate-300 dark:text-neutral-200 mb-4" />
        <p className="text-slate-600 dark:text-neutral-300 font-medium">
          {store.isConnected ? 'Waiting for events...' : 'Not connected'}
        </p>
        <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
          {store.isConnected ? 'Events will appear here in real-time' : 'Connect to stream to see events'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {store.filteredEvents.map((event, index) => (
        <div
          key={`${event.timestamp}-${index}`}
          className={`border rounded-lg p-4 ${getSeverityColor(event.severity)}`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">{getEventIcon(event.severity)}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-slate-900 dark:text-white">
                  {formatEventType(event.event_type)}
                </p>
                <p className="text-xs text-slate-600 dark:text-neutral-300 shrink-0">
                  {formatTime(event.timestamp)}
                </p>
              </div>

              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 bg-white dark:bg-neutral-800 rounded text-slate-600 dark:text-neutral-300">
                  {event.service}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-medium ${
                    event.severity === 'error'
                      ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : event.severity === 'warning'
                        ? 'bg-yellow-200 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                        : 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                  }`}
                >
                  {event.severity}
                </span>
              </div>

              {/* Event data */}
              {Object.keys(event.data).length > 0 && (
                <div className="mt-2 text-xs text-slate-700 dark:text-neutral-200 space-y-1">
                  {Object.entries(event.data)
                    .slice(0, 3)
                    .map(([key, value]) => (
                      <div key={key} className="font-mono">
                        <span className="text-slate-600 dark:text-neutral-300">{key}:</span>{' '}
                        <span>
                          {typeof value === 'object' ? JSON.stringify(value) : String(value).substring(0, 50)}
                        </span>
                      </div>
                    ))}
                  {Object.keys(event.data).length > 3 && (
                    <p className="text-slate-600 dark:text-neutral-300">
                      +{Object.keys(event.data).length - 3} more fields
                    </p>
                  )}
                </div>
              )}

              {/* IDs */}
              {(event.trace_id || event.correlation_id) && (
                <div className="mt-2 text-xs space-y-1">
                  {event.trace_id && (
                    <p className="text-slate-600 dark:text-neutral-300 font-mono">
                      trace: <span className="text-slate-500 dark:text-neutral-300">{event.trace_id.substring(0, 16)}...</span>
                    </p>
                  )}
                  {event.correlation_id && (
                    <p className="text-slate-600 dark:text-neutral-300 font-mono">
                      corr: <span className="text-slate-500 dark:text-neutral-300">{event.correlation_id.substring(0, 16)}...</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={feedEndRef} />
    </div>
  );
};
