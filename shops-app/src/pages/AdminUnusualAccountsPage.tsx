"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader, ArrowLeft, AlertTriangle, Eye, Lock } from 'lucide-react';
import api from '@/services/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { useAuthStore } from '@/store/useAuth';

const UnusualAccountsPage = () => {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');

  const { user } = useAuthStore();
  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadAccounts();
  }, [riskFilter]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/users?limit=200`).catch(() => null);
      if (res?.data) {
        let data = Array.isArray(res.data) ? res.data : [];
        if (riskFilter === 'high') data = data.filter((u: any) => u.is_suspicious);
        if (riskFilter === 'new') data = data.filter((u: any) => {
          const daysOld = (Date.now() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysOld < 7;
        });
        setAccounts(data);
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendAccount = async (userId: number) => {
    if (!confirm('Suspend this account?')) return;
    try {
      await api.patch(`/users/${userId}/status`, { is_active: false }).catch(() => null);
      loadAccounts();
    } catch (error) {
      console.error('Error suspending account:', error);
    }
  };

  const handleReviewAccount = async (userId: number) => {
    try {
      await api.patch(`/users/${userId}`, { is_suspicious: false }).catch(() => null);
      loadAccounts();
    } catch (error) {
      console.error('Error reviewing account:', error);
    }
  };

  const filteredAccounts = accounts.filter((a) =>
    a.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout title="Unusual Accounts" navItems={navItems} userRole="admin">
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
        </div>
      </DashboardLayout>
    );
  }

  const suspiciousCount = accounts.filter((a) => a.is_suspicious).length;
  const newCount = accounts.filter((a) => {
    const daysOld = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysOld < 7;
  }).length;

  return (
    <DashboardLayout title="Unusual Accounts" navItems={navItems} userRole="admin">
      <div className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{suspiciousCount}</p>
            <p className="text-sm text-slate-400 mt-1">Suspicious Accounts</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <Eye className="w-10 h-10 text-yellow-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{newCount}</p>
            <p className="text-sm text-slate-400 mt-1">New Accounts (7 days)</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <Lock className="w-10 h-10 text-[#6cd4ff] mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{accounts.filter((a) => !a.is_active).length}</p>
            <p className="text-sm text-slate-400 mt-1">Suspended</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'high', 'new'].map((f) => (
            <button
              key={f}
              onClick={() => setRiskFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                riskFilter === f
                  ? 'bg-[#5bc0e8] text-white'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-200 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All Accounts' : f === 'high' ? 'High Risk' : 'New Accounts'}
            </button>
          ))}
        </div>

        {/* Accounts Table */}
        <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Name</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Email</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Joined</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Risk Level</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No accounts found
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((account, idx) => {
                  const daysOld = (Date.now() - new Date(account.created_at).getTime()) / (1000 * 60 * 60 * 24);
                  const risk = account.is_suspicious ? 'high' : daysOld < 7 ? 'medium' : 'low';
                  return (
                    <tr key={idx} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{account.full_name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-neutral-200 text-sm">{account.email}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-neutral-200 text-sm">
                        {account.created_at ? new Date(account.created_at).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          risk === 'high'
                            ? 'bg-rose-50 dark:bg-rose-950/30 text-red-700'
                            : risk === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700'
                        }`}>
                          {risk.charAt(0).toUpperCase() + risk.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-2">
                        {account.is_suspicious && (
                          <>
                            <button
                              onClick={() => handleReviewAccount(account.id)}
                              className="px-3 py-1 bg-[#5bc0e8] hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                              Review
                            </button>
                            <button
                              onClick={() => handleSuspendAccount(account.id)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UnusualAccountsPage;
