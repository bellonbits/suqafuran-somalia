'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/services/api';

interface Subscription {
  id: number;
  plan_name: string;
  status: string;
  is_active: boolean;
  trial_active: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  renews_at: string | null;
}

interface SubscriptionCardProps {
  sellerId: number;
  onUpgradeClick: () => void;
}

export function SubscriptionCard({ sellerId, onUpgradeClick }: SubscriptionCardProps) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await api.get(`/subscriptions/sellers/${sellerId}/current`);
        setSubscription(response.data);
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [sellerId]);

  if (loading) {
    return (
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-blue-50">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </Card>
    );
  }

  if (!subscription || subscription.status === 'no_subscription') {
    return (
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Free Tier</h3>
            <p className="text-sm text-gray-600 mt-1">Limited to 30 products</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="default"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={onUpgradeClick}
            >
              Start 7-Day Free Trial
            </Button>
            <Button variant="outline" onClick={onUpgradeClick}>
              View Plans
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const trialEndsAt = subscription.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString()
    : null;
  const renewsAt = subscription.renews_at
    ? new Date(subscription.renews_at).toLocaleDateString()
    : null;

  return (
    <Card className={`p-6 border-2 ${
      subscription.plan_name === 'pro'
        ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300'
        : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300'
    }`}>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {subscription.plan_name} {subscription.trial_active && '(Trial)'}
              </h3>
              {subscription.plan_name === 'pro' && (
                <span className="px-2 py-1 text-xs font-semibold text-white bg-purple-600 rounded-full">
                  Active
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {subscription.trial_active
                ? `Trial ends ${trialEndsAt}`
                : `Renews ${renewsAt}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onUpgradeClick}>
            Manage
          </Button>
        </div>

        {subscription.trial_active && (
          <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              You're on a free trial. Unlimited products, analytics, and advanced tools.
            </p>
          </div>
        )}

        {subscription.plan_name === 'pro' && !subscription.trial_active && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Unlimited Products</p>
              <p className="font-semibold text-gray-900">✓</p>
            </div>
            <div>
              <p className="text-gray-600">Advanced Analytics</p>
              <p className="font-semibold text-gray-900">✓</p>
            </div>
            <div>
              <p className="text-gray-600">Priority Ranking</p>
              <p className="font-semibold text-gray-900">✓</p>
            </div>
            <div>
              <p className="text-gray-600">Verified Badge</p>
              <p className="font-semibold text-gray-900">✓</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
