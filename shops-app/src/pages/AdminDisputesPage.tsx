"use client";

import React, { useState, useEffect } from 'react';
import { Loader, AlertTriangle, CheckCircle, Clock, Search, X, MessageSquare, ShieldAlert } from 'lucide-react';
import api from '@/services/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';

interface ListingReport {
  id: number;
  listing_id: number;
  listing_title: string | null;
  reason: string;
  description: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
  reporter: { id: number; name: string } | null;
  listing_owner: { id: number; name: string } | null;
}

interface ThreadMessage {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
}

function ConversationModal({ report, onClose }: { report: ListingReport; onClose: () => void }) {
  const [messages, setMessages] = useState<ThreadMessage[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!report.reporter || !report.listing_owner) {
      setError('Missing reporter or listing owner on this report -- cannot look up a conversation.');
      return;
    }
    const reporterId = report.reporter.id;
    const ownerId = report.listing_owner.id;

    (async () => {
      try {
        // Resolve which conversation this report is about -- buyer/seller
        // order relative to (reporter, listing owner) isn't known from the
        // report alone, so try both directions.
        let match = (await api.get('/admin/conversations', {
          params: { buyer_id: reporterId, seller_id: ownerId, listing_id: report.listing_id, limit: 1 },
        })).data?.conversations?.[0];

        if (!match) {
          match = (await api.get('/admin/conversations', {
            params: { buyer_id: ownerId, seller_id: reporterId, listing_id: report.listing_id, limit: 1 },
          })).data?.conversations?.[0];
        }

        if (!match) {
          setError('No conversation found between these two users for this listing.');
          return;
        }

        const detail = await api.get(`/admin/conversations/${match.id}`);
        setMessages(detail.data.messages);
      } catch {
        setError('Could not load this conversation.');
      }
    })();
  }, [report]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[80vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Conversation
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {report.reporter?.name || 'Reporter'} &harr; {report.listing_owner?.name || 'Listing owner'} &middot; re: {report.listing_title || `listing #${report.listing_id}`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && messages === null && (
            <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-[#6cd4ff]" /></div>
          )}
          {messages?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No messages between these two users for this listing.</p>
          )}
          {messages?.map((m) => (
            <div key={m.id} className={`max-w-[80%] ${m.sender_id === report.reporter?.id ? 'mr-auto' : 'ml-auto'}`}>
              <div className={`rounded-2xl px-4 py-2 text-sm ${
                m.sender_id === report.reporter?.id
                  ? 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white'
                  : 'bg-[#e0f7ff] dark:bg-sky-950/40 text-slate-900 dark:text-white'
              }`}>
                {m.content}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(m.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-neutral-800 text-[11px] text-slate-400 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5" />
          This view is logged: recorded against your admin account and report #{report.id}.
        </div>
      </div>
    </div>
  );
}

const DisputesPage = () => {
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeReport, setActiveReport] = useState<ListingReport | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/reports/listings', { params: { limit: 200 } });
      setReports(response.data?.reports || []);
    } catch (error) {
      console.error('Error loading listing reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const setStatus = async (report: ListingReport, status: 'resolved' | 'dismissed') => {
    setUpdatingId(report.id);
    try {
      await api.patch(`/admin/reports/listings/${report.id}`, { status });
      setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, status } : r)));
    } catch (error) {
      console.error('Error updating report status:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredReports = reports.filter(r =>
    r.reporter?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.listing_owner?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.listing_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    resolved: reports.filter(r => r.status === 'resolved').length,
    dismissed: reports.filter(r => r.status === 'dismissed').length,
  };

  if (loading) {
    return (
      <DashboardLayout title="Disputes & Reports" navItems={navItems} userRole="admin">
        <div className="flex items-center justify-center h-96">
          <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Disputes & Reports" navItems={navItems} userRole="admin">
      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Total Reports</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.total}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-slate-400" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Pending</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.pending}</p>
              </div>
              <Clock className="w-10 h-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Resolved</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.resolved}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 font-semibold">Dismissed</p>
                <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.dismissed}</p>
              </div>
              <AlertTriangle className="w-10 h-10 text-red-500" />
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
                placeholder="Search by reporter, listing owner, or listing..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">ID</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Reporter</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Listing Owner</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Listing</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Reason</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                      No reports found
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">#{report.id}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{report.reporter?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{report.listing_owner?.name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200 max-w-[160px] truncate">{report.listing_title || `#${report.listing_id}`}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{report.reason}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          report.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          report.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700' :
                          'bg-rose-50 dark:bg-rose-950/30 text-red-700'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">
                        {new Date(report.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveReport(report)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e0f7ff] text-blue-700 hover:bg-[#c9f0ff]"
                          >
                            View Chat
                          </button>
                          {report.status === 'pending' && (
                            <>
                              <button
                                disabled={updatingId === report.id}
                                onClick={() => setStatus(report, 'resolved')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-green-700 hover:bg-emerald-100 disabled:opacity-50"
                              >
                                Resolve
                              </button>
                              <button
                                disabled={updatingId === report.id}
                                onClick={() => setStatus(report, 'dismissed')}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-red-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {activeReport && (
        <ConversationModal report={activeReport} onClose={() => setActiveReport(null)} />
      )}
    </DashboardLayout>
  );
};

export default DisputesPage;
