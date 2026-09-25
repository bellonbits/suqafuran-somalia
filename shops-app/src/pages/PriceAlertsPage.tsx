'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

interface PriceAlert {
  id: number;
  listing_id: number;
  user_id: number;
  target_price?: number;
  is_active: boolean;
  created_at: string;
  last_notified_at?: string;
  last_price?: number;
}

export default function PriceAlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const { data } = await api.get('/price-alerts/my-alerts');
      setAlerts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnwatch = async (alertId: number) => {
    try {
      await api.delete(`/price-alerts/unwatch/${alertId}`);
      fetchAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">Price Alerts</h1>

        {alerts.length === 0 ? (
          <div className="text-center text-gray-600 dark:text-gray-400">
            You're not watching any listings yet
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Listing #{alert.listing_id}
                    </p>
                    {alert.last_price && (
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        Current: {alert.last_price.toLocaleString()}
                      </p>
                    )}
                    {alert.target_price && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Alert when below: {alert.target_price.toLocaleString()}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      alert.is_active
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {alert.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Watching since {new Date(alert.created_at).toLocaleDateString()}
                </p>

                <button
                  onClick={() => handleUnwatch(alert.id)}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Stop Watching
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
