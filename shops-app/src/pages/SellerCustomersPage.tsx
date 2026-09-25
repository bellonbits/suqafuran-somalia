"use client";

import React, { useState, useEffect } from 'react';
import { Search, Filter, Loader } from 'lucide-react';
import api from '@/services/api';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadCustomersData();
  }, []);

  const loadCustomersData = async () => {
    try {
      const ordersRes = await api.get('/orders?limit=100').catch(() => null);

      if (ordersRes?.data) {
        const orders = Array.isArray(ordersRes.data) ? ordersRes.data : [];

        const customerMap = new Map<string, any>();
        orders.forEach((order: any) => {
          const customerId = order.customer_id || order.id;
          const customerName = order.customer_name || 'Unknown Customer';

          if (!customerMap.has(customerId)) {
            customerMap.set(customerId, {
              id: customerId,
              name: customerName,
              email: order.customer_email || 'N/A',
              orders: 0,
              spent: 0,
            });
          }

          const customer = customerMap.get(customerId)!;
          customer.orders += 1;
          customer.spent += order.total_amount || 0;
        });

        const customersList = Array.from(customerMap.values());
        setCustomers(customersList);

        const totalCustomers = customersList.length;
        const repeatCustomers = customersList.filter((c: any) => c.orders > 1).length;
        const avgOrderValue = totalCustomers > 0
          ? customersList.reduce((sum: number, c: any) => sum + c.spent, 0) / totalCustomers
          : 0;

        setStats({
          total_customers: totalCustomers,
          repeat_customers: repeatCustomers,
          avg_order_value: Math.round(avgOrderValue),
        });
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Customers</h1>
        <p className="text-gray-600 dark:text-neutral-300">Manage and view customer information</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_customers || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Repeat Customers</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.repeat_customers || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Avg Order Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">KSh {(stats?.avg_order_value || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
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
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Email</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Orders</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Total Spent</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-400">No customers yet</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{customer.name}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-neutral-300">{customer.email}</td>
                    <td className="px-6 py-4 text-gray-900 dark:text-white">{customer.orders}</td>
                    <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">KSh {(customer.spent || 0).toLocaleString()}</td>
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
