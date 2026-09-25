"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Eye, Loader } from 'lucide-react';
import api from '@/services/api';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadOrdersData();
  }, []);

  const loadOrdersData = async () => {
    try {
      console.log('[DEBUG] Loading orders from /orders');
      const [ordersRes, statsRes] = await Promise.all([
        api.get('/orders?limit=100').catch((err) => {
          console.error('[ERROR] Orders fetch failed:', err);
          return null;
        }),
        api.get('/dashboard/stats').catch((err) => {
          console.error('[ERROR] Stats fetch failed:', err);
          return null;
        }),
      ]);

      console.log('[DEBUG] Orders response:', ordersRes);
      if (ordersRes?.data) {
        const ordersArray = Array.isArray(ordersRes.data) ? ordersRes.data : ordersRes.data.orders || [];
        console.log('[DEBUG] Orders count:', ordersArray.length);
        setOrders(ordersArray);
      } else {
        console.warn('[DEBUG] No orders data');
        setOrders([]);
      }

      if (statsRes?.data) {
        const orderData = Array.isArray(ordersRes?.data) ? ordersRes.data : [];
        const totalOrders = orderData.length;
        const pending = orderData.filter((o: any) => o.status === 'pending').length;
        const processing = orderData.filter((o: any) => o.status === 'processing').length;
        const delivered = orderData.filter((o: any) => o.status === 'delivered').length;

        setStats({
          total_orders: totalOrders,
          pending,
          processing,
          delivered,
        });
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading orders...</p>
        </div>
      </div>
    );
  }

  const statValues = {
    total_orders: stats?.total_orders || 0,
    pending: stats?.pending || 0,
    processing: stats?.processing || 0,
    delivered: stats?.delivered || 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Orders</h1>
        <p className="text-gray-600 dark:text-neutral-300">Manage customer orders</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Total Orders</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{statValues.total_orders}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Pending</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{statValues.pending}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Processing</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{statValues.processing}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Delivered</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{statValues.delivered}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
          />
        </div>
        <button className="px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 flex items-center gap-2">
          <Filter className="w-4 h-4" /> Filter
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Order ID</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Customer</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Items</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Amount</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Date</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">No orders yet</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{order.id}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{order.customer_name || order.customer?.full_name || order.buyer_name || 'Guest Customer'}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">
                      {order.items && Array.isArray(order.items) && order.items.length > 0
                        ? order.items.map((item: any) => item.title).join(', ')
                        : order.items_count || 0}
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">KSh {(order.total_amount || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-neutral-300">{new Date(order.created_at).toLocaleDateString() || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'delivered'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          : order.status === 'processing'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
                      }`}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-700">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
