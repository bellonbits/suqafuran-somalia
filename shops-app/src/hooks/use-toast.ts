'use client';

import { useCallback } from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;
const listeners: Set<(toast: Toast) => void> = new Set();

export function useToast() {
  const toast = useCallback(
    (message: { title: string; description?: string; variant?: 'default' | 'destructive' }) => {
      const id = `toast-${++toastId}-${Date.now()}`;
      const newToast: Toast = {
        id,
        title: message.title,
        description: message.description,
        variant: message.variant || 'default',
      };

      // Notify all listeners
      listeners.forEach((listener) => listener(newToast));

      // Auto-remove after 5 seconds
      setTimeout(() => {
        listeners.forEach((listener) => listener({ ...newToast, id: `remove-${id}` }));
      }, 5000);
    },
    []
  );

  return { toast };
}

export function useToastListener(callback: (toast: Toast) => void) {
  callback;
  listeners.add(callback);
  return () => listeners.delete(callback);
}
