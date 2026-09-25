'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, MapPin, Users, Trophy, Smartphone, AlertTriangle, MessageSquare } from 'lucide-react';

const ANALYTICS_PAGES = [
  { label: 'Overview', href: '/admin-dashboard/analytics', icon: BarChart3 },
  { label: 'Communication', href: '/admin-dashboard/analytics/communication', icon: MessageSquare },
  { label: 'Users', href: '/admin-dashboard/analytics/users', icon: Users },
  { label: 'Sellers', href: '/admin-dashboard/analytics/sellers', icon: Trophy },
  { label: 'Devices', href: '/admin-dashboard/analytics/devices', icon: Smartphone },
  { label: 'Geographic', href: '/admin-dashboard/analytics/geographic', icon: MapPin },
  { label: 'Alerts', href: '/admin-dashboard/analytics/alerts', icon: AlertTriangle },
];

export function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto gap-1 px-6 pt-4 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800">
      {ANALYTICS_PAGES.map((page) => {
        const isActive = pathname === page.href;
        const Icon = page.icon;
        return (
          <Link
            key={page.href}
            href={page.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium text-sm whitespace-nowrap transition-colors ${
              isActive
                ? 'bg-slate-50 dark:bg-neutral-900 text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            {page.label}
          </Link>
        );
      })}
    </nav>
  );
}
