'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Search, AlertCircle, X, Loader } from 'lucide-react';
import { MonitoringLayout } from '@/components/monitoring/MonitoringLayout';
import { TraceWaterfall } from '@/components/monitoring/TraceWaterfall';
import { useTracesStore } from '@/store/monitoring/useTracesStore';
import { tracesService } from '@/services/tracesService';

export default function TracesPage() {
  const store = useTracesStore();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState<
    'trace_id' | 'correlation_id' | 'user_id' | 'order_id'
  >('trace_id');

  // Load critical paths on mount
  useEffect(() => {
    const loadCriticalPaths = async () => {
      try {
        const response = await tracesService.getCriticalPaths();
        store.setCriticalPaths(response.critical_paths);
      } catch (error) {
        console.error('Failed to load critical paths:', error);
      }
    };
    loadCriticalPaths();
  }, [store]);

  const handleSearch = useCallback(async () => {
    if (!searchInput.trim()) {
      store.setSearchError('Please enter a search value');
      return;
    }

    store.setSearchLoading(true);
    try {
      const params: any = {
        limit: 20,
        lookback: '24h',
      };

      if (searchType === 'trace_id') {
        params.traceId = searchInput;
      } else if (searchType === 'correlation_id') {
        params.correlationId = searchInput;
      } else if (searchType === 'user_id') {
        params.userId = parseInt(searchInput);
      } else if (searchType === 'order_id') {
        params.orderId = searchInput;
      }

      const response = await tracesService.searchTraces(params);

      if (searchType === 'trace_id' && (response as any).trace) {
        // Single trace result - trace_id search returns the full trace
        store.setSelectedTrace((response as any).trace);
        setShowDetail(true);
        store.setTraces([]);
      } else {
        // Multiple traces result
        store.setTraces(response.traces);
        setShowDetail(false);
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to search traces';
      store.setSearchError(errorMsg);
    } finally {
      store.setSearchLoading(false);
    }
  }, [searchInput, searchType, store]);

  const handleSelectTrace = useCallback(async (traceId: string) => {
    store.setDetailLoading(true);
    try {
      const response = await tracesService.getTraceDetail(traceId);
      store.setSelectedTrace(response.trace);
      setShowDetail(true);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Failed to fetch trace detail';
      store.setSearchError(errorMsg);
    } finally {
      store.setDetailLoading(false);
    }
  }, [store]);

  const handleUseCriticalPath = useCallback(
    async (pathId: string) => {
      store.setSelectedCriticalPath(pathId);

      // For now, just show the path selection
      // In a real implementation, this would search for traces matching the critical path pattern
      const path = store.criticalPaths.find((p) => p.id === pathId);
      if (path) {
        setSearchInput(path.description);
        // Keep search type as is since critical paths are demonstration
      }
    },
    [store]
  );

  const handleClear = useCallback(() => {
    store.reset();
    setSearchInput('');
    setShowDetail(false);
  }, [store]);

  return (
    <MonitoringLayout
      onRefresh={handleSearch}
      isLoading={store.searchLoading || store.detailLoading}
      autoRefresh={autoRefresh}
      onAutoRefreshChange={setAutoRefresh}
    >
      <div className="space-y-6">
        {/* Search Section */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Search Traces
              </h2>
              <p className="text-sm text-slate-600 dark:text-neutral-300 mb-4">
                Search distributed traces by trace ID, correlation ID, user ID, or order ID
              </p>
            </div>

            {/* Search Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  'trace_id',
                  'correlation_id',
                  'user_id',
                  'order_id',
                ] as const
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSearchType(type);
                    setSearchInput('');
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    searchType === type
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {type === 'trace_id'
                    ? 'Trace ID'
                    : type === 'correlation_id'
                      ? 'Correlation ID'
                      : type === 'user_id'
                        ? 'User ID'
                        : 'Order ID'}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={`Search by ${
                  searchType === 'trace_id'
                    ? 'trace ID'
                    : searchType === 'correlation_id'
                      ? 'correlation ID'
                      : searchType === 'user_id'
                        ? 'user ID (number)'
                        : 'order ID'
                }...`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button
                onClick={handleSearch}
                disabled={store.searchLoading}
                className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                {store.searchLoading ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Search
              </button>
              {(store.traces.length > 0 || store.selectedTrace) && (
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Error Message */}
            {store.searchError && (
              <div className="flex gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-300">
                  {store.searchError}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Critical Paths Section */}
        {store.criticalPaths.length > 0 && !showDetail && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-6">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                  Critical Paths
                </h3>
                <p className="text-sm text-slate-600 dark:text-neutral-300">
                  Quick templates to analyze common flows
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {store.criticalPaths.map((path) => (
                  <button
                    key={path.id}
                    onClick={() => handleUseCriticalPath(path.id)}
                    className="p-4 rounded-xl border border-slate-200 dark:border-neutral-800 hover:border-orange-500 dark:hover:border-orange-500 bg-slate-50 dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors text-left"
                  >
                    <p className="font-semibold text-slate-900 dark:text-white mb-1">
                      {path.name}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-neutral-300 mb-2">
                      {path.description}
                    </p>
                    <div className="flex gap-1 flex-wrap">
                      {path.operations.slice(0, 2).map((op) => (
                        <span
                          key={op}
                          className="text-xs px-2 py-1 bg-white dark:bg-neutral-950 rounded text-slate-600 dark:text-neutral-300"
                        >
                          {op.split('.').pop()}
                        </span>
                      ))}
                      {path.operations.length > 2 && (
                        <span className="text-xs px-2 py-1 text-slate-600 dark:text-neutral-300">
                          +{path.operations.length - 2} more
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Traces List */}
        {!showDetail && store.traces.length > 0 && (
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 px-6 py-4">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Traces ({store.traces.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-neutral-800">
              {store.traces.map((trace) => (
                <button
                  key={trace.trace_id}
                  onClick={() => handleSelectTrace(trace.trace_id)}
                  className="w-full px-6 py-4 hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-slate-900 dark:text-white truncate">
                        {trace.trace_id}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-neutral-300 mt-1">
                        {trace.span_count} spans · {trace.service_count} services ·{' '}
                        {trace.total_duration_ms.toFixed(2)}ms
                      </p>
                    </div>

                    {trace.has_errors && (
                      <div className="shrink-0 px-3 py-1 bg-rose-50 dark:bg-rose-950/30 dark:bg-red-900/30 rounded text-xs font-medium text-red-700 dark:text-red-400">
                        {trace.error_count} error{trace.error_count !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trace Detail */}
        {showDetail && store.selectedTrace && (
          <div className="space-y-4">
            {/* Detail Header */}
            <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-6">
              <button
                onClick={() => setShowDetail(false)}
                className="text-orange-600 hover:text-orange-700 text-sm font-medium mb-4"
              >
                ← Back to Results
              </button>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-600 dark:text-neutral-300 mb-1">
                    Trace ID
                  </p>
                  <p className="font-mono text-sm text-slate-900 dark:text-white">
                    {store.selectedTrace.trace_id}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                      Duration
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {store.selectedTrace.total_duration_ms.toFixed(2)}ms
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                      Spans
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {store.selectedTrace.span_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                      Services
                    </p>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {store.selectedTrace.service_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-neutral-300">
                      Status
                    </p>
                    {store.selectedTrace.has_errors ? (
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">
                        {store.selectedTrace.error_count} Error
                        {store.selectedTrace.error_count !== 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                        Success
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Waterfall Visualization */}
            {store.selectedTrace.spans.length > 0 && (
              <TraceWaterfall
                spans={store.selectedTrace.spans}
                totalDurationMs={store.selectedTrace.total_duration_ms}
              />
            )}
          </div>
        )}

        {/* Empty State */}
        {!showDetail && store.traces.length === 0 && !store.selectedTrace && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Search className="h-12 w-12 text-slate-300 dark:text-neutral-200 mb-4" />
            <p className="text-slate-600 dark:text-neutral-300 font-medium">
              No traces found
            </p>
            <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
              Enter a search value to find traces
            </p>
          </div>
        )}
      </div>
    </MonitoringLayout>
  );
}
