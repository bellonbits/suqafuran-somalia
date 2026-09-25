'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Map, Users, Trophy, Smartphone, AlertCircle } from 'lucide-react';

const navItems = [
  {
    label: 'Overview',
    href: '/admin-dashboard/analytics',
    icon: BarChart3,
    section: 'Phase 1',
    description: 'Searches, clicks, conversions'
  },
  {
    label: 'Geographic',
    href: '/admin-dashboard/analytics/geographic',
    icon: Map,
    section: 'Phase 2',
    description: 'Visitor locations & map'
  },
  {
    label: 'Users',
    href: '/admin-dashboard/analytics/users',
    icon: Users,
    section: 'Phase 2',
    description: 'Cohorts & engagement'
  },
  {
    label: 'Sellers',
    href: '/admin-dashboard/analytics/sellers',
    icon: Trophy,
    section: 'Phase 3',
    description: 'Rankings & performance'
  },
  {
    label: 'Devices',
    href: '/admin-dashboard/analytics/devices',
    icon: Smartphone,
    section: 'Phase 3',
    description: 'Mobile/tablet/desktop'
  },
  {
    label: 'Alerts',
    href: '/admin-dashboard/analytics/alerts',
    icon: AlertCircle,
    section: 'Phase 3',
    description: 'Rules & notifications'
  },
];

export function AnalyticsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 p-6 h-screen sticky top-0 overflow-y-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        <p className="text-sm text-gray-500 mt-1">Dashboard & Reports</p>
      </div>

      <nav className="space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-start gap-3 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-gray-500 truncate">{item.description}</p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <p className="text-xs text-gray-500 px-4">
          Real-time analytics for your marketplace. Data updates every 30 seconds.
        </p>
      </div>
    </aside>
  );
}
