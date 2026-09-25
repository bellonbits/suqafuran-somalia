'use client';

import React, { useEffect, useState } from 'react';
import { Filter, X, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { MonitoringLayout } from '@/components/monitoring/MonitoringLayout';
import { LiveEventsFeed } from '@/components/monitoring/LiveEventsFeed';
import { useLiveEventsStore } from '@/store/monitoring/useLiveEventsStore';
import { liveEventsService, LiveEventType } from '@/services/liveEventsService';

const EVENT_CATEGORIES = {
  Notifications: [
    LiveEventType.NotificationSent,
    LiveEventType.NotificationDelivered,
    LiveEventType.NotificationFailed,
  ],
  Kafka: [LiveEventType.KafkaMessage, LiveEventType.KafkaLagChanged],
  Orders: [
    LiveEventType.OrderCreated,
    LiveEventType.OrderPaid,
    LiveEventType.OrderShipped,
    LiveEventType.OrderCancelled,
  ],
  System: [LiveEventType.AlertTriggered, LiveEventType.SystemError],
};

export default function LiveEventsPage() {
  const store = useLiveEventsStore();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    // Load event history on mount
    const loadHistory = async () => {
      try {
        const response = await liveEventsService.getEventHistory(50);
        response.events.forEach((event) => store.addEvent(event));
        store.setActiveConnections(response.active_connections);
      } catch (error) {
        console.error('Failed to load event history:', error);
      }
    };

    loadHistory();

    // Connect to WebSocket
    const handleNewEvent = (event: any) => {
      if (event.type !== 'connection') {
        store.addEvent(event);
      }
    };

    const handleError = (error: Error) => {
      store.setConnectionError(error.message);
    };

    const handleClose = () => {
      store.setConnected(false);
    };

    liveEventsService.onMessage(handleNewEvent);
    liveEventsService.onError(handleError);
    liveEventsService.onClose(handleClose);

    liveEventsService
      .connect(handleNewEvent)
      .then(() => {
        store.setConnected(true);
      })
      .catch((error) => {
        store.setConnectionError(error.message);
      });

    // Cleanup on unmount
    return () => {
      liveEventsService.offMessage(handleNewEvent);
      liveEventsService.offError(handleError);
      liveEventsService.offClose(handleClose);
      liveEventsService.disconnect();
      store.reset();
    };
  }, [store]);

  const handleReconnect = async () => {
    liveEventsService.disconnect();
    store.clearEvents();
    store.setConnectionError(null);

    try {
      await liveEventsService.connect(() => {});
      store.setConnected(true);

      // Reload history
      const response = await liveEventsService.getEventHistory(50);
      response.events.forEach((event) => store.addEvent(event));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      store.setConnectionError(message);
    }
  };

  const allAvailableServices = Array.from(
    new Set(store.events.map((e) => e.service))
  ).sort();

  return (
    <MonitoringLayout>
      <div className="space-y-6">
        {/* Status Bar */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    store.isConnected ? 'bg-[#02CCFE] animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {store.isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="text-sm text-slate-600 dark:text-neutral-300">
                {store.activeConnections} active connection
                {store.activeConnections !== 1 ? 's' : ''}
              </div>

              <div className="text-sm text-slate-600 dark:text-neutral-300">
                {store.events.length} events captured
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => store.setAutoScroll(!store.autoScroll)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-900 rounded transition-colors"
                title={store.autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
              >
                {store.autoScroll ? (
                  <Volume2 className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                ) : (
                  <VolumeX className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
                )}
              </button>

              <button
                onClick={handleReconnect}
                disabled={store.isConnected}
                className="p-2 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                title="Reconnect"
              >
                <RotateCcw className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
              </button>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded transition-colors ${
                  showFilters
                    ? 'bg-orange-50 dark:bg-orange-950/30 dark:bg-orange-900/30'
                    : 'hover:bg-slate-100 dark:hover:bg-neutral-900'
                }`}
              >
                <Filter className="h-4 w-4 text-slate-600 dark:text-neutral-300" />
              </button>
            </div>
          </div>

          {/* Error Message */}
          {store.connectionError && (
            <div className="mt-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              <p className="text-sm text-red-800 dark:text-red-300">{store.connectionError}</p>
            </div>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">Filters</h3>
              {Object.keys(store.filters).some(
                (key) =>
                  store.filters[key as keyof typeof store.filters].size > 0
              ) && (
                <button
                  onClick={() => store.clearFilters()}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Event Type Filters */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Event Types
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(EVENT_CATEGORIES).map(([category, types]) => (
                  <div key={category} className="space-y-2">
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                      {category}
                    </p>
                    <div className="space-y-1 ml-2">
                      {types.map((type) => (
                        <label
                          key={type}
                          className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={store.filters.eventTypes.has(type)}
                            onChange={() => store.toggleEventTypeFilter(type)}
                            className="rounded"
                          />
                          {type.split('.')[1]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Filters */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Severity
              </p>
              <div className="flex gap-3">
                {(['info', 'warning', 'error'] as const).map((severity) => (
                  <label
                    key={severity}
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={store.filters.severities.has(severity)}
                      onChange={() => store.toggleSeverityFilter(severity)}
                      className="rounded"
                    />
                    {severity}
                  </label>
                ))}
              </div>
            </div>

            {/* Service Filters */}
            {allAvailableServices.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Services
                </p>
                <div className="space-y-1">
                  {allAvailableServices.map((service) => (
                    <label
                      key={service}
                      className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={store.filters.services.has(service)}
                        onChange={() => store.toggleServiceFilter(service)}
                        className="rounded"
                      />
                      {service}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Feed */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-6">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Event Stream ({store.filteredEvents.length})
            </h3>
            {store.filters.eventTypes.size > 0 ||
            store.filters.severities.size > 0 ||
            store.filters.services.size > 0 ? (
              <p className="text-xs text-slate-500 dark:text-neutral-300 mt-1">
                Filtered from {store.events.length} total events
              </p>
            ) : null}
          </div>

          <LiveEventsFeed />
        </div>
      </div>
    </MonitoringLayout>
  );
}
