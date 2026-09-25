'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check, Zap, Building2, ChevronDown, ChevronUp,
  ShieldCheck, BarChart3, Tag, Package, TrendingUp, Palette,
  Upload, Users, Headphones, Phone, Loader, Crown
} from 'lucide-react';
import { SubscriptionCard } from '@/components/seller/SubscriptionCard';
import { UpgradeModal } from '@/components/seller/UpgradeModal';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';

// ─── Data ─────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'free',
    name: 'Free Shop',
    price: 0,
    annualPrice: 0,
    tagline: 'Get started selling',
    icon: Package,
    highlighted: false,
    badge: null,
    trial: null,
    ctaText: 'Current Plan',
    features: [
      'Up to 20 products',
      'Basic messaging',
      'Basic shop page',
    ],
    color: 'gray',
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 750,
    annualPrice: 8000,
    tagline: 'Grow your business',
    icon: Zap,
    highlighted: false,
    badge: null,
    trial: 7,
    ctaText: 'Start Free Trial',
    features: [
      'Up to 200 products',
      'Analytics dashboard',
      'Verified badge',
      'Discount codes',
      'Email support (24h)',
    ],
    color: 'blue',
  },
  {
    id: 'business',
    name: 'Business',
    price: 2500,
    annualPrice: 26000,
    tagline: 'Scale your sales',
    icon: Building2,
    highlighted: true,
    badge: 'Most Popular',
    trial: null,
    ctaText: 'Upgrade to Business',
    features: [
      'Unlimited products',
      'Priority search ranking',
      'Custom shop branding',
      'Bulk product import',
      'Staff accounts (3)',
      'Live chat & WhatsApp support',
    ],
    color: 'orange',
  },
];

const FEATURE_MATRIX = [
  { label: 'Products', free: '20', starter: '200', business: 'Unlimited', icon: Package },
  { label: 'Analytics', free: '—', starter: '✓ Basic', business: '✓ Advanced', icon: BarChart3 },
  { label: 'Verified Badge', free: '—', starter: '✓', business: '✓', icon: ShieldCheck },
  { label: 'Discount Codes', free: '—', starter: '✓', business: '✓', icon: Tag },
  { label: 'Priority Ranking', free: '—', starter: '—', business: '✓', icon: TrendingUp },
  { label: 'Custom Branding', free: '—', starter: '—', business: '✓', icon: Palette },
  { label: 'Bulk Import', free: '—', starter: '—', business: '✓', icon: Upload },
  { label: 'Staff Accounts', free: '—', starter: '—', business: '3', icon: Users },
  { label: 'Support', free: 'Community', starter: 'Email 24h', business: 'Live chat 2–4h', icon: Headphones },
  { label: 'Advertising Credits', free: '—', starter: '—', business: 'KSh 500/mo', icon: Crown },
];

const FAQS = [
  { q: 'Can I cancel anytime?', a: 'Yes, you can cancel your subscription at any time. Your access continues until the end of your billing period.' },
  { q: 'What happens when I reach my product limit?', a: 'You\'ll see a warning at 90% and a hard limit at 200. You can still manage existing products — you just can\'t add new ones until you upgrade.' },
  { q: 'Is there a free trial?', a: 'Yes! The Starter plan comes with a 7-day free trial. No payment required to start.' },
  { q: 'How do I pay?', a: 'We accept M-Pesa via STK push to your registered phone number. Annual billing is also available at a discount.' },
  { q: 'Can I switch plans?', a: 'You can upgrade at any time and the difference will be prorated. Downgrades take effect at the end of your billing cycle.' },
  { q: 'What is the Verified Badge?', a: 'After submitting your National ID and completing phone/email verification, our team reviews your documents (1–2 business days) and grants the ✓ Verified Shop badge.' },
];

const PLAN_COLOR_MAP: Record<string, { card: string; btn: string; badge: string }> = {
  gray: { card: 'border-gray-200 dark:border-neutral-800', btn: 'bg-gray-100 dark:bg-neutral-900 text-gray-800 dark:text-white hover:bg-gray-200', badge: '' },
  blue: { card: 'border-blue-300 dark:border-blue-800', btn: 'bg-blue-600 hover:bg-blue-700 text-white', badge: 'bg-blue-100 text-blue-700' },
  orange: { card: 'border-orange-400 dark:border-orange-600 ring-2 ring-orange-400 dark:ring-orange-600', btn: 'bg-orange-600 hover:bg-orange-700 text-white', badge: 'bg-orange-100 text-orange-700' },
};

