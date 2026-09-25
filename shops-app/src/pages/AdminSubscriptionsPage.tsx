'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import {
  BarChart3, DollarSign, Users, TrendingUp, Calendar,
  Search, Filter, Plus
} from 'lucide-react';

interface SubscriptionStats {
  total_subscriptions: number;
  active_subscriptions: number;
  total_revenue_monthly: number;
  total_revenue_annual: number;
  avg_arpu: number;
  tier_distribution: {
    free: number;
    starter: number;
    business: number;
    enterprise: number;
  };
  trial_conversions: number;
  churn_rate: number;
}

interface RecentSubscription {
  seller_id: number;
  shop_name: string;
  plan_name: string;
  monthly_price: number;
  status: string;
  created_at: string;
  trial_ends_at?: string;
  renews_at?: string;
}

interface Plan {
  id: number;
  name: string;
  display_name: string;
}

export default function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [subscriptions, setSubscriptions] = useState<RecentSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [manualShopName, setManualShopName] = useState('');
  const [manualSellerId, setManualSellerId] = useState('');
  const [manualPlanId, setManualPlanId] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [shopSuggestions, setShopSuggestions] = useState<Array<{id: number, name: string}>>([]);
  const [showShopSuggestions, setShowShopSuggestions] = useState(false);

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, subsRes, plansRes] = await Promise.all([
          api.get('/admin/subscriptions/stats'),
          api.get('/admin/subscriptions/list'),
          api.get('/subscriptions/plans'),
        ]);
        setStats(statsRes.data);
        setSubscriptions(subsRes.data.subscriptions);
        setPlans(plansRes.data);
        if (plansRes.data.length > 0) {
          setManualPlanId(plansRes.data[0].id.toString());
        }
      } catch (error) {
        console.error('Failed to fetch subscription data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load subscription data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [toast]);

  const handleShopSearch = async (query: string) => {
    setManualShopName(query);
    if (query.length < 2) {
      setShopSuggestions([]);
      return;
    }

    // Always search in local subscriptions data for instant suggestions
    const localSuggestions = subscriptions
      .map(sub => ({ id: sub.seller_id, name: sub.shop_name }))
      .filter(shop =>
        shop.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 10);

    setShopSuggestions(localSuggestions);
    setShowShopSuggestions(localSuggestions.length > 0);

    // Also try API as secondary source for additional results
    try {
      const response = await api.get(`/admin/shops/search?q=${encodeURIComponent(query)}`);
      if (response.data && response.data.length > 0) {
        // Combine API results with local suggestions (avoid duplicates)
        const apiIds = new Set(response.data.map((shop: any) => shop.id));
        const combined = [
          ...localSuggestions.filter(s => !apiIds.has(s.id)),
          ...response.data.slice(0, 10)
        ].slice(0, 10);
        setShopSuggestions(combined);
      }
    } catch (error) {
      console.error('Failed to search shops via API:', error);
      // Keep local suggestions if API fails
    }
  };

  const handleSelectShop = (shopId: number, shopName: string) => {
    setManualSellerId(shopId.toString());
    setManualShopName(shopName);
    setShowShopSuggestions(false);
  };

  const handleApplySubscription = async () => {
    if (!manualSellerId || !manualPlanId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a shop and select a plan',
        variant: 'destructive',
      });
      return;
    }

    setManualLoading(true);
    try {
      const response = await api.post(`/admin/apply`, {
        seller_id: parseInt(manualSellerId),
        plan_id: parseInt(manualPlanId),
        reason: 'payment_failure_manual_grant',
      });

      toast({
        title: 'Success',
        description: `Subscription applied to ${manualShopName}`,
        variant: 'default',
      });

      setManualShopName('');
      setManualSellerId('');
      setManualPlanId(plans.length > 0 ? plans[0].id.toString() : '');

      // Refresh subscriptions list
      const subsRes = await api.get('/admin/subscriptions/list');
      setSubscriptions(subsRes.data.subscriptions);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to apply subscription',
        variant: 'destructive',
      });
    } finally {
      setManualLoading(false);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  const filteredSubs = subscriptions.filter(sub => {
    const matchesSearch = sub.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.plan_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'all' || sub.plan_name === filterPlan;
    return matchesSearch && matchesPlan;
  });

  return (
    <DashboardLayout title="Subscriptions" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Subscriptions</h1>
          <p className="text-slate-600 dark:text-neutral-200 mt-2">Monitor subscription metrics and seller plans</p>
        </div>

      {/* KPI Cards */}
      {stats && (
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Subscriptions"
            value={stats.total_subscriptions}
            change={`${stats.active_subscriptions} active`}
            icon={<Users className="w-6 h-6" />}
            color="blue"
          />
          <StatCard
            title="Monthly Revenue"
            value={`KSh ${(stats.total_revenue_monthly / 1000000).toFixed(1)}M`}
            change={`${stats.trial_conversions} from trials`}
            icon={<DollarSign className="w-6 h-6" />}
            color="green"
          />
          <StatCard
            title="Average ARPU"
            value={`KSh ${stats.avg_arpu.toLocaleString()}`}
            change={`Revenue per seller`}
            icon={<TrendingUp className="w-6 h-6" />}
            color="purple"
          />
          <StatCard
            title="Churn Rate"
            value={`${stats.churn_rate.toFixed(1)}%`}
            change="Monthly cancellations"
            icon={<BarChart3 className="w-6 h-6" />}
            color="red"
          />
        </div>
      )}

      {/* Tier Distribution */}
      {stats && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Tier Distribution</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <TierBadge
              name="Free"
              count={stats.tier_distribution.free}
              color="gray"
            />
            <TierBadge
              name="Starter"
              count={stats.tier_distribution.starter}
              color="blue"
            />
            <TierBadge
              name="Business"
              count={stats.tier_distribution.business}
              color="purple"
            />
            <TierBadge
              name="Enterprise"
              count={stats.tier_distribution.enterprise}
              color="orange"
            />
          </div>
        </Card>
      )}

      {/* Manual Subscription Application */}
      <Card className="p-6 bg-amber-50 border-2 border-amber-200">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Manual Subscription Assignment</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-neutral-200">Apply subscription to seller when payment fails or for promotional grants</p>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Shop Name
              </label>
              <input
                type="text"
                placeholder="Search shop name..."
                value={manualShopName}
                onChange={(e) => handleShopSearch(e.target.value)}
                onFocus={() => shopSuggestions.length > 0 && setShowShopSuggestions(true)}
                onBlur={() => setTimeout(() => setShowShopSuggestions(false), 200)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              />
              {showShopSuggestions && shopSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {shopSuggestions.map(shop => (
                    <button
                      key={shop.id}
                      onClick={() => handleSelectShop(shop.id, shop.business_name || shop.name)}
                      className="w-full text-left px-3 py-2 hover:bg-amber-50 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 text-sm transition-colors"
                    >
                      <p className="font-medium text-slate-900 dark:text-white">{shop.business_name || shop.name}</p>
                      <p className="text-xs text-slate-400">{shop.full_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-900 dark:text-white mb-2">
                Plan
              </label>
              <select
                value={manualPlanId}
                onChange={(e) => setManualPlanId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
              >
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.display_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full bg-amber-600 hover:bg-amber-700"
                onClick={handleApplySubscription}
                disabled={manualLoading || !manualSellerId || !manualPlanId}
              >
                {manualLoading ? 'Applying...' : 'Apply Subscription'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Subscriptions List */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop name or plan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="starter">Starter</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Shop Name</th>
                  <th className="px-4 py-3 text-left font-semibold">Plan</th>
                  <th className="px-4 py-3 text-left font-semibold">Monthly Price</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-left font-semibold">Next Renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSubs.length > 0 ? (
                  filteredSubs.map(sub => (
                    <tr key={sub.seller_id} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-4 py-3 font-medium">{sub.shop_name}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sub.plan_name === 'free' ? 'bg-slate-100 dark:bg-neutral-900 text-gray-800' :
                          sub.plan_name === 'starter' ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-800' :
                          sub.plan_name === 'business' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-800' :
                          'bg-orange-50 dark:bg-orange-950/30 text-orange-800'
                        }`}>
                          {sub.plan_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">KSh {sub.monthly_price.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          sub.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800' : 'bg-rose-50 dark:bg-rose-950/30 text-red-800'
                        }`}>
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-200">
                        {new Date(sub.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-200">
                        {sub.renews_at ? new Date(sub.renews_at).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No subscriptions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-sm text-slate-600 dark:text-neutral-200 text-right">
            Showing {filteredSubs.length} of {subscriptions.length} subscriptions
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
    red: 'bg-red-50 text-red-600',
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

function TierBadge({
  name,
  count,
  color,
}: {
  name: string;
  count: number;
  color: string;
}) {
  const colorClasses = {
    gray: 'bg-slate-100 dark:bg-neutral-900 text-gray-800',
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-800',
    purple: 'bg-purple-50 dark:bg-purple-950/30 text-purple-800',
    orange: 'bg-orange-50 dark:bg-orange-950/30 text-orange-800',
  };

  return (
    <div className={`p-4 rounded-lg text-center ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="font-semibold text-lg">{count}</p>
      <p className="text-sm">{name} Tier</p>
    </div>
  );
}
