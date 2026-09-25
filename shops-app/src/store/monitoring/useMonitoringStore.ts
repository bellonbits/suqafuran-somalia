import { create } from 'zustand';

interface MonitoringStats {
  events_per_sec: number;
  notification_success_rate: number;
  active_workers: number;
  queue_depth: number;
  p95_latency_ms: number;
  failed_payments_1h: number;
  open_alerts: number;
}

interface TopicHealth {
  name: string;
  messages_per_sec: number;
  consumer_lag: number;
  partition_count: number;
  status: 'healthy' | 'lagging' | 'stalled';
  last_message_timestamp: string | null;
}

interface MonitoringSummary {
  total_topics: number;
  lagging_topics: number;
  stalled_topics: number;
}

interface MonitoringOverview {
  stats: MonitoringStats;
  topic_health: TopicHealth[];
  summary: MonitoringSummary;
  timestamp: string;
}

interface MonitoringStore {
  overview: MonitoringOverview | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  autoRefresh: boolean;
  refreshInterval: number;

  // Actions
  setOverview: (overview: MonitoringOverview) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  reset: () => void;
}

const initialState = {
  overview: null,
  loading: false,
  error: null,
  lastUpdated: null,
  autoRefresh: true,
  refreshInterval: 15000, // 15 seconds
};

export const useMonitoringStore = create<MonitoringStore>((set) => ({
  ...initialState,

  setOverview: (overview) =>
    set({
      overview,
      lastUpdated: new Date(),
      error: null,
    }),

  setLoading: (loading) => set({ loading }),

  setError: (error) =>
    set({
      error,
      loading: false,
    }),

  setAutoRefresh: (enabled) => set({ autoRefresh: enabled }),

  setRefreshInterval: (interval) => set({ refreshInterval: interval }),

  reset: () => set(initialState),
}));
