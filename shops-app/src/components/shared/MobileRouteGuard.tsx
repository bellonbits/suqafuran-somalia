'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { isCapacitorApp } from '@/lib/capacitor-utils';

const ADMIN_ROUTES = ['/admin-dashboard', '/admin', '/admin-'];
const AGENT_ROUTES = ['/agent-dashboard', '/agent'];

const isProtectedRoute = (pathname: string): boolean => {
  return (
    ADMIN_ROUTES.some(route => pathname.startsWith(route)) ||
    AGENT_ROUTES.some(route => pathname.startsWith(route))
  );
};

export function MobileRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const isNativeApp = isCapacitorApp();
    const isProtected = isProtectedRoute(pathname);

    if (isNativeApp && isProtected) {
      console.warn(`Blocked access to ${pathname} on mobile app`);
      router.replace('/shops');
    }
  }, [pathname]); // Only depend on pathname, not router

  return <>{children}</>;
}
