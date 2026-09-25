'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/navigation';
import { useAuthStore } from '@/store/useAuth';
import { Mail, TrendingUp, Eye, MousePointerClick, Target, Calendar, Zap, TrendingDown } from 'lucide-react';

interface EmailStats {
  total_sent: number;
  total_opened: number;
  total_clicked: number;
  open_rate: number;
  click_rate: number;
  by_event_type: {
    [key: string]: {
      sent: number;
      opened: number;
      clicked: number;
      open_rate: number;
      click_rate: number;
    };
  };
  by_date: {
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }[];
}

interface EmailCampaign {
  id: number;
  user_id: number;
  event_type: string;
  subject: string;
  template_name: string;
  sent_at: string;
  opened_at: string | null;
  clicked_at: string | null;
  status: string;
}

export default function EmailAnalyticsPage() {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('week');
  const [selectedEvent, setSelectedEvent] = useState<string>('all');

  const navItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
    ...item,
    icon: <Icon className="w-5 h-5" />
  }));

  useEffect(() => {
    if (user?.is_admin || user?.is_agent) {
      fetchAnalytics();
    }
  }, [user, filter, selectedEvent]);

  const fetchAnalytics = async () => {
    try {
      const [statsRes, campaignsRes] = await Promise.all([
        api.get(`/admin/email-analytics/stats?period=${filter}&event_type=${selectedEvent}`),
        api.get(`/admin/email-analytics/campaigns?period=${filter}&event_type=${selectedEvent}&limit=50`),
      ]);

      setStats(statsRes.data);
      setCampaigns(campaignsRes.data.campaigns || []);
    } catch (error) {
      console.error('Failed to fetch email analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Email Analytics" navItems={navItems} userRole="admin">
        <div className="p-6">Loading analytics...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Email Analytics" navItems={navItems} userRole="admin">
      <div className="container mx-auto py-8 px-4 max-w-7xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Email Campaign Analytics</h1>
          <p className="text-slate-600 dark:text-neutral-200 mt-2">Monitor email performance and engagement metrics</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">Time Period</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">Email Type</label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              <option value="signup">Signup</option>
              <option value="listing_approved">Listing Approved</option>
              <option value="listing_rejected">Listing Rejected</option>
              <option value="price_dropped">Price Drops</option>
              <option value="weekly_digest">Weekly Digest</option>
              <option value="saved_search_match">Search Matches</option>
              <option value="abandoned_listing">Abandoned Listing</option>
              <option value="inactive_seller">Inactive Seller</option>
              <option value="birthday">Birthday</option>
              <option value="reengagement">Re-engagement</option>
            </select>
          </div>
        </div>

        {/* KPI Cards */}
        {stats && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Sent"
              value={(stats.total_sent ?? 0).toLocaleString()}
              icon={<Mail className="w-6 h-6" />}
              color="blue"
            />
            <StatCard
              title="Open Rate"
              value={`${(stats.open_rate ?? 0).toFixed(1)}%`}
              subtitle={`${(stats.total_opened ?? 0).toLocaleString()} opens`}
              icon={<Eye className="w-6 h-6" />}
              color="green"
            />
            <StatCard
              title="Click Rate"
              value={`${(stats.click_rate ?? 0).toFixed(1)}%`}
              subtitle={`${(stats.total_clicked ?? 0).toLocaleString()} clicks`}
              icon={<MousePointerClick className="w-6 h-6" />}
              color="purple"
            />
            <StatCard
              title="Performance"
              value={(stats.open_rate ?? 0) > 25 ? 'Excellent' : (stats.open_rate ?? 0) > 15 ? 'Good' : 'Needs Work'}
              subtitle={`Industry avg: 21%`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="orange"
            />
          </div>
        )}

        {/* Performance by Email Type */}
        {stats && Object.keys(stats.by_event_type).length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Performance by Email Type</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Email Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Sent</th>
                    <th className="px-4 py-3 text-left font-semibold">Opens</th>
                    <th className="px-4 py-3 text-left font-semibold">Open Rate</th>
                    <th className="px-4 py-3 text-left font-semibold">Clicks</th>
                    <th className="px-4 py-3 text-left font-semibold">Click Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.entries(stats.by_event_type).map(([type, data]) => (
                    <tr key={type} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-4 py-3 font-medium capitalize">{type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3">{data.sent.toLocaleString()}</td>
                      <td className="px-4 py-3">{data.opened.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          data.open_rate > 25
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                            : data.open_rate > 15
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-red-800'
                        }`}>
                          {data.open_rate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3">{data.clicked.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="text-blue-600 font-medium">{data.click_rate.toFixed(1)}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Recent Campaigns */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Campaigns</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Subject</th>
                  <th className="px-4 py-3 text-left font-semibold">Type</th>
                  <th className="px-4 py-3 text-left font-semibold">Sent Date</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Interaction</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No campaigns found
                    </td>
                  </tr>
                ) : (
                  campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{campaign.subject}</td>
                      <td className="px-4 py-3">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-800">
                          {campaign.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-neutral-200">
                        {new Date(campaign.sent_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          campaign.status === 'sent'
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {campaign.opened_at ? (
                          <span className="text-green-600">✓ Opened</span>
                        ) : campaign.clicked_at ? (
                          <span className="text-blue-600">✓ Clicked</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recommendations */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <div className="flex gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 mb-2">Recommendations:</p>
              <ul className="text-sm text-blue-900 space-y-1">
                <li>• Send emails Tuesday-Thursday for best engagement</li>
                <li>• Keep subject lines under 50 characters for mobile</li>
                <li>• Test send times: 9 AM, 2 PM, and 8 PM are most effective</li>
                <li>• Segment by user lifecycle stage for better relevance</li>
                <li>• Monitor unsubscribe rates and adjust frequency if needed</li>
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
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  const colorClass = colorClasses[color] || colorClasses.blue;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-neutral-200">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
