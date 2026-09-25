'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Zap, Gift, TrendingUp } from 'lucide-react';

interface LaunchPromotionProps {
  sellerId: number;
  onDismiss?: () => void;
  onStart?: () => void;
}

export function LaunchPromotion({ sellerId, onDismiss, onStart }: LaunchPromotionProps) {
  const [dismissed, setDismissed] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(7);

  useEffect(() => {
    // Check localStorage for dismissal
    const key = `promo_dismissed_${sellerId}`;
    if (localStorage.getItem(key)) {
      setDismissed(true);
    }

    // Calculate days remaining in early-bird period
    const launchDate = new Date('2026-08-02'); // Adjust to your launch date
    const today = new Date();
    const diffTime = launchDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setDaysRemaining(Math.max(0, diffDays));
  }, [sellerId]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`promo_dismissed_${sellerId}`, 'true');
    onDismiss?.();
  };

  return (
    <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-blue-200 opacity-10 rounded-full -mr-20 -mt-20"></div>

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-lg mt-1">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Suqafuran Plans Launched!</h3>
              <p className="text-sm text-gray-600 mt-1">
                Unlock unlimited products and advanced tools
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white rounded-lg transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="flex gap-2">
            <Gift className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Early Bird: 20% Off</p>
              <p className="text-gray-600">{daysRemaining} days left</p>
            </div>
          </div>
          <div className="flex gap-2">
            <TrendingUp className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">4-Tier Plans</p>
              <p className="text-gray-600">From Free to Enterprise</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Zap className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">Premium Features</p>
              <p className="text-gray-600">Analytics, badges, rankings</p>
            </div>
          </div>
        </div>

        {/* Benefits */}
        <div className="bg-white bg-opacity-60 p-3 rounded-lg space-y-2">
          <p className="text-xs font-semibold text-gray-900">What You Get:</p>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>✓ Unlimited products on Pro/Business/Enterprise</li>
            <li>✓ Advanced analytics & seller tools</li>
            <li>✓ Verified seller badge (boost credibility)</li>
            <li>✓ Priority search ranking (more visibility)</li>
            <li>✓ Featured advertising placements</li>
          </ul>
        </div>

        {/* CTA */}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              onStart?.();
              handleDismiss();
            }}
          >
            View Plans
          </Button>
          <Button
            variant="outline"
            onClick={handleDismiss}
          >
            Later
          </Button>
        </div>

        {/* Countdown */}
        {daysRemaining > 0 && (
          <p className="text-xs text-center text-gray-600">
            Early-bird discount expires in <span className="font-bold text-blue-600">{daysRemaining} days</span>
          </p>
        )}
      </div>
    </Card>
  );
}
