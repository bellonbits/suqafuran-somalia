import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/useAuth';
import { useFavoritesStore } from './store/useFavorites';
import { identifyUser, captureAcquisitionChannel } from './lib/analytics';
import { RealtimeConnection } from './components/shared/RealtimeConnection';
import { NotificationToast } from './components/shared/NotificationToast';
import { OfflineBanner } from './components/OfflineBanner';
import { BottomNav } from './components/shared/BottomNav';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false
      }
    }
  }));

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // First-touch channel needs to be captured unconditionally, before
  // anyone has signed up, so it's already attached as a super property by
  // the time Signup Completed/Purchase eventually fire.
  useEffect(() => {
    captureAcquisitionChannel();
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      useFavoritesStore.getState().hydrate();
      // Re-identify on every app load with a persisted session, not just
      // at the login/signup moment -- otherwise a returning visitor's
      // later sessions are invisible to Mixpanel's identity graph, and
      // retention/LTV/cohort reports never see the same person twice.
      const user = useAuthStore.getState().user;
      if (user) identifyUser(user);
    }
  }, [isHydrated, isAuthenticated]);

  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeConnection />
      <NotificationToast />
      <OfflineBanner />
      <div className="sm:pb-0 pb-20">
        {children}
      </div>
      <BottomNav />
    </QueryClientProvider>
  );
}