function PricingCard({ plan, annual, onUpgrade, currentPlan }: { plan: typeof PLANS[0]; annual: boolean; onUpgrade: () => void; currentPlan: string }) {
  const colors = PLAN_COLOR_MAP[plan.color];
  const Icon = plan.icon;
  const price = annual ? Math.round(plan.annualPrice / 12) : plan.price;
  const isCurrent = currentPlan === plan.id;

  return (
    <div className={`relative flex flex-col bg-white dark:bg-neutral-950 rounded-2xl border-2 p-6 ${colors.card} ${plan.highlighted ? 'shadow-xl' : ''}`}>
      {plan.badge && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold shadow ${colors.badge}`}>
          {plan.badge}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
          plan.color === 'orange' ? 'bg-orange-100 text-orange-600' :
          plan.color === 'blue' ? 'bg-blue-100 text-blue-600' :
          'bg-gray-100 text-gray-600'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-black text-gray-900 dark:text-white">{plan.name}</h3>
          <p className="text-xs text-gray-500 dark:text-neutral-300">{plan.tagline}</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-gray-900 dark:text-white">
            {(plan?.price ?? 0) === 0 ? "Free" : `KSh ${price.toLocaleString()}`}
          </span>
          {(plan?.price ?? 0) > 0 && <span className="text-sm text-gray-400">/mo</span>}
        </div>
        {annual && plan.annualPrice > 0 && (
          <p className="text-xs text-green-600 font-semibold mt-0.5">
            KSh {plan.annualPrice.toLocaleString()}/year · Save KSh {((plan?.price ?? 0) * 12 - plan.annualPrice).toLocaleString()}
          </p>
        )}
        {plan.trial && (
          <p className="text-xs text-blue-600 font-semibold mt-0.5">{plan.trial}-day free trial</p>
        )}
      </div>

      <ul className="space-y-2 flex-1 mb-6">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-orange-500' : 'text-green-500'}`} />
            <span className="text-gray-700 dark:text-neutral-200">{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onUpgrade}
        disabled={isCurrent}
        className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${isCurrent ? 'bg-gray-100 dark:bg-neutral-900 text-gray-400 cursor-not-allowed' : colors.btn}`}
      >
        {isCurrent ? 'Current Plan' : plan.ctaText}
      </button>
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="font-semibold text-gray-900 dark:text-white text-sm">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-gray-600 dark:text-neutral-300 border-t border-gray-100 dark:border-neutral-800 pt-3">
          {a}
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    api.get(`/subscriptions/sellers/${user.id}/features`)
      .then((res) => setCurrentPlan(res.data?.plan_name ?? 'free'))
      .catch(() => setCurrentPlan('free'))
      .finally(() => setLoading(false));
  }, [user, router]);

  if (!user) return null;
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader className="w-7 h-7 animate-spin text-orange-500" />
    </div>
  );

  return (
    <div className="space-y-12 max-w-6xl">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-black text-gray-900 dark:text-white">Choose Your Plan</h1>
        <p className="text-gray-500 dark:text-neutral-300 max-w-lg mx-auto">
          Every paid feature solves a real business problem. Upgrade to unlock tools that grow your shop.
        </p>

        {/* Annual / Monthly toggle */}
        <div className="inline-flex items-center gap-3 mt-4">
          <span className={`text-sm font-semibold select-none ${!annual ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>Monthly</span>
          <button
            type="button"
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual(!annual)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              annual ? 'bg-orange-600' : 'bg-gray-300 dark:bg-neutral-800'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                annual ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-semibold select-none ${annual ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
            Annual <span className="text-green-600 ml-1 text-xs font-bold">Save ~15%</span>
          </span>
        </div>
      </div>

      {/* Current plan card */}
      {user && (
        <div>
          <h2 className="text-lg font-black text-gray-900 dark:text-white mb-4">Your Current Plan</h2>
          <SubscriptionCard sellerId={user.id} onUpgradeClick={() => setShowUpgradeModal(true)} />
        </div>
      )}

      {/* Pricing cards */}
      <div>
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mx-auto lg:max-w-4xl">
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              annual={annual}
              onUpgrade={() => setShowUpgradeModal(true)}
              currentPlan={currentPlan}
            />
          ))}
        </div>
      </div>

      {/* Feature comparison table */}
      <div className="bg-white dark:bg-neutral-950 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">Full Feature Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-neutral-900">
                <th className="text-left py-4 px-5 font-bold text-gray-500 dark:text-neutral-300 w-40">Feature</th>
                {['Free', 'Starter', 'Business'].map((p) => (
                  <th key={p} className={`text-center py-4 px-4 font-black text-sm ${p === 'Business' ? 'text-orange-600 dark:text-orange-400' : 'text-gray-700 dark:text-neutral-200'}`}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, i) => {
                const Icon = row.icon;
                return (
                  <tr key={row.label} className={`border-t border-gray-100 dark:border-neutral-800 ${i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-neutral-900/30'}`}>
                    <td className="py-3.5 px-5 text-gray-700 dark:text-neutral-200 font-medium flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      {row.label}
                    </td>
                    {[row.free, row.starter, row.business].map((val, idx) => (
                      <td key={idx} className={`text-center py-3.5 px-4 text-xs font-semibold ${
                        val === '—' ? 'text-gray-300 dark:text-neutral-300' :
                        val.startsWith('✓') ? 'text-green-600 dark:text-green-400' :
                        idx === 2 ? 'text-orange-600 dark:text-orange-400' :
                        'text-gray-600 dark:text-neutral-300'
                      }`}>
                        {val}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-5">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {FAQS.map((faq) => (
            <FAQItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      <UpgradeModal sellerId={user.id} isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}
