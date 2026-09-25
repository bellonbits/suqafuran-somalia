"use client";

import React, { useEffect, useState } from 'react';
import {
  DollarSign, Wallet, TrendingUp, Users, Activity, Store, ShoppingBag,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Calendar, CreditCard, Banknote, Receipt
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import api from '@/services/api';

const agentNavItems = [
  { label: 'Agent Dashboard', icon: <Activity className="w-5 h-5" />, href: '/agent-dashboard' },
  { label: 'Agent Shops', icon: <Store className="w-5 h-5" />, href: '/agent-shops' },
  { label: 'Agent Listings', icon: <ShoppingBag className="w-5 h-5" />, href: '/agent-listings' },
  { label: 'Agent Earnings', icon: <TrendingUp className="w-5 h-5" />, href: '/agent-earnings' },
  { label: 'Agent Analytics', icon: <Users className="w-5 h-5" />, href: '/agent-analytics' },
];

export default function AgentEarningsPage() {
  const [earnings, setEarnings] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadEarnings(); }, []);

  const loadEarnings = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [earningsRes, txRes] = await Promise.allSettled([
        api.get('/promotions/agent/history'),
        api.get('/wallet/transactions'),
      ]);
      if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value.data);
      if (txRes.status === 'fulfilled') setTransactions(Array.isArray(txRes.value.data) ? txRes.value.data.slice(0, 10) : []);
    } catch (err) {
      console.error('Error loading earnings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fmt = (val: number) => val ? `Ksh ${val.toLocaleString()}` : 'Ksh 0';

  if (loading) {
    return (
      <DashboardLayout title="Agent Earnings" navItems={agentNavItems} userRole="agent">
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-semibold text-slate-400">Loading Earnings Data…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agent Earnings" navItems={agentNavItems} userRole="agent">
      <div className="space-y-6 pb-12">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Earnings Overview</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Your commission history, wallet balance, and transaction log</p>
          </div>
          <button
            onClick={() => loadEarnings(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Earnings Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              label: 'This Month',
              value: fmt(earnings?.this_month || 0),
              icon: Calendar,
              iconBg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600',
              trend: '+12%',
              trendUp: true,
            },
            {
              label: 'Total Earned (All Time)',
              value: fmt(earnings?.total_earned || 0),
              icon: Banknote,
              iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600',
              trend: '+8%',
              trendUp: true,
            },
            {
              label: 'Available Balance',
              value: fmt(earnings?.available_balance || 0),
              icon: Wallet,
              iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600',
              trend: 'Ready to withdraw',
              trendUp: true,
            },
          ].map((card, i) => {
            const Icon = card.icon;
            return (
              <div key={i} className="bg-white dark:bg-neutral-950 rounded-3xl p-6 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.label}</p>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{card.value}</h2>
                <div className="flex items-center gap-1.5 mt-2">
                  {card.trendUp ? (
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                  )}
                  <span className={`text-[11px] font-bold ${card.trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>{card.trend}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Withdraw CTA Card */}
        <div className="bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl shadow-sky-500/20">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-lg pointer-events-none" />
          <div className="relative">
            <p className="text-xs font-extrabold text-sky-100 uppercase tracking-wider mb-1">Available Payout</p>
            <h2 className="text-3xl font-black text-white tracking-tight">{fmt(earnings?.available_balance || 0)}</h2>
            <p className="text-sm text-sky-100 mt-1">Minimum withdrawal: Ksh 500</p>
            <button className="mt-4 px-6 py-2.5 bg-white text-sky-600 rounded-2xl text-xs font-extrabold hover:bg-sky-50 transition-all active:scale-95 shadow-sm">
              Request Withdrawal →
            </button>
          </div>
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-neutral-800">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-sky-500" /> Transaction History
            </h3>
          </div>

          {transactions.length > 0 ? (
            <div className="divide-y divide-slate-50 dark:divide-neutral-800/40">
              {transactions.map((tx: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-4 hover:bg-slate-50/60 dark:hover:bg-neutral-900/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${tx.type === 'credit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {tx.type === 'credit' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{tx.description || (tx.type === 'credit' ? 'Commission Earned' : 'Withdrawal')}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent'}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-black ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {tx.type === 'credit' ? '+' : '-'}Ksh {(tx.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Receipt className="w-10 h-10 text-slate-200 dark:text-neutral-200" />
              <p className="text-sm font-extrabold text-slate-600 dark:text-neutral-200">No Transactions Yet</p>
              <p className="text-xs text-slate-400">Your transaction history will appear here once you start earning commissions.</p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
