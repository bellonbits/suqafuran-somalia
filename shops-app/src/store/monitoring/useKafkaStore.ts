import { create } from 'zustand';

export interface KafkaTopic {
  name: string;
  partition_count: number;
  total_messages: number;
  messages_per_sec: number;
  consumer_lag: number;
  consumer_groups: string[];
  retention_bytes: number | null;
  retention_ms: number | null;
  status: 'healthy' | 'lagging' | 'stalled';
  last_message_timestamp: string | null;
}

interface KafkaStore {
  topics: KafkaTopic[];
  loading: boolean;
  error: string | null;
  selectedTopic: string | null;
  lastUpdated: Date | null;

  // Actions
  setTopics: (topics: KafkaTopic[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedTopic: (name: string | null) => void;
  reset: () => void;
}

export const useKafkaStore = create<KafkaStore>((set) => ({
  topics: [],
  loading: false,
  error: null,
  selectedTopic: null,
  lastUpdated: null,

  setTopics: (topics) =>
    set({
      topics,
      lastUpdated: new Date(),
      error: null,
      loading: false,
    }),

  setLoading: (loading) => set({ loading }),

  setError: (error) =>
    set({
      error,
      loading: false,
    }),

  setSelectedTopic: (name) => set({ selectedTopic: name }),

  reset: () =>
    set({
      topics: [],
      loading: false,
      error: null,
      selectedTopic: null,
      lastUpdated: null,
    }),
}));
