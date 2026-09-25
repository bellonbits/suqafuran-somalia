'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Zap, ArrowRight, Loader } from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';

export type PlanTier = 'starter' | 'business' | 'enterprise';

interface FeatureFlags {
  max_products: number | null;
  has_analytics: boolean;
  has_verified_badge: boolean;
  has_marketing_codes: boolean;
  has_priority_ranking: boolean;
  has_custom_branding: boolean;
  has_bulk_import: boolean;
  has_staff_accounts: boolean;
  has_priority_support: boolean;
  has_api_access: boolean;
  has_custom_domain: boolean;
  has_dedicated_support: boolean;
  max_staff: number;
  plan_name: string;
}

const PLAN_ORDER: Record<string, number> = {
  free: 0,
  starter: 1,
  business: 2,
  enterprise: 3,
};

const PLAN_PRICES: Record<PlanTier, string> = {
  starter: 'KSh 750/mo',
  business: 'KSh 2,500/mo',
  enterprise: 'KSh 10,000/mo',
};

const PLAN_COLORS: Record<PlanTier, string> = {
  starter: 'from-blue-600 to-indigo-600',
  business: 'from-orange-500 to-amber-500',
  enterprise: 'from-purple-600 to-violet-600',
};

interface PlanGateProps {
  /** Minimum plan tier required */
  requiredPlan: PlanTier;
  /** Human-readable feature name shown in the upgrade CTA */
  featureName: string;
  /** Optional description shown in the locked state */
  featureDescription?: string;
  children: ReactNode;
}

export function PlanGate({ requiredPlan, featureName, featureDescription, children }: PlanGateProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    api
      .get(`/subscriptions/sellers/${user.id}/features`)
      .then((res) => setFeatures(res.data))
      .catch(() => setFeatures(null))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const currentPlanRank = PLAN_ORDER[features?.plan_name ?? 'free'] ?? 0;
  const requiredPlanRank = PLAN_ORDER[requiredPlan];
  const hasAccess = currentPlanRank >= requiredPlanRank;

  if (hasAccess) return <>{children}</>;

  const gradient = PLAN_COLORS[requiredPlan];
  const price = PLAN_PRICES[requiredPlan];

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Lock icon */}
        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center mx-auto shadow-lg`}>
          <Lock className="w-8 h-8 text-white" />
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">{featureName}</h2>
          <p className="text-gray-500 dark:text-neutral-300 text-sm leading-relaxed">
            {featureDescription ||
              `${featureName} is available on the ${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan and above.`}
          </p>
        </div>

        {/* Plan badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-neutral-900">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200 capitalize">
            {requiredPlan} Plan · {price}
          </span>
        </div>

        {/* CTA */}
        <button
          onClick={() => router.push('/seller-dashboard/subscription')}
          className={`w-full py-3 px-6 rounded-xl bg-gradient-to-r ${gradient} text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-md`}
        >
          Upgrade to {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)}
          <ArrowRight className="w-4 h-4" />
        </button>

        <p className="text-xs text-gray-400 dark:text-neutral-400">
          7-day free trial available · Cancel anytime
        </p>
      </div>
    </div>
  );
}
