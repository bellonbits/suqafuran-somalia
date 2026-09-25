import { create } from 'zustand';

export interface RealtimeEvent {
    type: string;
    payload: Record<string, unknown>;
    timestamp: string;
}

interface RealtimeState {
    isConnected: boolean;
    lastEvent: RealtimeEvent | null;
    events: RealtimeEvent[];
    setConnected: (connected: boolean) => void;
    pushEvent: (event: RealtimeEvent) => void;
}

/**
 * Holds the most recent events pushed over the personal WebSocket channel
 * (`/notifications/ws`). Any component can subscribe to `lastEvent` (or
 * filter `events` by `type`) to react to live updates — order status
 * changes, future chat messages, etc. — without polling.
 */
export const useRealtimeStore = create<RealtimeState>()((set) => ({
    isConnected: false,
    lastEvent: null,
    events: [],
    setConnected: (connected) => set({ isConnected: connected }),
    pushEvent: (event) => set((s) => ({ lastEvent: event, events: [event, ...s.events].slice(0, 50) })),
}));
