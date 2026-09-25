'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { TrendingUp, Users, ArrowRight, Activity, AlertCircle } from 'lucide-react';

interface LifecycleStats {
  total_users: number;
  signup: number;
  profile_complete: number;
  first_listing: number;
  active_seller: number;
  active_buyer: number;
  inactive: number;
  churn_rate: number;
  avg_lifetime_days: number;
  conversion_rates: {
    signup_to_profile: number;
    profile_to_seller: number;
    buyer_to_seller: number;
  };
  stage_breakdown: {
    stage: string;
    count: number;
    percentage: number;
  }[];
  cohort_data: {
    cohort_month: string;
    total_signups: number;
    still_active: number;
    retention_rate: number;
  }[];
}

export default function UserLifecyclePage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<LifecycleStats | null>(null);
  const [loading, setLoading] = useState(true);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    if (user?.is_admin) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/lifecycle/stats');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch lifecycle stats:', error);
      toast({
        title: 'Error',
        description: 'Failed to load lifecycle data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="User Lifecycle" navItems={navItems} userRole="admin">
        <div className="p-6">Loading lifecycle data...</div>
      </DashboardLayout>
    );
  }

  if (!stats) {
    return (
      <DashboardLayout title="User Lifecycle" navItems={navItems} userRole="admin">
        <div className="p-6 text-red-600">Failed to load data</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="User Lifecycle" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Lifecycle Analytics</h1>
          </div>
          <p className="text-slate-600 dark:text-neutral-200">Track user progression through stages and identify churn</p>
        </div>

        {/* Key Metrics */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={stats.total_users.toLocaleString()}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Avg Lifetime"
            value={`${stats.avg_lifetime_days} days`}
            icon={<Activity className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Churn Rate"
            value={`${stats.churn_rate.toFixed(1)}%`}
            subtitle="Last 30 days"
            icon={<AlertCircle className="w-6 h-6" />}
            color="red"
          />
          <StatCard
            title="Active Users"
            value={(stats.active_seller + stats.active_buyer).toLocaleString()}
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
          />
        </div>

        {/* Lifecycle Stages */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">User Stages</h2>
          <div className="space-y-4">
            {stats.stage_breakdown.map((stage, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900 dark:text-white">{stage.stage}</p>
                  <p className="text-sm text-slate-600 dark:text-neutral-200">{stage.count.toLocaleString()} users ({stage.percentage.toFixed(1)}%)</p>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${stage.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Conversion Funnel */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">Conversion Funnel</h2>
          <div className="space-y-4">
            <FunnelStage
              label="Signup → Profile Complete"
              percentage={stats.conversion_rates.signup_to_profile}
              color="bg-blue-500"
            />
            <FunnelStage
              label="Profile Complete → First Listing"
              percentage={stats.conversion_rates.profile_to_seller}
              color="bg-green-500"
            />
            <FunnelStage
              label="Buyer → Seller Conversion"
              percentage={stats.conversion_rates.buyer_to_seller}
              color="bg-purple-500"
            />
          </div>
        </Card>

        {/* Cohort Retention */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Cohort Retention Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Signup Month</th>
                  <th className="px-4 py-3 text-left font-semibold">Total Signups</th>
                  <th className="px-4 py-3 text-left font-semibold">Still Active</th>
                  <th className="px-4 py-3 text-left font-semibold">Retention Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {stats.cohort_data.map((cohort, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                    <td className="px-4 py-3 font-medium">{cohort.cohort_month}</td>
                    <td className="px-4 py-3">{cohort.total_signups.toLocaleString()}</td>
                    <td className="px-4 py-3">{cohort.still_active.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        cohort.retention_rate > 50
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                          : cohort.retention_rate > 25
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-rose-50 dark:bg-rose-950/30 text-red-800'
                      }`}>
                        {cohort.retention_rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recommendations */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-blue-900">
              <p><strong>Insights & Recommendations:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                {stats.churn_rate > 5 && (
                  <li>High churn rate detected. Consider re-engagement campaigns for inactive users.</li>
                )}
                {stats.conversion_rates.signup_to_profile < 50 && (
                  <li>Low profile completion rate. Simplify onboarding process.</li>
                )}
                {stats.conversion_rates.profile_to_seller < 20 && (
                  <li>Few users become sellers. Promote seller benefits more prominently.</li>
                )}
                {stats.avg_lifetime_days < 30 && (
                  <li>Average user lifetime is low. Focus on retention in first 30 days.</li>
                )}
                <li>Use cohort analysis to identify which signup months have better retention.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-neutral-200">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function FunnelStage({
  label,
  percentage,
  color
}: {
  label: string;
  percentage: number;
  color: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{percentage.toFixed(1)}%</p>
      </div>
      <div className="relative h-8 bg-slate-100 dark:bg-neutral-900 rounded-lg overflow-hidden">
        <div
          className={`${color} h-full flex items-center justify-center transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        >
          {percentage > 5 && (
            <ArrowRight className="w-4 h-4 text-white" />
          )}
        </div>
      </div>
    </div>
  );
}
