'use client';

import { useOffline } from '@/hooks/useOffline';
import { Wifi, WifiOff } from 'lucide-react';

export const OfflineBanner = () => {
  const { isOnline } = useOffline();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-amber-500 text-white px-4 py-3 flex items-center justify-center gap-2 shadow-lg">
      <WifiOff className="w-4 h-4" />
      <span className="text-sm font-semibold">You're offline — showing cached data</span>
      <span className="text-xs opacity-75 ml-auto">Reconnect to sync</span>
    </div>
  );
};
