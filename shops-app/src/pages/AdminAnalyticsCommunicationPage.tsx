"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Users, Clock, TrendingUp, RefreshCw, Calendar, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';
import { analyticsService } from '@/services/analytics';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { AnalyticsTabs } from '@/components/analytics/AnalyticsTabs';

interface CommunicationOverview {
  active_conversations: number;
  new_conversations: number;
  messages_total: number;
  messages_per_hour: number;
  unanswered_conversations: number;
  avg_response_seconds: number;
  avg_first_response_seconds: number;
  conversation_to_order_rate: number;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default function CommunicationAnalytics() {
  const [overview, setOverview] = useState<CommunicationOverview | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await analyticsService.getCommunicationOverview(days);
      setOverview(res.data || null);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch communication overview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  return (
    <DashboardLayout title="Realtime Analytics" navItems={navItems} userRole="admin">
    <AnalyticsTabs />
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900/40 dark:bg-black">
      <div className="sticky top-0 z-30 bg-white dark:bg-neutral-950 border-b border-slate-200 dark:border-neutral-800">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Communication</h1>
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
        {/* Controls */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-600 dark:text-neutral-300" />
            <label className="text-sm font-semibold text-slate-900 dark:text-white">Period:</label>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-sm font-semibold text-slate-900 dark:text-white"
            >
              <option value={1}>Today (24h)</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          {lastRefresh && (
            <span className="text-xs text-slate-400 dark:text-neutral-400 ml-auto">
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Stat cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Active Conversations</p>
              <p className="text-3xl font-black text-blue-600 mt-2">{overview.active_conversations.toLocaleString()}</p>
              <p className="text-[11px] text-slate-400 dark:text-neutral-400 mt-1">last 24h</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">New Conversations</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{overview.new_conversations.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Messages</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{overview.messages_total.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Messages / Hour</p>
              <p className="text-3xl font-black text-slate-900 dark:text-white mt-2">{overview.messages_per_hour}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Unanswered</p>
              <p className="text-3xl font-black text-red-600 mt-2">{overview.unanswered_conversations.toLocaleString()}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Avg First Response</p>
              <p className="text-3xl font-black text-orange-600 mt-2">{formatDuration(overview.avg_first_response_seconds)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Avg Response Time</p>
              <p className="text-3xl font-black text-orange-600 mt-2">{formatDuration(overview.avg_response_seconds)}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-slate-200 dark:border-neutral-800">
              <p className="text-xs text-slate-400 dark:text-neutral-400 font-semibold">Chat → Order Rate</p>
              <p className="text-3xl font-black text-green-600 mt-2">{overview.conversation_to_order_rate}%</p>
            </div>
          </div>
        )}

        {!overview && !loading && (
          <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 p-8 text-center text-sm text-slate-500 dark:text-neutral-400">
            No conversation activity recorded for this timeframe yet.
          </div>
        )}

        {/* Unanswered callout */}
        {overview && overview.unanswered_conversations > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              <div>
                <h2 className="text-sm font-bold text-red-900 dark:text-red-300">
                  {overview.unanswered_conversations} conversation{overview.unanswered_conversations !== 1 ? 's' : ''} waiting on a seller reply
                </h2>
                <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                  Sellers have unread buyer messages in these threads.
                </p>
              </div>
            </div>
            <Link
              href="/admin-messages?filter=unread"
              className="flex-shrink-0 flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors"
            >
              View unanswered <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Live conversations link-out */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-75"></span>
              <Users className="w-6 h-6 text-emerald-600 relative" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Live Conversations</h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                Browse every buyer-seller thread, moderate, flag or suspend.
              </p>
            </div>
          </div>
          <Link
            href="/admin-messages"
            className="flex-shrink-0 flex items-center gap-1.5 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs px-4 py-2 rounded-lg transition-colors"
          >
            Open <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* How this differs from the Overview page's "Chats" metric */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 p-6">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-5 h-5 text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">About these numbers</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-neutral-400 leading-relaxed">
            This page reads directly from the real buyer-seller messaging system (actual
            sent messages), unlike the Overview page's "Chats" metric, which only counts
            a buyer clicking "Contact Seller" — an intent signal, not a message count.
          </p>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
