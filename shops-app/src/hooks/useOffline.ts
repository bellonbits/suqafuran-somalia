import { useState, useEffect } from 'react';
import { offlineManager } from '@/services/offline-manager';

export const useOffline = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Initialize offline manager
    offlineManager.initialize();

    // Get initial status
    setIsOnline(offlineManager.getStatus());

    // Subscribe to changes
    const unsubscribe = offlineManager.subscribe({
      onOnline: () => setIsOnline(true),
      onOffline: () => setIsOnline(false),
    });

    return unsubscribe;
  }, []);

  return { isOnline, isOffline: !isOnline };
};
