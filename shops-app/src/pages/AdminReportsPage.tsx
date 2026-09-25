"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader, ArrowLeft, Download, BarChart3, Users, ShoppingCart, DollarSign } from 'lucide-react';
import api from '@/services/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { useAuthStore } from '@/store/useAuth';

const ReportsPage = () => {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('orders');

  const { user } = useAuthStore();
  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadReports();
  }, [reportType]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get(`/admin/stats`).catch(() => null);
      if (statsRes?.data) setStats(statsRes.data);

      const ordersRes = await api.get(`/admin/orders?limit=1000`).catch(() => null);
      if (ordersRes?.data) setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Status', 'Amount', 'Date'];
    const rows = orders.map((o) => [
      o.id,
      o.status,
      o.total_amount,
      new Date(o.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <DashboardLayout title="Reports & Analytics" navItems={navItems} userRole="admin">
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Reports & Analytics" navItems={navItems} userRole="admin">
      <div className="p-6">
        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <ShoppingCart className="w-10 h-10 text-[#6cd4ff] mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats?.total_orders || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Total Orders</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <Users className="w-10 h-10 text-green-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats?.total_users || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Total Users</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <DollarSign className="w-10 h-10 text-purple-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">Ksh {(stats?.total_revenue || 0).toLocaleString()}</p>
            <p className="text-sm text-slate-400 mt-1">Total Revenue</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <BarChart3 className="w-10 h-10 text-orange-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{stats?.avg_order_value || 0}</p>
            <p className="text-sm text-slate-400 mt-1">Avg Order Value</p>
          </div>
        </div>

        {/* Export Section */}
        <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Export Data</h2>
              <p className="text-slate-400 text-sm mt-1">Download order data as CSV</p>
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-6 py-3 bg-[#5bc0e8] hover:bg-sky-700 text-white rounded-lg font-bold transition-colors"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Orders Summary */}
        <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-neutral-800">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Recent Orders</h2>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Order ID</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Amount</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 20).map((order, idx) => (
                <tr key={idx} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                  <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{order.id}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      order.status === 'delivered'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700'
                        : order.status === 'cancelled'
                        ? 'bg-rose-50 dark:bg-rose-950/30 text-red-700'
                        : 'bg-[#e0f7ff] text-blue-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-900 dark:text-white font-semibold">Ksh {order.total_amount?.toLocaleString()}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-neutral-200 text-sm">
                    {new Date(order.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
