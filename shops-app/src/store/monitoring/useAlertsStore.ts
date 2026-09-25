import { create } from 'zustand';

export interface AlertRule {
  id: number;
  name: string;
  description?: string;
  metric: string;
  threshold: number;
  comparison_operator: string;
  evaluation_window_minutes: number;
  aggregation_function: string;
  metric_filter?: Record<string, any>;
  notification_channel?: string;
  notification_target?: string;
  severity: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlertHistoryItem {
  id: number;
  rule_id: number;
  status: 'firing' | 'resolved';
  value?: number;
  message?: string;
  fired_at: string;
  resolved_at?: string;
}

export interface AlertStats {
  total_alerts: number;
  firing_alerts: number;
  resolved_alerts: number;
  active_rules: number;
  hours_range: number;
}

interface AlertsStore {
  // Rules
  rules: AlertRule[];
  totalRules: number;
  rulesLoading: boolean;
  rulesError: string | null;

  // History
  history: AlertHistoryItem[];
  totalHistory: number;
  historyLoading: boolean;
  historyError: string | null;

  // Stats
  stats: AlertStats | null;
  statsLoading: boolean;

  // Editing
  editingRule: AlertRule | null;
  editMode: 'create' | 'edit' | null;
  saveLoading: boolean;
  saveError: string | null;
  saveSuccess: string | null;

  // Filtering
  rulesPage: number;
  rulesLimit: number;
  historyPage: number;
  historyLimit: number;
  historyHours: number;

  // Actions
  setRules: (rules: AlertRule[], total: number) => void;
  setRulesLoading: (loading: boolean) => void;
  setRulesError: (error: string | null) => void;
  setHistory: (history: AlertHistoryItem[], total: number) => void;
  setHistoryLoading: (loading: boolean) => void;
  setHistoryError: (error: string | null) => void;
  setStats: (stats: AlertStats | null) => void;
  setStatsLoading: (loading: boolean) => void;
  setEditingRule: (rule: AlertRule | null) => void;
  setEditMode: (mode: 'create' | 'edit' | null) => void;
  setSaveLoading: (loading: boolean) => void;
  setSaveSuccess: (message: string | null) => void;
  setSaveError: (error: string | null) => void;
  setRulesPage: (page: number) => void;
  setHistoryPage: (page: number) => void;
  setHistoryHours: (hours: number) => void;
  reset: () => void;
}

export const useAlertsStore = create<AlertsStore>((set) => ({
  rules: [],
  totalRules: 0,
  rulesLoading: false,
  rulesError: null,
  history: [],
  totalHistory: 0,
  historyLoading: false,
  historyError: null,
  stats: null,
  statsLoading: false,
  editingRule: null,
  editMode: null,
  saveLoading: false,
  saveError: null,
  saveSuccess: null,
  rulesPage: 1,
  rulesLimit: 25,
  historyPage: 1,
  historyLimit: 50,
  historyHours: 24,

  setRules: (rules, total) =>
    set({
      rules,
      totalRules: total,
      rulesLoading: false,
      rulesError: null,
    }),

  setRulesLoading: (loading) => set({ rulesLoading: loading }),

  setRulesError: (error) =>
    set({
      rulesError: error,
      rulesLoading: false,
    }),

  setHistory: (history, total) =>
    set({
      history,
      totalHistory: total,
      historyLoading: false,
      historyError: null,
    }),

  setHistoryLoading: (loading) => set({ historyLoading: loading }),

  setHistoryError: (error) =>
    set({
      historyError: error,
      historyLoading: false,
    }),

  setStats: (stats) =>
    set({
      stats,
      statsLoading: false,
    }),

  setStatsLoading: (loading) => set({ statsLoading: loading }),

  setEditingRule: (rule) =>
    set({
      editingRule: rule,
      saveSuccess: null,
      saveError: null,
    }),

  setEditMode: (mode) => set({ editMode: mode }),

  setSaveLoading: (loading) => set({ saveLoading: loading }),

  setSaveSuccess: (message) =>
    set({
      saveSuccess: message,
      saveLoading: false,
      saveError: null,
    }),

  setSaveError: (error) =>
    set({
      saveError: error,
      saveLoading: false,
    }),

  setRulesPage: (page) => set({ rulesPage: page }),

  setHistoryPage: (page) => set({ historyPage: page }),

  setHistoryHours: (hours) =>
    set({
      historyHours: hours,
      historyPage: 1,
    }),

  reset: () =>
    set({
      rules: [],
      totalRules: 0,
      rulesLoading: false,
      rulesError: null,
      history: [],
      totalHistory: 0,
      historyLoading: false,
      historyError: null,
      stats: null,
      statsLoading: false,
      editingRule: null,
      editMode: null,
      saveLoading: false,
      saveError: null,
      saveSuccess: null,
      rulesPage: 1,
      historyPage: 1,
    }),
}));
