import { create } from 'zustand';

export interface TraceSpan {
  span_id: string;
  trace_id: string;
  operation_name: string;
  service_name: string;
  start_time: number;
  duration: number;
  duration_ms: number;
  tags: Record<string, any>;
  logs: any[];
  is_error: boolean;
  error_message: string | null;
}

export interface TraceDetail {
  trace_id: string;
  total_duration_ms: number;
  span_count: number;
  service_count: number;
  has_errors: boolean;
  error_count: number;
  spans: TraceSpan[];
  error_spans: TraceSpan[];
}

export interface TraceSummary {
  trace_id: string;
  total_duration_ms: number;
  span_count: number;
  service_count: number;
  has_errors: boolean;
  error_count: number;
}

export interface CriticalPath {
  id: string;
  name: string;
  description: string;
  operations: string[];
  key_services: string[];
  typical_duration_ms: number;
}

interface TracesStore {
  // Search results
  traces: TraceSummary[];
  selectedTrace: TraceDetail | null;

  // Loading/error states
  searchLoading: boolean;
  detailLoading: boolean;
  searchError: string | null;

  // Search parameters
  searchTraceId: string;
  searchCorrelationId: string;
  searchUserId: number | null;
  searchOrderId: string;
  searchService: string;

  // Critical paths
  criticalPaths: CriticalPath[];
  selectedCriticalPath: string | null;

  // Actions
  setTraces: (traces: TraceSummary[]) => void;
  setSelectedTrace: (trace: TraceDetail | null) => void;
  setSearchLoading: (loading: boolean) => void;
  setDetailLoading: (loading: boolean) => void;
  setSearchError: (error: string | null) => void;
  setSearchParams: (params: Partial<{
    traceId: string;
    correlationId: string;
    userId: number | null;
    orderId: string;
    service: string;
  }>) => void;
  setCriticalPaths: (paths: CriticalPath[]) => void;
  setSelectedCriticalPath: (pathId: string | null) => void;
  reset: () => void;
}

export const useTracesStore = create<TracesStore>((set) => ({
  traces: [],
  selectedTrace: null,
  searchLoading: false,
  detailLoading: false,
  searchError: null,
  searchTraceId: '',
  searchCorrelationId: '',
  searchUserId: null,
  searchOrderId: '',
  searchService: '',
  criticalPaths: [],
  selectedCriticalPath: null,

  setTraces: (traces) =>
    set({
      traces,
      searchError: null,
      searchLoading: false,
    }),

  setSelectedTrace: (trace) =>
    set({
      selectedTrace: trace,
      detailLoading: false,
    }),

  setSearchLoading: (loading) => set({ searchLoading: loading }),

  setDetailLoading: (loading) => set({ detailLoading: loading }),

  setSearchError: (error) =>
    set({
      searchError: error,
      searchLoading: false,
    }),

  setSearchParams: (params) =>
    set({
      searchTraceId: params.traceId ?? '',
      searchCorrelationId: params.correlationId ?? '',
      searchUserId: params.userId ?? null,
      searchOrderId: params.orderId ?? '',
      searchService: params.service ?? '',
    }),

  setCriticalPaths: (paths) => set({ criticalPaths: paths }),

  setSelectedCriticalPath: (pathId) => set({ selectedCriticalPath: pathId }),

  reset: () =>
    set({
      traces: [],
      selectedTrace: null,
      searchLoading: false,
      detailLoading: false,
      searchError: null,
      searchTraceId: '',
      searchCorrelationId: '',
      searchUserId: null,
      searchOrderId: '',
      searchService: '',
      criticalPaths: [],
      selectedCriticalPath: null,
    }),
}));
