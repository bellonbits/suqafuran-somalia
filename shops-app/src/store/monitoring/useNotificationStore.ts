import { create } from 'zustand';

export interface FunnelStage {
  name: string;
  count: number;
}

export interface NotificationFunnelItem {
  event_type: string;
  channel: string;
  stages: FunnelStage[];
  success_rate: number;
  total_sent: number;
  total_failed: number;
  avg_delivery_time_ms: number;
}

export interface NotificationSummaryItem {
  event_type: string;
  channel: string;
  provider: string;
  sent: number;
  failed: number;
  pending: number;
  success_rate: number;
  failure_rate: number;
  avg_delivery_time_ms: number;
  last_24h_trend: number;
}

export interface NotificationEvent {
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

interface NotificationStore {
  // Funnel data
  funnel: NotificationFunnelItem[];
  summary: NotificationSummaryItem[];
  events: NotificationEvent[];

  // Pagination
  eventsTotal: number;
  eventsSkip: number;
  eventsLimit: number;

  // Loading states
  funnelLoading: boolean;
  summaryLoading: boolean;
  eventsLoading: boolean;
  retryLoading: boolean;

  // Error states
  funnelError: string | null;
  summaryError: string | null;
  eventsError: string | null;

  // Filters
  dateFrom: Date | null;
  dateTo: Date | null;
  filterChannel: string | null;
  filterEventType: string | null;
  filterStatus: string | null;
  filterUserId: number | null;

  // Actions
  setFunnel: (funnel: NotificationFunnelItem[]) => void;
  setSummary: (summary: NotificationSummaryItem[]) => void;
  setEvents: (events: NotificationEvent[], total: number) => void;
  setFunnelLoading: (loading: boolean) => void;
  setSummaryLoading: (loading: boolean) => void;
  setEventsLoading: (loading: boolean) => void;
  setRetryLoading: (loading: boolean) => void;
  setFunnelError: (error: string | null) => void;
  setSummaryError: (error: string | null) => void;
  setEventsError: (error: string | null) => void;
  setFilters: (filters: Partial<{
    dateFrom: Date | null;
    dateTo: Date | null;
    channel: string | null;
    eventType: string | null;
    status: string | null;
    userId: number | null;
  }>) => void;
  setEventsPage: (skip: number, limit: number) => void;
  reset: () => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  funnel: [],
  summary: [],
  events: [],
  eventsTotal: 0,
  eventsSkip: 0,
  eventsLimit: 50,
  funnelLoading: false,
  summaryLoading: false,
  eventsLoading: false,
  retryLoading: false,
  funnelError: null,
  summaryError: null,
  eventsError: null,
  dateFrom: null,
  dateTo: null,
  filterChannel: null,
  filterEventType: null,
  filterStatus: null,
  filterUserId: null,

  setFunnel: (funnel) =>
    set({
      funnel,
      funnelError: null,
      funnelLoading: false,
    }),

  setSummary: (summary) =>
    set({
      summary,
      summaryError: null,
      summaryLoading: false,
    }),

  setEvents: (events, total) =>
    set({
      events,
      eventsTotal: total,
      eventsError: null,
      eventsLoading: false,
    }),

  setFunnelLoading: (loading) => set({ funnelLoading: loading }),

  setSummaryLoading: (loading) => set({ summaryLoading: loading }),

  setEventsLoading: (loading) => set({ eventsLoading: loading }),

  setRetryLoading: (loading) => set({ retryLoading: loading }),

  setFunnelError: (error) => set({ funnelError: error, funnelLoading: false }),

  setSummaryError: (error) => set({ summaryError: error, summaryLoading: false }),

  setEventsError: (error) => set({ eventsError: error, eventsLoading: false }),

  setFilters: (filters) =>
    set({
      dateFrom: filters.dateFrom ?? null,
      dateTo: filters.dateTo ?? null,
      filterChannel: filters.channel ?? null,
      filterEventType: filters.eventType ?? null,
      filterStatus: filters.status ?? null,
      filterUserId: filters.userId ?? null,
    }),

  setEventsPage: (skip, limit) =>
    set({
      eventsSkip: skip,
      eventsLimit: limit,
    }),

  reset: () =>
    set({
      funnel: [],
      summary: [],
      events: [],
      eventsTotal: 0,
      eventsSkip: 0,
      eventsLimit: 50,
      funnelLoading: false,
      summaryLoading: false,
      eventsLoading: false,
      retryLoading: false,
      funnelError: null,
      summaryError: null,
      eventsError: null,
      dateFrom: null,
      dateTo: null,
      filterChannel: null,
      filterEventType: null,
      filterStatus: null,
      filterUserId: null,
    }),
}));
