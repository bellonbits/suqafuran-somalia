import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage } from '@/types';
import { API_BASE_URL } from '@/services/api';

export type { ChatMessage };

interface ChatUser {
  id: number;
  name: string;
  avatar?: string;
  is_online: boolean;
  is_typing: boolean;
}

interface UseChatReturn {
  isConnected: boolean;
  userStatus: ChatUser | null;
  sendMessage: (content: string, receiverId: number, listingId?: number) => void;
  setTyping: (receiverId: number, isTyping: boolean) => void;
  subscribeToUser: (userId: number) => void;
  onMessage: (callback: (message: ChatMessage) => void) => void;
}

export function useChat(token: string): UseChatReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [userStatus, setUserStatus] = useState<ChatUser | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageCallbackRef = useRef<((message: ChatMessage) => void) | null>(null);

  // Always target the API host, not the frontend's own origin -- this used
  // to derive from window.location, which pointed at the Vite dev server
  // (no WS route there at all) instead of the actual backend. Mirrors
  // RealtimeConnection.tsx's buildSocketUrl.
  const getWsUrl = useCallback(() => {
    const wsBase = API_BASE_URL.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    return `${wsBase}/ws/chat?token=${encodeURIComponent(token)}`;
  }, [token]);

  // Connect to WebSocket
  useEffect(() => {
    if (!token) return;

    const wsUrl = getWsUrl();
    console.log('[Chat WS] Connecting to:', wsUrl);

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('[Chat WS] Connected');
        setIsConnected(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Chat WS] Received:', data);

          if (data.event_type === 'connection_ack') {
            console.log('[Chat WS] Connection acknowledged');
          } else if (data.event_type === 'new_message') {
            // Handle incoming message from other user
            const message: ChatMessage = {
              id: Math.random(), // Placeholder ID until DB save
              sender_id: data.sender_id,
              receiver_id: data.receiver_id,
              content: data.content,
              listing_id: data.listing_id,
              timestamp: data.timestamp,
              created_at: data.timestamp,
            };
            // Call the message callback if set
            if (messageCallbackRef.current) {
              messageCallbackRef.current(message);
            }
          } else if (data.event_type === 'user_typing') {
            setUserStatus(prev => ({
              ...prev,
              id: data.user_id,
              is_typing: true,
            } as ChatUser));
            // Auto-clear typing after 2 seconds
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            typingTimeoutRef.current = setTimeout(() => {
              setUserStatus(prev => ({
                ...prev,
                id: data.user_id,
                is_typing: false,
              } as ChatUser));
            }, 2000);
          } else if (data.event_type === 'user_stopped_typing') {
            setUserStatus(prev => ({
              ...prev,
              id: data.user_id,
              is_typing: false,
            } as ChatUser));
          } else if (data.event_type === 'presence') {
            setUserStatus(prev => ({
              ...prev,
              id: data.user_id,
              is_online: data.status === 'online',
            } as ChatUser));
          }
        } catch (error) {
          console.error('[Chat WS] Error parsing message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[Chat WS] Error:', error);
        setIsConnected(false);
      };

      wsRef.current.onclose = () => {
        console.log('[Chat WS] Disconnected');
        setIsConnected(false);
        // Try to reconnect after 3 seconds
        setTimeout(() => {
          if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
            console.log('[Chat WS] Attempting to reconnect...');
          }
        }, 3000);
      };

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    } catch (error) {
      console.error('[Chat WS] Connection error:', error);
      setIsConnected(false);
    }
  }, [token, getWsUrl]);

  const sendMessage = useCallback(
    (content: string, receiverId: number, listingId?: number) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('[Chat WS] WebSocket not connected');
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          event_type: 'message',
          other_user_id: receiverId,
          content,
          listing_id: listingId,
        })
      );
    },
    []
  );

  const setTyping = useCallback((receiverId: number, isTyping: boolean) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        event_type: isTyping ? 'typing' : 'stop_typing',
        other_user_id: receiverId,
      })
    );
  }, []);

  const subscribeToUser = useCallback((userId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('[Chat WS] WebSocket not connected');
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        event_type: 'subscribe',
        other_user_id: userId,
      })
    );
  }, []);

  const onMessage = useCallback((callback: (message: ChatMessage) => void) => {
    messageCallbackRef.current = callback;
  }, []);

  return {
    isConnected,
    userStatus,
    sendMessage,
    setTyping,
    subscribeToUser,
    onMessage,
  };
}
