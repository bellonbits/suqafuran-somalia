import { useEffect, useRef } from 'react';

/**
 * Hook for managing polling/refresh intervals
 * Handles pause/resume and automatic cleanup
 */
export const usePolling = (
  fn: () => Promise<void>,
  intervalMs: number = 15000,
  enabled: boolean = true
) => {
  const intervalRef = useRef<NodeJS.Timeout>();
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    // Run immediately on first load
    if (isFirstRun.current) {
      fn().catch(console.error);
      isFirstRun.current = false;
    }

    // Set up polling
    intervalRef.current = setInterval(() => {
      fn().catch(console.error);
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fn, intervalMs, enabled]);

  return {
    stop: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    },
    start: () => {
      fn().catch(console.error);
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          fn().catch(console.error);
        }, intervalMs);
      }
    },
  };
};
