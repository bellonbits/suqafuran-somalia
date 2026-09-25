import { API_BASE_URL } from './api';

export enum LiveEventType {
  // Notification events
  NotificationSent = 'notification.sent',
  NotificationDelivered = 'notification.delivered',
  NotificationFailed = 'notification.failed',

  // Kafka events
  KafkaMessage = 'kafka.message',
  KafkaLagChanged = 'kafka.lag_changed',

  // Order events
  OrderCreated = 'order.created',
  OrderPaid = 'order.paid',
  OrderShipped = 'order.shipped',
  OrderCancelled = 'order.cancelled',

  // System events
  AlertTriggered = 'alert.triggered',
  SystemError = 'system.error',
}

export interface LiveEvent {
  event_type: LiveEventType;
  timestamp: string;
  service: string;
  data: Record<string, any>;
  severity: 'info' | 'warning' | 'error';
  trace_id?: string;
  correlation_id?: string;
}

export interface ConnectionMessage {
  type: 'connection';
  message: string;
  timestamp: string;
}

interface EventHistoryResponse {
  events: LiveEvent[];
  total: number;
  active_connections: number;
  timestamp: string;
}

class LiveEventsService {
  private baseUrl = `${API_BASE_URL}/admin/monitoring`;
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private messageListeners: Set<(event: LiveEvent | ConnectionMessage) => void> = new Set();
  private errorListeners: Set<(error: Error) => void> = new Set();
  private closeListeners: Set<() => void> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  async getEventHistory(limit: number = 50): Promise<EventHistoryResponse> {
    const response = await fetch(
      `${this.baseUrl}/live/history?limit=${limit}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch event history: ${response.statusText}`);
    }

    return response.json();
  }

  connect(onMessage: (event: LiveEvent | ConnectionMessage) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${this.baseUrl}/live/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          this.messageListeners.forEach((listener) => {
            listener({
              type: 'connection',
              message: 'Connected to live event stream',
              timestamp: new Date().toISOString(),
            } as any);
          });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
            this.messageListeners.forEach((listener) => listener(data));
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          const err = new Error('WebSocket connection error');
          this.errorListeners.forEach((listener) => listener(err));
          reject(err);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.ws = null;
          this.closeListeners.forEach((listener) => listener());
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to connect'));
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect(() => {}).catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.messageListeners.clear();
    this.errorListeners.clear();
    this.closeListeners.clear();
  }

  onMessage(listener: (event: LiveEvent | ConnectionMessage) => void) {
    this.messageListeners.add(listener);
  }

  offMessage(listener: (event: LiveEvent | ConnectionMessage) => void) {
    this.messageListeners.delete(listener);
  }

  onError(listener: (error: Error) => void) {
    this.errorListeners.add(listener);
  }

  offError(listener: (error: Error) => void) {
    this.errorListeners.delete(listener);
  }

  onClose(listener: () => void) {
    this.closeListeners.add(listener);
  }

  offClose(listener: () => void) {
    this.closeListeners.delete(listener);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const liveEventsService = new LiveEventsService();
