"use client";

import React, { useState, useEffect } from 'react';
import {
  Search, Filter, SlidersHorizontal, Loader2, Plus, Store,
  ShoppingBag, TrendingUp, Users, Activity, Package, Edit2, Trash2,
  ChevronRight, RefreshCw, Tag
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { promotionService } from '@/services';

const agentNavItems = [
  { label: 'Agent Dashboard', icon: <Activity className="w-5 h-5" />, href: '/agent-dashboard' },
  { label: 'Agent Shops', icon: <Store className="w-5 h-5" />, href: '/agent-shops' },
  { label: 'Agent Listings', icon: <ShoppingBag className="w-5 h-5" />, href: '/agent-listings' },
  { label: 'Agent Earnings', icon: <TrendingUp className="w-5 h-5" />, href: '/agent-earnings' },
  { label: 'Agent Analytics', icon: <Users className="w-5 h-5" />, href: '/agent-analytics' },
];

export default function AgentListingsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadListings(); }, []);

  const loadListings = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await promotionService.getAllListings({ limit: 100 }).catch(() => null);
      setListings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading listings:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredListings = listings.filter(l => {
    const matchesSearch = (l.title || l.title_en || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (l.seller_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' ||
                          (statusFilter === 'Active' && l.status === 'active') ||
                          (statusFilter === 'Pending' && l.status === 'pending');
    return matchesSearch && matchesStatus;
  });

  const totalActive = listings.filter(l => l.status === 'active').length;
  const totalPending = listings.filter(l => l.status === 'pending').length;

  if (loading) {
    return (
      <DashboardLayout title="Agent Listings" navItems={agentNavItems} userRole="agent">
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-semibold text-slate-400">Loading Product Database…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agent Listings" navItems={agentNavItems} userRole="agent">
      <div className="space-y-6 pb-12">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Product Database</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">All listings submitted by sellers across the platform</p>
          </div>
          <button
            onClick={() => loadListings(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Listings', value: listings.length, badge: 'Live', badgeColor: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400' },
            { label: 'Active Listings', value: totalActive, badge: 'Active', badgeColor: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' },
            { label: 'Pending Review', value: totalPending, badge: 'Pending', badgeColor: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <div className="flex items-baseline justify-between mt-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{s.value.toLocaleString()}</h2>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badgeColor}`}>{s.badge}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-4 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by product title or seller name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
          </select>
        </div>

        {/* Listings Table */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          {filteredListings.length > 0 ? (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/60 dark:bg-neutral-900/40 border-b border-slate-100 dark:border-neutral-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                      <th className="py-3.5 px-5">Product Info</th>
                      <th className="py-3.5 px-5">Seller</th>
                      <th className="py-3.5 px-5">Price (USD)</th>
                      <th className="py-3.5 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                    {filteredListings.map((l, i) => {
                      const title = l.title_en || l.title || 'Untitled';
                      const img = l.images?.[0] || l.image_url;
                      return (
                        <tr key={l.id || i} className="hover:bg-slate-50/80 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="py-4 px-5">
                            <div className="flex items-center gap-3">
                              {img ? (
                                <img src={img} alt={title} className="w-10 h-10 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-neutral-900 flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white leading-tight">{title}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{l.location || 'Somalia'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-5 font-medium text-slate-600 dark:text-neutral-200">{l.seller_name || l.seller?.full_name || '—'}</td>
                          <td className="py-4 px-5 font-black text-slate-900 dark:text-white">${(l.price || 0).toLocaleString()}</td>
                          <td className="py-4 px-5">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${l.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current" />
                              {l.status === 'active' ? 'Active' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-neutral-800">
                {filteredListings.map((l, i) => {
                  const title = l.title_en || l.title || 'Untitled';
                  const img = l.images?.[0] || l.image_url;
                  return (
                    <div key={l.id || i} className="p-4 flex items-start gap-3">
                      {img ? (
                        <img src={img} alt={title} className="w-12 h-12 rounded-xl object-cover border flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0"><Package className="w-5 h-5 text-slate-400" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{l.seller_name || '—'}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">${(l.price || 0).toLocaleString()}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${l.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                            {l.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package className="w-12 h-12 text-slate-200 dark:text-neutral-200" />
              <p className="text-base font-extrabold text-slate-700 dark:text-neutral-100">No Listings Found</p>
              <p className="text-xs text-slate-400 max-w-sm text-center">No product listings match your current search or filters.</p>
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  );
}
