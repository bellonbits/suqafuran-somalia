'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { DollarSign, TrendingUp, Calendar, Zap } from 'lucide-react';

interface FeaturedPlacementStats {
  total_placements: number;
  active_placements: number;
  total_revenue: number;
  avg_placement_cost: number;
  by_type: {
    featured_product: number;
    featured_shop: number;
    homepage_banner: number;
    category_featured: number;
  };
  by_type_revenue: {
    featured_product: number;
    featured_shop: number;
    homepage_banner: number;
    category_featured: number;
  };
}

interface ActivePlacement {
  seller_id: number;
  placement_type: string;
  days_remaining: number;
  price_kes: number;
  starts_at: string;
  ends_at: string;
}

export default function AdminFeaturedAdsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<FeaturedPlacementStats | null>(null);
  const [placements, setPlacements] = useState<ActivePlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, placementsRes] = await Promise.all([
          api.get('/admin/featured/stats'),
          api.get('/admin/featured/placements'),
        ]);
        setStats(statsRes.data);
        setPlacements(placementsRes.data.placements);
      } catch (error) {
        console.error('Failed to fetch featured ads data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load featured advertising data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  if (loading) return <div className="p-6">Loading...</div>;

  const filteredPlacements = filterType === 'all'
    ? placements
    : placements.filter(p => p.placement_type === filterType);

  return (
    <DashboardLayout title="Featured Advertising" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Featured Advertising</h1>
          <p className="text-slate-600 dark:text-neutral-200 mt-2">Track premium placement revenue and performance</p>
        </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Placements"
            value={stats.total_placements}
            change={`${stats.active_placements} active`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Total Revenue"
            value={`KSh ${(stats.total_revenue / 1000000).toFixed(1)}M`}
            change="All time"
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Avg Placement Cost"
            value={`KSh ${stats.avg_placement_cost.toLocaleString()}`}
            change="Average price"
            icon={<Zap className="w-6 h-6" />}
            color="purple"
          />
          <StatCard
            title="Active Right Now"
            value={stats.active_placements}
            change="Live placements"
            icon={<Calendar className="w-6 h-6" />}
            color="orange"
          />
        </div>
      )}

      {/* Revenue by Type */}
      {stats && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Revenue by Placement Type</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <RevenueCard
              name="Featured Product"
              count={stats.by_type.featured_product}
              revenue={stats.by_type_revenue.featured_product}
              color="blue"
            />
            <RevenueCard
              name="Featured Shop"
              count={stats.by_type.featured_shop}
              revenue={stats.by_type_revenue.featured_shop}
              color="green"
            />
            <RevenueCard
              name="Homepage Banner"
              count={stats.by_type.homepage_banner}
              revenue={stats.by_type_revenue.homepage_banner}
              color="purple"
            />
            <RevenueCard
              name="Category Featured"
              count={stats.by_type.category_featured}
              revenue={stats.by_type_revenue.category_featured}
              color="orange"
            />
          </div>
        </Card>
      )}

      {/* Active Placements */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-4">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="featured_product">Featured Product</option>
              <option value="featured_shop">Featured Shop</option>
              <option value="homepage_banner">Homepage Banner</option>
              <option value="category_featured">Category Featured</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Seller ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Placement Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Price</th>
                  <th className="px-4 py-3 text-left font-semibold">Days Remaining</th>
                  <th className="px-4 py-3 text-left font-semibold">Ends</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredPlacements.length > 0 ? (
                  filteredPlacements.map((placement, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-4 py-3 font-medium">{placement.seller_id}</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-800">
                          {placement.placement_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">KSh {placement.price_kes.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          placement.days_remaining > 7
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                            : placement.days_remaining > 1
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-red-800'
                        }`}>
                          {placement.days_remaining} days
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-200">
                        {new Date(placement.ends_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No active placements
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-slate-600 dark:text-neutral-200 text-right">
            Showing {filteredPlacements.length} active placements
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
  change,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  change: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-neutral-200">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          <p className="text-xs text-slate-400 mt-2">{change}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function RevenueCard({
  name,
  count,
  revenue,
  color,
}: {
  name: string;
  count: number;
  revenue: number;
  color: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    orange: 'bg-orange-50 border-orange-200',
  };

  return (
    <Card className={`p-4 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{count}</p>
      <p className="text-sm text-slate-600 dark:text-neutral-200 mt-1">KSh {(revenue / 1000).toFixed(0)}K revenue</p>
    </Card>
  );
}
