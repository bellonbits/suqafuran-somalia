/**Hook for automatically tracking item/shop views with time spent tracking.*/

import { useEffect, useRef } from 'react';
import { analyticsService } from '../services/analytics';

export function useTrackItemView(listingId: number) {
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();

    return () => {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (listingId) {
        analyticsService.trackItemView({
          listing_id: listingId,
          time_spent_seconds: timeSpentSeconds,
          device_type: analyticsService.getDeviceType(),
          referrer: typeof window !== 'undefined' ? document.referrer : undefined,
        }).catch(console.error);
      }
    };
  }, [listingId]);
}

export function useTrackShopView(shopOwnerId: number) {
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    startTimeRef.current = Date.now();

    return () => {
      const timeSpentSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      if (shopOwnerId) {
        analyticsService.trackShopView({
          shop_owner_id: shopOwnerId,
          time_spent_seconds: timeSpentSeconds,
          device_type: analyticsService.getDeviceType(),
          referrer: typeof window !== 'undefined' ? document.referrer : undefined,
        }).catch(console.error);
      }
    };
  }, [shopOwnerId]);
}
