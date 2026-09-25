'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Zap, AlertCircle, CheckCircle, Mail } from 'lucide-react';

interface AdvertisingPlan {
  id: number;
  name: string;
  placement_type: string;
  description: string;
  price_per_day: number | null;
  price_per_week: number | null;
  price_per_month: number | null;
}

interface Advertisement {
  id: number;
  shop_id: number;
  listing_id: number | null;
  plan_id: number;
  placement_type: string;
  start_date: string;
  end_date: string;
  amount_paid: number;
  status: string;
  created_at: string;
  stats?: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

export default function FeaturedAdsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { toast } = useToast();
  const [plans, setPlans] = useState<AdvertisingPlan[]>([]);
  const [myAds, setMyAds] = useState<Advertisement[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<AdvertisingPlan | null>(null);
  const [duration, setDuration] = useState(7);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [plansRes, adsRes] = await Promise.all([
          api.get('/advertising/plans'),
          api.get('/advertising/my-ads'),
        ]);
        setPlans(plansRes.data);
        setMyAds(adsRes.data);
      } catch (error) {
        console.error('Failed to fetch data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load advertising data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, router, toast]);

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setPurchasing(true);
    try {
      const response = await api.post('/advertising/create-payment', {
        plan_id: selectedPlan.id,
        listing_id: null,
        duration: duration,
      });

      toast({
        title: 'Success',
        description: `Payment created. Total: $ ${response.data.amount}`,
        variant: 'default',
      });

      // TODO: Redirect to M-Pesa payment flow
      // Refresh ads
      const res = await api.get('/advertising/my-ads');
      setMyAds(res.data);
      setSelectedPlan(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to create payment',
        variant: 'destructive',
      });
    } finally {
      setPurchasing(false);
    }
  };

  if (!user) return null;
  if (loading) return <div className="p-6">Loading...</div>;

  const activeAds = myAds.filter(ad => ad.status === 'active');

  // Calculate price based on plan and duration
  const getPricePerUnit = (plan: AdvertisingPlan) => {
    return plan.price_per_day || plan.price_per_week || plan.price_per_month || 0;
  };

  const getDurationUnit = (plan: AdvertisingPlan) => {
    if (plan.price_per_day) return 'day';
    if (plan.price_per_week) return 'week';
    return 'month';
  };

  const selectedPrice = selectedPlan ? getPricePerUnit(selectedPlan) : 0;
  const totalCost = selectedPrice * duration;

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Featured Advertising</h1>
        <p className="text-gray-600 mt-2">
          Boost your shop visibility with premium placements
        </p>
      </div>

      {/* Active Placements */}
      {activeAds.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Active Placements</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {activeAds.map(ad => (
              <Card key={ad.id} className="p-4 border-green-200 bg-green-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {ad.placement_type.replace(/_/g, ' ')}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {Math.ceil((new Date(ad.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      $ {(ad.amount_paid || 0).toLocaleString()}
                    </p>
                    {ad.stats && (
                      <div className="text-xs text-gray-500 mt-2 space-y-1">
                        <p>Views: {ad.stats.impressions}</p>
                        <p>Clicks: {ad.stats.clicks}</p>
                        <p>CTR: {ad.stats.ctr.toFixed(2)}%</p>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm">
                    Renew
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Section */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Placement Options */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Available Placements</h2>
          <div className="space-y-3">
            {plans.map(plan => (
              <PlacementOption
                key={plan.id}
                plan={plan}
                selected={selectedPlan?.id === plan.id}
                onClick={() => setSelectedPlan(plan)}
              />
            ))}
          </div>
        </div>

        {/* Purchase Form */}
        {selectedPlan && (
          <Card className="p-6 h-fit border-blue-200 bg-blue-50">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900">Purchase Details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedPlan.description}
                </p>
              </div>

              {/* Duration Input */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Duration
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value)))}
                    min="1"
                    max="365"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-600">
                    {getDurationUnit(selectedPlan)}(s)
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="border-t pt-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Price:</span>
                  <span className="font-semibold">
                    $ {selectedPrice.toLocaleString()}/{getDurationUnit(selectedPlan)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>$ {Math.round(totalCost).toLocaleString()}</span>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-white border border-blue-200 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-600">
                  You'll pay via EVC Plus, Zaad, or Card. Your placement goes live immediately after payment confirmation.
                </p>
              </div>

              {/* CTA */}
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={handlePurchase}
                disabled={purchasing}
              >
                {purchasing ? 'Processing...' : `Purchase for $ ${Math.round(totalCost).toLocaleString()}`}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Homepage Banner Premium Section */}
      <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-block px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-full">PREMIUM</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Homepage Banner</h2>
            <p className="text-gray-600 mb-4">
              Get featured on Suqafuran's homepage. This premium placement is reserved and managed by our team to ensure the highest quality and maximum visibility.
            </p>
            <p className="text-sm text-gray-700 mb-4">
              <strong>Perfect for:</strong> Seasonal campaigns, new product launches, partnerships, and top-performing sellers.
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                // TODO: Open request modal
                toast({
                  title: 'Contact Our Team',
                  description: 'Email sales@suqafuran.so to discuss homepage banner opportunities',
                  variant: 'default',
                });
              }}
            >
              <Mail className="w-4 h-4" />
              Request Homepage Banner
            </Button>
          </div>
        </div>
      </Card>

      {/* Benefits */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-cyan-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Why Featured Ads?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Increase Visibility</h3>
            <p className="text-sm text-gray-600">
              Get featured placement in search results, category pages, and shop listings
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Instant Results</h3>
            <p className="text-sm text-gray-600">
              Your placement goes live immediately after payment confirmation
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-900">Track Performance</h3>
            <p className="text-sm text-gray-600">
              Monitor impressions, clicks, and CTR for each of your active placements
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PlacementOption({
  plan,
  selected,
  onClick,
}: {
  plan: AdvertisingPlan;
  selected: boolean;
  onClick: () => void;
}) {
  const getIcon = (type: string) => {
    if (type.includes('product')) return <Zap className="w-5 h-5" />;
    if (type.includes('shop')) return <TrendingUp className="w-5 h-5" />;
    if (type.includes('category')) return <TrendingUp className="w-5 h-5" />;
    return <Zap className="w-5 h-5" />;
  };

  const getPricePerUnit = (plan: AdvertisingPlan) => {
    return plan.price_per_day || plan.price_per_week || plan.price_per_month || 0;
  };

  const getUnit = (plan: AdvertisingPlan) => {
    if (plan.price_per_day) return 'day';
    if (plan.price_per_week) return 'week';
    return 'month';
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className={selected ? 'text-blue-600' : 'text-gray-400'}>{getIcon(plan.placement_type)}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{plan.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
          </div>
        </div>
        <div className="text-right ml-4">
          <p className="text-lg font-bold text-gray-900">$ {getPricePerUnit(plan).toLocaleString()}</p>
          <p className="text-xs text-gray-600">/{getUnit(plan)}</p>
        </div>
      </div>
    </button>
  );
}
