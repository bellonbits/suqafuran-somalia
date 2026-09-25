"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingCart, Search, Loader, DollarSign, CheckCircle2, MessageCircle,
  Phone, MessageSquareText, Store, Clock, RadioTower
} from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import api from '@/services/api';

const adminNavItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
  ...item,
  icon: <Icon className="w-5 h-5" />
}));

const REFRESH_INTERVAL_MS = 15000;

interface ReceiptItem {
  listing_id?: number;
  title: string;
  price: number;
  quantity: number;
}

interface Receipt {
  id: number;
  customer: { id: number; full_name: string; email: string; phone: string };
  seller: { id: number; full_name: string; shop_name: string };
  items: ReceiptItem[];
  total_amount: number;
  created_at: string;
  contacted_whatsapp: boolean;
  contacted_call: boolean;
  contacted_message: boolean;
  last_contacted_at: string | null;
}

function ContactBadge({ receipt }: { receipt: Receipt }) {
  const anyContact = receipt.contacted_whatsapp || receipt.contacted_call || receipt.contacted_message;
  return (
    <div className="flex items-center gap-2.5">
      <FaWhatsapp className={`w-4 h-4 ${receipt.contacted_whatsapp ? 'text-[#25D366]' : 'text-gray-300'}`} title={receipt.contacted_whatsapp ? 'Contacted via WhatsApp' : 'Not contacted via WhatsApp'} />
      <Phone className={`w-4 h-4 ${receipt.contacted_call ? 'text-emerald-500' : 'text-gray-300'}`} title={receipt.contacted_call ? 'Called seller' : 'Did not call'} />
      <MessageSquareText className={`w-4 h-4 ${receipt.contacted_message ? 'text-blue-500' : 'text-gray-300'}`} title={receipt.contacted_message ? 'Sent an in-app message' : 'No in-app message'} />
      {!anyContact && <span className="text-xs text-slate-400 ml-0.5">No contact yet</span>}
    </div>
  );
}

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'contacted' | 'not_contacted'>('all');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadReceipts = useCallback(async () => {
    try {
      const res = await api.get('/admin/orders');
      setReceipts(Array.isArray(res.data) ? res.data : []);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Error loading checkout receipts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReceipts();
    const interval = setInterval(loadReceipts, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadReceipts]);

  const filtered = receipts.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q ||
      r.id?.toString().includes(q) ||
      (r.customer?.full_name || '').toLowerCase().includes(q) ||
      (r.seller?.shop_name || '').toLowerCase().includes(q);
    const anyContact = r.contacted_whatsapp || r.contacted_call || r.contacted_message;
    const matchContact = contactFilter === 'all' ||
      (contactFilter === 'contacted' && anyContact) ||
      (contactFilter === 'not_contacted' && !anyContact);
    return matchSearch && matchContact;
  });

  const totalValue = receipts.reduce((s, r) => s + (r.total_amount || 0), 0);
  const contactedCount = receipts.filter(r => r.contacted_whatsapp || r.contacted_call || r.contacted_message).length;
  const notContactedCount = receipts.length - contactedCount;

  if (loading) {
    return (
      <DashboardLayout title="Orders Management" navItems={adminNavItems} userRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-400 text-sm">Loading checkout activity…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Orders Management" navItems={adminNavItems} userRole="admin">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Checkout Activity</h2>
          <p className="text-sm text-slate-400 mt-0.5">What buyers put in their cart, from which shop, and whether they followed up with the seller</p>
        </div>
        {lastRefreshed && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <RadioTower className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            Live · updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-7">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{receipts.length}</p>
            <p className="text-sm text-slate-400 mt-0.5">Total Checkouts</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{contactedCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">Contacted Seller</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{notContactedCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">No Contact Yet</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">Ksh {Math.round(totalValue / 1000)}k</p>
            <p className="text-sm text-slate-400 mt-0.5">Total Cart Value</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by receipt ID, buyer, or shop…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white dark:bg-neutral-950 shadow-sm"
          />
        </div>
        <select
          value={contactFilter}
          onChange={e => setContactFilter(e.target.value as any)}
          className="px-3 py-2.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-700 dark:text-neutral-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 cursor-pointer"
        >
          <option value="all">All Checkouts</option>
          <option value="contacted">Contacted Seller</option>
          <option value="not_contacted">No Contact Yet</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="data-table-wrapper">
          <div className="py-20 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No checkout activity found</p>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Buyer</th>
                  <th>Shop</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Contact Activity</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(receipt => (
                  <React.Fragment key={receipt.id}>
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="cursor-pointer"
                      onClick={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                    >
                      <td>
                        <span className="font-bold text-sky-600 font-mono text-xs bg-sky-50 px-2 py-1 rounded-lg">
                          #{receipt.id}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {(receipt.customer?.full_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white leading-tight">{receipt.customer?.full_name || 'Unknown'}</p>
                            {receipt.customer?.phone && <p className="text-xs text-slate-400">{receipt.customer.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-neutral-200">
                          <Store className="w-3.5 h-3.5 text-slate-400" />
                          {receipt.seller?.shop_name || 'Unknown Shop'}
                        </div>
                      </td>
                      <td>
                        <span className="text-slate-600 dark:text-neutral-200 font-medium">
                          {receipt.items?.length || 0} item{receipt.items?.length === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Ksh {Math.round(receipt.total_amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <ContactBadge receipt={receipt} />
                      </td>
                      <td>
                        <span className="text-slate-400 text-xs">
                          {new Date(receipt.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </td>
                    </motion.tr>
                    {expandedId === receipt.id && (
                      <tr>
                        <td colSpan={7} className="bg-gray-50/70 px-6 py-4">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Items in this checkout</p>
                          <div className="space-y-1.5">
                            {(receipt.items || []).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-slate-700 dark:text-neutral-200">{item.title} <span className="text-slate-400">× {item.quantity}</span></span>
                                <span className="font-semibold text-slate-900 dark:text-white">Ksh {Math.round((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                          {receipt.last_contacted_at && (
                            <p className="text-xs text-slate-400 mt-3">
                              Last contacted seller: {new Date(receipt.last_contacted_at).toLocaleString('en-GB')}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-slate-100 dark:border-neutral-800 bg-gray-50/50 text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600 dark:text-neutral-200">{filtered.length}</span> of <span className="font-semibold text-slate-600 dark:text-neutral-200">{receipts.length}</span> checkouts
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
