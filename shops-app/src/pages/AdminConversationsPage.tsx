"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader, Search, X, MessageCircle, MessagesSquare, Eye, CircleDot,
  Flag, Ban, CheckCheck, ExternalLink, ShieldAlert,
} from 'lucide-react';
import api from '@/services/api';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';

interface ConversationSummary {
  id: number;
  buyer: { id: number; name: string } | null;
  seller: { id: number; name: string } | null;
  listing: { id: number; title: string } | null;
  last_message_preview: string | null;
  message_count: number;
  unread_count: number;
  status: 'active' | 'closed' | 'flagged' | 'suspended';
  admin_reviewed: boolean;
  last_message_at: string;
  created_at: string;
}

interface Stats {
  total_conversations: number;
  active_conversations: number;
  unread_conversations: number;
  today_conversations: number;
  reported_conversations: number;
}

interface ConversationDetail {
  id: number;
  status: string;
  admin_reviewed: boolean;
  buyer: { id: number; name: string; email: string; phone: string | null; registered_at: string; is_active: boolean; is_suspended: boolean } | null;
  seller: { id: number; shop_name: string | null; name: string; is_verified: boolean; is_active: boolean; is_suspended: boolean } | null;
  listing: { id: number; title: string; price: number; currency: string; status: string; url: string } | null;
  messages: { id: number; sender_id: number; receiver_id: number; content: string; is_read: boolean; created_at: string }[];
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
  { key: 'flagged', label: 'Flagged' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-50 dark:bg-emerald-950/30 text-green-700',
  closed: 'bg-slate-100 dark:bg-neutral-800 text-slate-600',
  flagged: 'bg-yellow-100 text-yellow-700',
  suspended: 'bg-rose-50 dark:bg-rose-950/30 text-red-700',
};

function DetailModal({ conversationId, onClose, onUpdated }: { conversationId: number; onClose: () => void; onUpdated: (c: ConversationSummary) => void }) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(() => {
    api.get(`/admin/conversations/${conversationId}`)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Could not load this conversation.'));
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  const applyUpdate = async (payload: { status?: string; admin_reviewed?: boolean }) => {
    setActionBusy(true);
    try {
      const res = await api.patch(`/admin/conversations/${conversationId}`, payload);
      onUpdated(res.data);
      load();
    } catch {
      // no-op -- surfaced implicitly by the button staying actionable
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-neutral-800">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessagesSquare className="w-4 h-4" /> Conversation #{conversationId}
          </h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="p-5 text-sm text-red-600">{error}</p>}

        {!error && !detail && (
          <div className="flex justify-center py-12"><Loader className="w-6 h-6 animate-spin text-[#6cd4ff]" /></div>
        )}

        {detail && (
          <div className="flex-1 overflow-y-auto">
            {/* Context blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Buyer</p>
                {detail.buyer ? (
                  <div className="text-sm text-slate-700 dark:text-neutral-200 space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white">{detail.buyer.name}</p>
                    <p>ID #{detail.buyer.id}</p>
                    <p className="truncate">{detail.buyer.email}</p>
                    {detail.buyer.phone && <p>{detail.buyer.phone}</p>}
                    <p className="text-xs text-slate-400">Joined {new Date(detail.buyer.registered_at).toLocaleDateString()}</p>
                    {detail.buyer.is_suspended && <p className="text-xs font-bold text-red-600">Suspended</p>}
                  </div>
                ) : <p className="text-sm text-slate-400">Unknown</p>}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Seller</p>
                {detail.seller ? (
                  <div className="text-sm text-slate-700 dark:text-neutral-200 space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white">{detail.seller.shop_name || detail.seller.name}</p>
                    <p>ID #{detail.seller.id}</p>
                    {detail.seller.is_verified && <p className="text-xs text-blue-600 font-semibold">Verified</p>}
                    {detail.seller.is_suspended && <p className="text-xs font-bold text-red-600">Suspended</p>}
                  </div>
                ) : <p className="text-sm text-slate-400">Unknown</p>}
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Listing</p>
                {detail.listing ? (
                  <div className="text-sm text-slate-700 dark:text-neutral-200 space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{detail.listing.title}</p>
                    <p>{detail.listing.currency} {detail.listing.price?.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 capitalize">{detail.listing.status}</p>
                    <a href={detail.listing.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 font-semibold flex items-center gap-1 hover:underline">
                      View listing <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : <p className="text-sm text-slate-400">No listing tied to this thread</p>}
              </div>
            </div>

            {/* Thread */}
            <div className="p-5 space-y-3">
              {detail.messages.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>
              )}
              {detail.messages.map((m) => {
                const fromBuyer = detail.buyer && m.sender_id === detail.buyer.id;
                return (
                  <div key={m.id} className={`max-w-[75%] ${fromBuyer ? 'mr-auto' : 'ml-auto'}`}>
                    <div className={`rounded-2xl px-4 py-2 text-sm ${
                      fromBuyer
                        ? 'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-white'
                        : 'bg-[#e0f7ff] dark:bg-sky-950/40 text-slate-900 dark:text-white'
                    }`}>
                      {m.content}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 px-1">
                      {fromBuyer ? 'Buyer' : 'Seller'} &middot; {new Date(m.created_at).toLocaleString()} {m.is_read && '· Read'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {detail && (
          <div className="px-5 py-3 border-t border-slate-200 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5" /> This view is logged against your admin account.
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={actionBusy}
                onClick={() => applyUpdate({ admin_reviewed: !detail.admin_reviewed })}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 disabled:opacity-50 flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> {detail.admin_reviewed ? 'Reviewed' : 'Mark Reviewed'}
              </button>
              <button
                disabled={actionBusy}
                onClick={() => applyUpdate({ status: detail.status === 'flagged' ? 'active' : 'flagged' })}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50 flex items-center gap-1"
              >
                <Flag className="w-3.5 h-3.5" /> {detail.status === 'flagged' ? 'Unflag' : 'Flag'}
              </button>
              <button
                disabled={actionBusy}
                onClick={() => applyUpdate({ status: detail.status === 'suspended' ? 'active' : 'suspended' })}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-red-700 hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> {detail.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminConversationsPage() {
  const searchParams = useSearchParams();
  const initialFilter = (FILTERS.find((f) => f.key === searchParams.get('filter'))?.key || 'all') as typeof FILTERS[number]['key'];

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<typeof FILTERS[number]['key']>(initialFilter);
  const [search, setSearch] = useState('');
  const [openConversationId, setOpenConversationId] = useState<number | null>(null);

  const navItems = ADMIN_NAV_ITEMS.map((item) => ({ ...item, icon: <item.icon className="w-5 h-5" /> }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | boolean> = { limit: 200 };
      if (activeFilter === 'unread') params.unread_only = true;
      else if (['active', 'closed', 'flagged', 'suspended'].includes(activeFilter)) params.status = activeFilter;
      else if (['today', 'week', 'month'].includes(activeFilter)) params.period = activeFilter;
      if (search) params.search = search;

      const [convRes, statsRes] = await Promise.all([
        api.get('/admin/conversations', { params }),
        api.get('/admin/conversations/stats'),
      ]);
      setConversations(convRes.data?.conversations || []);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, search]);

  useEffect(() => { load(); }, [load]);

  // Keep the list/stats live without yanking the table out from under an
  // admin who has a conversation thread open.
  useEffect(() => {
    const interval = setInterval(() => {
      if (openConversationId === null) load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load, openConversationId]);

  const patchLocal = (updated: ConversationSummary) => {
    setConversations((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  };

  return (
    <DashboardLayout title="Messages" navItems={navItems} userRole="admin">
      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Conversations', value: stats?.total_conversations, icon: MessagesSquare, color: 'text-slate-400' },
            { label: 'Active', value: stats?.active_conversations, icon: CircleDot, color: 'text-green-500' },
            { label: 'Unread', value: stats?.unread_conversations, icon: MessageCircle, color: 'text-yellow-500' },
            { label: "Today's Conversations", value: stats?.today_conversations, icon: MessagesSquare, color: 'text-blue-500' },
            { label: 'Reported', value: stats?.reported_conversations, icon: Flag, color: 'text-red-500' },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl p-5">
              <card.icon className={`w-7 h-7 mb-3 ${card.color}`} />
              <p className="text-2xl font-black text-slate-900 dark:text-white">{card.value ?? 0}</p>
              <p className="text-xs text-slate-400 mt-1">{card.label}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-neutral-800 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by buyer, seller, or listing..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-neutral-800 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-[#6cd4ff]"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                    activeFilter === f.key
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader className="w-8 h-8 animate-spin text-[#6cd4ff]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Buyer</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Seller</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Listing</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Last Message</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Messages</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Status</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Last Active</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-900 dark:text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400">No conversations found</td></tr>
                  ) : (
                    conversations.map((c) => (
                      <tr key={c.id} className="border-b border-slate-200 dark:border-neutral-800 hover:bg-slate-50 dark:bg-neutral-900/40">
                        <td className="px-6 py-4 text-sm text-slate-900 dark:text-white font-semibold">{c.buyer?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{c.seller?.name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200 max-w-[160px] truncate">{c.listing?.title || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500 dark:text-neutral-400 max-w-[220px] truncate">{c.last_message_preview || '-'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200 tabular-nums">
                          {c.message_count}
                          {c.unread_count > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#6cd4ff] text-[10px] font-bold text-white">{c.unread_count}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${STATUS_STYLES[c.status] || ''}`}>{c.status}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 dark:text-neutral-200">{new Date(c.last_message_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={() => setOpenConversationId(c.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e0f7ff] text-blue-700 hover:bg-[#c9f0ff] flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {openConversationId !== null && (
        <DetailModal
          conversationId={openConversationId}
          onClose={() => { setOpenConversationId(null); load(); }}
          onUpdated={patchLocal}
        />
      )}
    </DashboardLayout>
  );
}
