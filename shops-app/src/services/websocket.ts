export interface WSMessage {
  type: string;
  payload: any;
}

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private messageHandlers: Map<string, (payload: any) => void> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(wsType: 'tracking' | 'driver' | 'messages', id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = new URL(this.url);
        wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';

        let endpoint = '';
        if (wsType === 'tracking') {
          endpoint = `/v1/tracking/ws/order/${id}`;
        } else if (wsType === 'driver') {
          endpoint = `/v1/tracking/ws/driver`;
        } else if (wsType === 'messages') {
          endpoint = `/v1/messages/ws/${id}`;
        }

        wsUrl.pathname = endpoint;
        wsUrl.searchParams.set('token', this.token);

        this.ws = new WebSocket(wsUrl.toString());

        this.ws.onopen = () => {
          console.log('WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message.payload);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket closed');
          this.attemptReconnect(wsType, id);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect(wsType: 'tracking' | 'driver' | 'messages', id: string) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(wsType, id).catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  on(messageType: string, handler: (payload: any) => void) {
    this.messageHandlers.set(messageType, handler);
  }

  off(messageType: string) {
    this.messageHandlers.delete(messageType);
  }

  send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

// Real-time tracking service for drivers
export const createDriverLocationBroadcaster = (token: string, baseUrl: string) => {
  const ws = new WebSocketService(baseUrl, token);

  return {
    startBroadcasting: (driverId: string) => {
      return ws.connect('driver', driverId);
    },

    sendLocation: (lat: number, lng: number, heading?: number) => {
      ws.send({
        type: 'location',
        payload: { lat, lng, heading },
      });
    },

    onLocationUpdate: (handler: (data: any) => void) => {
      ws.on('driver_location', handler);
    },

    onJobOffer: (handler: (data: any) => void) => {
      ws.on('job_offer', handler);
    },

    onNotification: (handler: (data: any) => void) => {
      ws.on('notification', handler);
    },

    stopBroadcasting: () => {
      ws.disconnect();
    },

    isConnected: () => ws.isConnected(),
  };
};

// Real-time delivery tracking for customers
export const createDeliveryTracker = (token: string, baseUrl: string) => {
  const ws = new WebSocketService(baseUrl, token);

  return {
    startTracking: (orderId: string) => {
      return ws.connect('tracking', orderId);
    },

    onDriverLocation: (handler: (data: any) => void) => {
      ws.on('driver_location', handler);
    },

    onStatusUpdate: (handler: (data: any) => void) => {
      ws.on('order_status', handler);
    },

    onNotification: (handler: (data: any) => void) => {
      ws.on('notification', handler);
    },

    stopTracking: () => {
      ws.disconnect();
    },

    isConnected: () => ws.isConnected(),
  };
};

// Real-time messaging service
export const createMessagingService = (token: string, baseUrl: string) => {
  const ws = new WebSocketService(baseUrl, token);

  return {
    startMessaging: (conversationId: string) => {
      return ws.connect('messages', conversationId);
    },

    sendMessage: (content: string, type: 'text' | 'image' = 'text', imageUrl?: string) => {
      ws.send({
        type: 'message',
        payload: { content, type, image_url: imageUrl },
      });
    },

    onMessage: (handler: (data: any) => void) => {
      ws.on('message', handler);
    },

    onTyping: (handler: (data: any) => void) => {
      ws.on('typing', handler);
    },

    sendTyping: (isTyping: boolean) => {
      ws.send({
        type: 'typing',
        payload: { is_typing: isTyping },
      });
    },

    onRead: (handler: (data: any) => void) => {
      ws.on('read', handler);
    },

    markAsRead: (messageId: string) => {
      ws.send({
        type: 'read',
        payload: { message_id: messageId },
      });
    },

    stopMessaging: () => {
      ws.disconnect();
    },

    isConnected: () => ws.isConnected(),
  };
};
