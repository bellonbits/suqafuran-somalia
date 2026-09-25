'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import type { TraceSpan } from '../../store/monitoring/useTracesStore';

interface TraceWaterfallProps {
  spans: TraceSpan[];
  totalDurationMs: number;
}

interface SpanWithOffset extends TraceSpan {
  offsetMs: number;
  relativeStart: number;
  relativeEnd: number;
}

export const TraceWaterfall: React.FC<TraceWaterfallProps> = ({
  spans,
  totalDurationMs,
}) => {
  const sortedSpans = useMemo(() => {
    if (!spans.length) return [];

    const minStartTime = Math.min(...spans.map((s) => s.start_time));

    return spans
      .map((span) => ({
        ...span,
        offsetMs: (span.start_time - minStartTime) / 1000,
        relativeStart: ((span.start_time - minStartTime) / (totalDurationMs * 1000)) * 100,
        relativeEnd:
          ((span.start_time - minStartTime + span.duration) / (totalDurationMs * 1000)) * 100,
      }))
      .sort((a, b) => a.start_time - b.start_time);
  }, [spans, totalDurationMs]);

  const serviceGroups = useMemo(() => {
    const groups: Record<string, SpanWithOffset[]> = {};
    sortedSpans.forEach((span) => {
      if (!groups[span.service_name]) {
        groups[span.service_name] = [];
      }
      groups[span.service_name].push(span);
    });
    return Object.entries(groups).sort((a, b) =>
      a[1][0].start_time - b[1][0].start_time
    );
  }, [sortedSpans]);

  const getSpanColor = (span: TraceSpan) => {
    if (span.is_error) return 'bg-red-500';
    return 'bg-blue-500';
  };

  const getSpanHoverColor = (span: TraceSpan) => {
    if (span.is_error) return 'hover:bg-red-600';
    return 'hover:bg-blue-600';
  };

  if (!spans.length) {
    return (
      <div className="flex items-center justify-center h-40 bg-slate-50 dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800">
        <p className="text-slate-500 dark:text-neutral-300">No spans in trace</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 px-6 py-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Trace Timeline
          </h3>
          <div className="text-sm text-slate-600 dark:text-neutral-300">
            <span className="font-mono">
              {totalDurationMs.toFixed(2)}ms
            </span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="divide-y divide-slate-200 dark:divide-neutral-800">
        {serviceGroups.map(([serviceName, serviceSpans]) => (
          <div key={serviceName} className="px-6 py-4">
            {/* Service Header */}
            <div className="mb-4">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {serviceName}
              </p>
              <p className="text-xs text-slate-500 dark:text-neutral-300">
                {serviceSpans.length} span{serviceSpans.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Service Spans */}
            <div className="space-y-3">
              {serviceSpans.map((span) => (
                <div key={span.span_id} className="space-y-1">
                  {/* Span label */}
                  <div className="flex items-start gap-3">
                    <div className="w-24 shrink-0">
                      <p className="text-xs font-medium text-slate-700 dark:text-neutral-200 truncate">
                        {span.operation_name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-neutral-300">
                        {span.duration_ms.toFixed(2)}ms
                      </p>
                    </div>

                    {/* Bar container */}
                    <div className="flex-1">
                      {/* Timeline bar */}
                      <div className="relative h-6 bg-slate-100 dark:bg-neutral-800 rounded overflow-hidden">
                        {/* Span bar */}
                        <div
                          className={`absolute h-full ${getSpanColor(
                            span
                          )} ${getSpanHoverColor(
                            span
                          )} transition-colors cursor-pointer rounded opacity-80 hover:opacity-100 flex items-center`}
                          style={{
                            left: `${span.relativeStart}%`,
                            width: `${Math.max(span.relativeEnd - span.relativeStart, 0.5)}%`,
                          }}
                          title={`${span.operation_name}: ${span.duration_ms.toFixed(2)}ms`}
                        >
                          {span.is_error && (
                            <AlertTriangle className="h-3 w-3 text-white ml-1" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="shrink-0">
                      {span.is_error ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/30 rounded text-red-700 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          <span className="text-xs font-medium">Error</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-green-700 dark:text-green-400">
                          <Check className="h-3 w-3" />
                          <span className="text-xs font-medium">OK</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Error message (if error) */}
                  {span.is_error && span.error_message && (
                    <p className="text-xs text-red-600 dark:text-red-400 ml-24 font-mono">
                      {span.error_message}
                    </p>
                  )}

                  {/* Tags (if any) */}
                  {Object.keys(span.tags).length > 0 && (
                    <div className="ml-24 flex flex-wrap gap-1">
                      {Object.entries(span.tags)
                        .slice(0, 3)
                        .map(([key, value]) => (
                          <span
                            key={key}
                            className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 rounded"
                            title={`${key}: ${value}`}
                          >
                            {key}
                          </span>
                        ))}
                      {Object.keys(span.tags).length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 rounded">
                          +{Object.keys(span.tags).length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline scale at bottom */}
      <div className="border-t border-slate-200 dark:border-neutral-800 px-6 py-3 bg-slate-50 dark:bg-neutral-900">
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-neutral-300">
          <span>0ms</span>
          <span>{(totalDurationMs / 2).toFixed(0)}ms</span>
          <span>{totalDurationMs.toFixed(0)}ms</span>
        </div>
      </div>
    </div>
  );
};
