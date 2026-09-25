"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader, AlertTriangle, Shield, TrendingDown, Search } from 'lucide-react';
import { adminService } from '@/services';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { useAuthStore } from '@/store/useAuth';

interface FraudAlert {
  id: number;
  user_id: number;
  user_name: string;
  reason: string;
  severity: 'high' | 'medium' | 'low';
  status: 'open' | 'resolved' | 'false_alarm';
  created_at: string;
}

const FraudPage = () => {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuthStore();
  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadFraudAlerts();
  }, []);

  const loadFraudAlerts = async () => {
    setLoading(true);
    try {
      const data = await adminService.getVerificationAttempts('');
      setAlerts([]);
    } catch (error) {
      console.error('Error loading fraud alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAlerts = alerts.filter(a =>
    a.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: alerts.length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  };

  if (loading) {
    return (
      <DashboardLayout title="Fraud Detection" navItems={navItems} userRole="admin">
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Fraud Detection" navItems={navItems} userRole="admin">
      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Total Alerts</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-slate-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">High Risk</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.high}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Medium</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.medium}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Low Risk</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.low}</p>
              </div>
              <Shield className="w-10 h-10 text-green-500" />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-neutral-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
              />
            </div>
          </div>

          {filteredAlerts.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No fraud alerts detected
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">User</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Reason</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Severity</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => (
                    <tr key={alert.id} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">{alert.user_name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{alert.reason}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          alert.severity === 'high' ? 'bg-rose-50 dark:bg-rose-950/30 text-red-700' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-emerald-50 dark:bg-emerald-950/30 text-green-700'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          alert.status === 'open' ? 'bg-[#e0f7ff] text-blue-700' :
                          alert.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700' :
                          'bg-slate-100 dark:bg-neutral-900 text-gray-700'
                        }`}>
                          {alert.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">
                        {new Date(alert.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default FraudPage;
