"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader, ArrowLeft, MessageSquare, CheckCircle, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { useAuthStore } from '@/store/useAuth';

const SupportManagementPage = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const { user } = useAuthStore();
  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadTickets();
  }, [filter]);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/support/tickets`).catch(() => null);
      if (res?.data) {
        let data = Array.isArray(res.data) ? res.data : [];
        if (filter === 'open') data = data.filter((t: any) => t.status !== 'resolved' && t.status !== 'closed');
        if (filter === 'resolved') data = data.filter((t: any) => t.status === 'resolved' || t.status === 'closed');
        setTickets(data);
      }
    } catch (error) {
      console.error('Error loading support tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveTicket = async (ticketId: number) => {
    try {
      await api.patch(`/support/tickets/${ticketId}`, { status: 'resolved' }).catch(() => null);
      loadTickets();
    } catch (error) {
      console.error('Error resolving ticket:', error);
    }
  };

  const filteredTickets = tickets.filter((t) =>
    t.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout title="Support Tickets" navItems={navItems} userRole="admin">
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
        </div>
      </DashboardLayout>
    );
  }

  const openCount = tickets.filter((t) => t.status !== 'resolved').length;
  const resolvedCount = tickets.filter((t) => t.status === 'resolved').length;

  return (
    <DashboardLayout title="Support Tickets" navItems={navItems} userRole="admin">
      <div className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <MessageSquare className="w-10 h-10 text-[#6cd4ff] mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{tickets.length}</p>
            <p className="text-sm text-slate-400 mt-1">Total Tickets</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <AlertCircle className="w-10 h-10 text-yellow-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{openCount}</p>
            <p className="text-sm text-slate-400 mt-1">Open Tickets</p>
          </div>
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <CheckCircle className="w-10 h-10 text-green-500 mb-4" />
            <p className="text-3xl font-black text-slate-900 dark:text-white">{resolvedCount}</p>
            <p className="text-sm text-slate-400 mt-1">Resolved</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {['all', 'open', 'resolved'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === f
                  ? 'bg-[#5bc0e8] text-white'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-200 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Tickets Table */}
        <div className="border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Title</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">User</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Date</th>
                <th className="px-6 py-4 text-left font-bold text-slate-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No tickets found
                  </td>
                </tr>
              ) : (
                filteredTickets.map((ticket, idx) => (
                  <tr key={idx} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">{ticket.title}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-neutral-200 text-sm">{ticket.user_email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        ticket.status === 'resolved'
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-neutral-200 text-sm">
                      {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      {ticket.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolveTicket(ticket.id)}
                          className="px-3 py-1 bg-[#02CCFE] hover:bg-[#02CCFE] text-white rounded-lg text-sm font-bold transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SupportManagementPage;
