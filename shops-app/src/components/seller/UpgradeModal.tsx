'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import api from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Plan {
  id: number;
  name: string;
  display_name: string;
  monthly_price: number;
  annual_price: number;
  trial_days: number;
  features: Record<string, any>;
}

interface UpgradeModalProps {
  sellerId: number;
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ sellerId, isOpen, onClose }: UpgradeModalProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annual'>('monthly');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.get('/subscriptions/plans');
        console.log('Fetched plans:', response.data);
        setPlans(response.data);
        // Select Starter plan (has 7-day trial)
        const starterPlan = response.data.find((p: Plan) =>
          p.name === 'starter' || (p.name === 'pro' && p.trial_days > 0)
        );
        console.log('Selected plan:', starterPlan);
        if (starterPlan) {
          setSelectedPlan(starterPlan);
          setShowPaymentForm(false);  // Reset to show trial buttons
          console.log('Plan selected with trial_days:', starterPlan.trial_days);
        }
      } catch (error) {
        console.error('Failed to fetch plans:', error);
        toast({
          title: 'Error',
          description: 'Failed to load subscription plans',
          variant: 'destructive',
        });
      } finally {
        setPlansLoading(false);
      }
    };

    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen, toast]);

  const handleStartTrial = async () => {
    if (!selectedPlan) {
      toast({
        title: 'Select a Plan',
        description: 'Please select a plan to start the free trial',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/subscriptions/sellers/${sellerId}/start-trial`, {
        plan_id: selectedPlan.id,
      });

      toast({
        title: 'Trial Started!',
        description: `${selectedPlan.display_name} trial activated for ${selectedPlan.trial_days} days`,
        variant: 'default',
      });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to start trial',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedPlan || !phoneNumber) {
      toast({
        title: 'Missing Information',
        description: 'Please select a plan and enter your phone number',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post(`/subscriptions/sellers/${sellerId}/upgrade`, {
        plan_id: selectedPlan.id,
        billing_frequency: billingFrequency,
        phone_number: phoneNumber,
      });

      if (response.data.status === 'payment_initiated') {
        toast({
          title: 'Payment Initiated',
          description: 'Check your phone for M-Pesa prompt. Enter your PIN to confirm.',
          variant: 'default',
        });
        onClose();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.detail || 'Failed to initiate payment',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const price = billingFrequency === 'monthly'
    ? selectedPlan?.monthly_price
    : selectedPlan?.annual_price;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <Card className="w-full mx-4 max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Upgrade Your Shop</h2>
              <p className="text-gray-600 mt-1">Choose a plan and unlock more features</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          {/* Plans Comparison */}
          {!plansLoading && (
            <div className="space-y-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlan(plan);
                    setShowPaymentForm(false);
                  }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedPlan?.id === plan.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{plan.display_name}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {plan.features.max_products
                          ? `Up to ${plan.features.max_products} products`
                          : 'Unlimited products'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        KSh {plan.monthly_price.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-600">/month</p>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                    {plan.features.has_analytics && (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>✓</span> Analytics
                      </div>
                    )}
                    {plan.features.has_verified_badge && (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>✓</span> Verified Badge
                      </div>
                    )}
                    {plan.features.has_priority_ranking && (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>✓</span> Priority Ranking
                      </div>
                    )}
                    {plan.features.has_bulk_import && (
                      <div className="flex items-center gap-2 text-green-700">
                        <span>✓</span> Bulk Import
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Billing Frequency */}
          {selectedPlan && selectedPlan.name !== 'free' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-900">
                Billing Frequency
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="monthly"
                    checked={billingFrequency === 'monthly'}
                    onChange={(e) => setBillingFrequency(e.target.value as 'monthly' | 'annual')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700">
                    Monthly: KSh {selectedPlan.monthly_price.toLocaleString()}
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value="annual"
                    checked={billingFrequency === 'annual'}
                    onChange={(e) => setBillingFrequency(e.target.value as 'monthly' | 'annual')}
                    className="w-4 h-4"
                  />
                  <span className="text-gray-700">
                    Annual: KSh {selectedPlan.annual_price.toLocaleString()}
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Trial Info */}
          {selectedPlan && selectedPlan.trial_days > 0 && !showPaymentForm && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-900 font-semibold">
                ✓ Free {selectedPlan.trial_days}-day trial available!
              </p>
              <p className="text-sm text-green-800 mt-1">
                Try all features risk-free. No credit card required.
              </p>
            </div>
          )}

          {/* Phone Number Input - only show when paying */}
          {selectedPlan && selectedPlan.name !== 'free' && showPaymentForm && (
            <div className="space-y-2">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-900">
                M-Pesa Phone Number
              </label>
              <input
                id="phone"
                type="tel"
                placeholder="254712345678 or 0712345678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500">
                Enter the phone number associated with your M-Pesa account
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            {selectedPlan && selectedPlan.trial_days > 0 && !showPaymentForm ? (
              <>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleStartTrial}
                  disabled={loading}
                >
                  {loading ? 'Starting...' : `Start Free Trial`}
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowPaymentForm(true)}
                  disabled={loading}
                >
                  Pay Now
                </Button>
              </>
            ) : showPaymentForm && selectedPlan ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowPaymentForm(false)}
                >
                  Back
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleUpgrade}
                  disabled={loading || !phoneNumber}
                >
                  {loading ? 'Processing...' : `Pay KSh ${price?.toLocaleString()}`}
                </Button>
              </>
            ) : selectedPlan && selectedPlan.name !== 'free' ? (
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={handleUpgrade}
                disabled={loading || !phoneNumber}
              >
                {loading ? 'Processing...' : `Pay KSh ${price?.toLocaleString()}`}
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
