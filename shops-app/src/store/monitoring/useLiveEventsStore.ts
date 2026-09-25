import { create } from 'zustand';
import type { LiveEvent, LiveEventType } from '../../services/liveEventsService';

interface LiveEventsStore {
  // Events
  events: LiveEvent[];
  filteredEvents: LiveEvent[];

  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  activeConnections: number;

  // Filters
  filters: {
    eventTypes: Set<LiveEventType>;
    severities: Set<'info' | 'warning' | 'error'>;
    services: Set<string>;
  };

  // Settings
  autoScroll: boolean;
  maxEventsInMemory: number;

  // Actions
  addEvent: (event: LiveEvent) => void;
  setConnected: (connected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  setActiveConnections: (count: number) => void;
  toggleEventTypeFilter: (eventType: LiveEventType) => void;
  toggleSeverityFilter: (severity: 'info' | 'warning' | 'error') => void;
  toggleServiceFilter: (service: string) => void;
  clearFilters: () => void;
  clearEvents: () => void;
  setAutoScroll: (enabled: boolean) => void;
  reset: () => void;
}

const DEFAULT_FILTERS = {
  eventTypes: new Set<LiveEventType>(),
  severities: new Set<'info' | 'warning' | 'error'>(),
  services: new Set<string>(),
};

export const useLiveEventsStore = create<LiveEventsStore>((set, get) => ({
  events: [],
  filteredEvents: [],
  isConnected: false,
  connectionError: null,
  activeConnections: 0,
  filters: DEFAULT_FILTERS,
  autoScroll: true,
  maxEventsInMemory: 500,

  addEvent: (event) =>
    set((state) => {
      const newEvents = [event, ...state.events];
      if (newEvents.length > state.maxEventsInMemory) {
        newEvents.pop();
      }

      // Apply filters
      const filtered = applyFilters(newEvents, state.filters);

      return {
        events: newEvents,
        filteredEvents: filtered,
      };
    }),

  setConnected: (connected) =>
    set({
      isConnected: connected,
      connectionError: connected ? null : get().connectionError,
    }),

  setConnectionError: (error) =>
    set({
      connectionError: error,
      isConnected: false,
    }),

  setActiveConnections: (count) => set({ activeConnections: count }),

  toggleEventTypeFilter: (eventType) =>
    set((state) => {
      const newFilters = {
        ...state.filters,
        eventTypes: new Set(state.filters.eventTypes),
      };

      if (newFilters.eventTypes.has(eventType)) {
        newFilters.eventTypes.delete(eventType);
      } else {
        newFilters.eventTypes.add(eventType);
      }

      const filtered = applyFilters(state.events, newFilters);
      return {
        filters: newFilters,
        filteredEvents: filtered,
      };
    }),

  toggleSeverityFilter: (severity) =>
    set((state) => {
      const newFilters = {
        ...state.filters,
        severities: new Set(state.filters.severities),
      };

      if (newFilters.severities.has(severity)) {
        newFilters.severities.delete(severity);
      } else {
        newFilters.severities.add(severity);
      }

      const filtered = applyFilters(state.events, newFilters);
      return {
        filters: newFilters,
        filteredEvents: filtered,
      };
    }),

  toggleServiceFilter: (service) =>
    set((state) => {
      const newFilters = {
        ...state.filters,
        services: new Set(state.filters.services),
      };

      if (newFilters.services.has(service)) {
        newFilters.services.delete(service);
      } else {
        newFilters.services.add(service);
      }

      const filtered = applyFilters(state.events, newFilters);
      return {
        filters: newFilters,
        filteredEvents: filtered,
      };
    }),

  clearFilters: () =>
    set((state) => {
      const filtered = applyFilters(state.events, DEFAULT_FILTERS);
      return {
        filters: DEFAULT_FILTERS,
        filteredEvents: filtered,
      };
    }),

  clearEvents: () =>
    set({
      events: [],
      filteredEvents: [],
    }),

  setAutoScroll: (enabled) => set({ autoScroll: enabled }),

  reset: () =>
    set({
      events: [],
      filteredEvents: [],
      isConnected: false,
      connectionError: null,
      activeConnections: 0,
      filters: DEFAULT_FILTERS,
      autoScroll: true,
    }),
}));

function applyFilters(
  events: LiveEvent[],
  filters: { eventTypes: Set<LiveEventType>; severities: Set<'info' | 'warning' | 'error'>; services: Set<string> }
): LiveEvent[] {
  return events.filter((event) => {
    // If no filters are set, show all events
    if (
      filters.eventTypes.size === 0 &&
      filters.severities.size === 0 &&
      filters.services.size === 0
    ) {
      return true;
    }

    // Apply filters (AND logic for categories, OR within category)
    if (filters.eventTypes.size > 0 && !filters.eventTypes.has(event.event_type as LiveEventType)) {
      return false;
    }

    if (filters.severities.size > 0 && !filters.severities.has(event.severity)) {
      return false;
    }

    if (filters.services.size > 0 && !filters.services.has(event.service)) {
      return false;
    }

    return true;
  });
}
