"use client";

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, SlidersHorizontal, Calendar, ChevronRight,
  MoreHorizontal, Loader2, ArrowUpRight, ArrowDownRight, Package,
  ShoppingCart, DollarSign, CheckCircle2, Clock, XCircle, AlertCircle,
  Eye, RefreshCw, Sparkles, ExternalLink, Tag
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';

interface OrderItem {
  id: string | number;
  order_id_code: string;
  product_name: string;
  product_category: string;
  customer_name: string;
  customer_avatar?: string;
  customer_tier: string;
  amount: number;
  payment_method: string;
  status: 'Accepted' | 'Pending' | 'Completed' | 'Rejected';
  date: string;
}

export default function SellerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [dateRange, setDateRange] = useState<string>('Live Data');

  const [stats, setStats] = useState({
    total_orders: 0,
    new_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    total_revenue: 0,
  });

  const [orders, setOrders] = useState<OrderItem[]>([]);

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        api.get('/dashboard/stats'),
        api.get('/orders?limit=20'),
      ]);

      let loadedOrders: any[] = [];
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) {
        const raw = ordersRes.value.data;
        loadedOrders = Array.isArray(raw) ? raw : raw.orders || raw.items || [];
      }

      let totalRevenue = 0;
      let completedCount = 0;
      let pendingCount = 0;
      let cancelledCount = 0;

      const mapped: OrderItem[] = loadedOrders.map((o: any, idx: number) => {
        const amt = o.total_amount || o.amount || 0;
        totalRevenue += amt;

        let statusText: 'Accepted' | 'Pending' | 'Completed' | 'Rejected' = 'Accepted';
        if (o.status === 'completed') {
          statusText = 'Completed';
          completedCount++;
        } else if (o.status === 'pending') {
          statusText = 'Pending';
          pendingCount++;
        } else if (o.status === 'cancelled' || o.status === 'rejected') {
          statusText = 'Rejected';
          cancelledCount++;
        } else {
          completedCount++;
        }

        // Always resolve customer name
        const custName = o.customer?.full_name || o.customer_name || o.user?.full_name || (o.customer_id ? `Customer #${o.customer_id}` : `Customer #${o.id}`);

        return {
          id: o.id,
          order_id_code: `#017${o.id.toString().padStart(8, '0')}`,
          product_name: o.items?.[0]?.title || o.product_name || `Order #${o.id}`,
          product_category: o.items?.[0]?.category || 'General Product',
          customer_name: custName,
          customer_avatar: o.customer?.avatar_url || undefined,
          customer_tier: 'Registered Customer',
          amount: amt,
          payment_method: o.payment_method || (o.contacted_whatsapp ? 'WhatsApp Checkout' : 'M-Pesa / Direct'),
          status: statusText,
          date: o.created_at ? new Date(o.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently',
        };
      });

      setOrders(mapped);

      let fetchedStats = statsRes.status === 'fulfilled' && statsRes.value?.data ? statsRes.value.data : {};
      setStats({
        total_orders: fetchedStats.total_orders ?? mapped.length,
        new_orders: fetchedStats.pending_orders ?? pendingCount,
        completed_orders: fetchedStats.completed_orders ?? completedCount,
        cancelled_orders: fetchedStats.cancelled_orders ?? cancelledCount,
        total_revenue: fetchedStats.balance ?? totalRevenue,
      });

    } catch (err) {
      console.error('Error fetching seller dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const [dateRangeFilter, setDateRangeFilter] = useState<string>('All Dates');
  const [paymentFilter, setPaymentFilter] = useState<string>('All Methods');
  const [showMoreFilters, setShowMoreFilters] = useState<boolean>(false);

  const activeFilterCount = (statusFilter !== 'All Status' ? 1 : 0) +
                            (dateRangeFilter !== 'All Dates' ? 1 : 0) +
                            (paymentFilter !== 'All Methods' ? 1 : 0) +
                            (searchQuery.trim() !== '' ? 1 : 0);

  const filteredOrders = orders.filter(o => {
    // 1. Search Query
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || o.product_name.toLowerCase().includes(q) ||
                          o.order_id_code.toLowerCase().includes(q) ||
                          o.customer_name.toLowerCase().includes(q);

    // 2. Status
    const matchesStatus = statusFilter === 'All Status' || o.status === statusFilter;

    // 3. Payment Method
    const matchesPayment = paymentFilter === 'All Methods' || o.payment_method.toLowerCase().includes(paymentFilter.toLowerCase());

    // 4. Date Range
    let matchesDate = true;
    if (dateRangeFilter !== 'All Dates' && o.date) {
      const orderDate = new Date(o.date);
      const now = new Date();
      if (!isNaN(orderDate.getTime())) {
        if (dateRangeFilter === 'Today') {
          matchesDate = orderDate.toDateString() === now.toDateString();
        } else if (dateRangeFilter === 'This Week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= sevenDaysAgo;
        } else if (dateRangeFilter === 'This Month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDate = orderDate >= thirtyDaysAgo;
        }
      }
    }

    return matchesSearch && matchesStatus && matchesPayment && matchesDate;
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Accepted':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40';
      case 'Completed':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-100 dark:border-sky-900/40';
      case 'Pending':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40';
      case 'Rejected':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-neutral-900 dark:text-neutral-300';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <p className="text-sm font-semibold text-slate-400">Loading Orders List…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── Page Header Bar (Bright Sky Blue Styling) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Orders List
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Here you can find all of your Orders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-2xl bg-white dark:bg-neutral-950 border border-slate-100 dark:border-neutral-800 text-slate-500 hover:text-slate-800 dark:hover:text-white shadow-sm transition-colors"
            title="Refresh Orders"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/seller-dashboard/products/add')}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-sky-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Order</span>
          </button>

          <button
            className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 text-slate-600 dark:text-neutral-200 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span>More Actions</span>
            <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* ── Stat Summary Grid (Real Data in Somalia Currency) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders Card */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {stats.total_orders.toLocaleString()}
            </h2>
            <span className="inline-flex items-center text-xs font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">All store orders</p>
        </div>

        {/* New Orders Card */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Orders</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {stats.new_orders.toLocaleString()}
            </h2>
            <span className="inline-flex items-center text-xs font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              Pending
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Awaiting fulfillment</p>
        </div>

        {/* Completed Orders Card */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed Orders</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {stats.completed_orders.toLocaleString()}
            </h2>
            <span className="inline-flex items-center text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Done
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Successfully delivered</p>
        </div>

        {/* Revenue Card (Somalia Currency USD) */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              ${stats.total_revenue.toLocaleString()}
            </h2>
            <span className="inline-flex items-center text-xs font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full">
              USD
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">US Dollar / SOS</p>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="bg-white dark:bg-neutral-950 rounded-3xl p-4 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input with ⌘ + S badge */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, Order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl pl-10 pr-12 py-2.5 text-xs md:text-sm text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 text-[10px] font-extrabold text-slate-400 bg-slate-200/60 dark:bg-neutral-800 px-1.5 py-0.5 rounded-md">
            ⌘ S
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
          >
            <option value="All Status">All Status</option>
            <option value="Accepted">Accepted</option>
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
          </select>

          {/* Date Range Select */}
          <div className="relative flex items-center">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 pointer-events-none" />
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl pl-9 pr-3.5 py-2.5 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all appearance-none cursor-pointer"
            >
              <option value="All Dates">01 Jan, 2024 to 31 Dec, 2024</option>
              <option value="Today">Today</option>
              <option value="This Week">This Week</option>
              <option value="This Month">This Month</option>
            </select>
          </div>

          {/* More Filter Toggle Button */}
          <button
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`flex items-center gap-1.5 border text-xs font-bold rounded-2xl px-3.5 py-2.5 transition-colors ${
              showMoreFilters || activeFilterCount > 0
                ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                : 'bg-slate-50 dark:bg-neutral-900/60 border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filter</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-white text-sky-600 text-[10px] font-extrabold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All Status');
                setPaymentFilter('All Methods');
                setDateRangeFilter('All Dates');
              }}
              className="text-xs font-bold text-rose-500 hover:underline px-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Interactive Filter Modal / Panel ── */}
      <AnimatePresence>
        {showMoreFilters && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-neutral-800">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-500" /> Advanced Order Filters
              </h3>
              <button
                onClick={() => setShowMoreFilters(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Payment Method</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none"
                >
                  <option value="All Methods">All Methods</option>
                  <option value="WhatsApp">WhatsApp Checkout</option>
                  <option value="M-Pesa">M-Pesa / Direct</option>
                  <option value="Card">Card Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Order Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none"
                >
                  <option value="All Status">All Status</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Pending">Pending</option>
                  <option value="Completed">Completed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('All Status');
                    setPaymentFilter('All Methods');
                    setDateRangeFilter('All Dates');
                  }}
                  className="w-full py-2.5 bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Real Data Table (Always Shows Customer Name + Somalia Currency) ── */}
      <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
        
        {filteredOrders.length > 0 ? (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-neutral-900/40 border-b border-slate-100 dark:border-neutral-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Product Name</th>
                    <th className="py-3.5 px-5">Customer Name</th>
                    <th className="py-3.5 px-5">Order ID</th>
                    <th className="py-3.5 px-5">Amount (KSh)</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-neutral-900/30 transition-colors group"
                    >
                      {/* Product Name */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold flex-shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{order.product_name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{order.product_category}</p>
                          </div>
                        </div>
                      </td>

                      {/* Customer Name — ALWAYS SHOWN */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          {order.customer_avatar ? (
                            <img
                              src={order.customer_avatar}
                              alt={order.customer_name}
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {order.customer_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white leading-tight">{order.customer_name}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">{order.customer_tier}</p>
                          </div>
                        </div>
                      </td>

                      {/* Order ID */}
                      <td className="py-4 px-5 font-mono font-extrabold text-slate-800 dark:text-neutral-100">
                        {order.order_id_code}
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-5">
                        <p className="font-black text-slate-900 dark:text-white">
                          ${order.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{order.payment_method}</p>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${getStatusBadgeClass(order.status)}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {order.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate('/seller-dashboard/orders')}
                            className="px-3 py-1.5 bg-slate-50 dark:bg-neutral-900 border border-slate-200/60 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Card View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-neutral-800">
              {filteredOrders.map((order) => (
                <div key={order.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center text-sky-600 font-bold flex-shrink-0">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white">{order.product_name}</p>
                        <p className="text-[10px] text-slate-400">{order.product_category}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(order.status)}`}>
                      • {order.status}
                    </span>
                  </div>

                  {/* Customer Name always shown on mobile */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 font-bold text-[10px] flex items-center justify-center">
                        {order.customer_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-extrabold text-slate-900 dark:text-white">{order.customer_name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-400">{order.order_id_code}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-white">Ksh {order.amount.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">{order.payment_method}</p>
                    </div>
                    <button
                      onClick={() => navigate('/seller-dashboard/orders')}
                      className="px-3 py-1.5 bg-sky-500 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <ShoppingCart className="w-12 h-12 text-slate-200 dark:text-neutral-200" />
            <p className="text-base font-extrabold text-slate-700 dark:text-neutral-100">No Orders Yet</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Orders placed by customers will automatically show up here with real customer details and order amounts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
