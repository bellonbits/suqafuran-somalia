"use client";

import React, { useState, useEffect } from 'react';
import { MessageSquare, Mail, Smartphone, Clock } from 'lucide-react';
import api from '@/services/api';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [notifRes, statsRes] = await Promise.all([
          api.get('/admin/monitoring/notifications/events?limit=10'),
          api.get('/admin/monitoring/notifications/channel-stats')
        ]);
        setNotifications(notifRes.data?.events || []);
        setStats(statsRes.data || {});
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white mb-2">Alert Notifications</h1>
        <p className="text-slate-600 dark:text-neutral-200 dark:text-neutral-300">View notification logs and delivery status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Email</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.email_count || '0'}</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Sent in 24h</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">Push</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.push_count || '0'}</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Sent in 24h</p>
        </div>
        <div className="bg-white dark:bg-neutral-900 rounded-lg p-4 border border-slate-200 dark:border-neutral-800 dark:border-neutral-800">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-semibold text-slate-600 dark:text-neutral-200 dark:text-neutral-300">SMS</span>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-white dark:text-white">{stats.sms_count || '0'}</div>
          <p className="text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">Sent in 24h</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white mb-4">Recent Notifications</h2>
        <div className="space-y-3">
          {loading ? (
            <div className="text-center text-slate-400 py-8">Loading notifications...</div>
          ) : notifications.length > 0 ? (
            notifications.map((notif) => (
              <div key={notif.id} className="bg-white dark:bg-neutral-900 rounded-xl border border-slate-200 dark:border-neutral-800 dark:border-neutral-800 p-4 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-neutral-900 dark:bg-neutral-800">
                  {notif.channel === 'email' && <Mail className="w-5 h-5 text-blue-600" />}
                  {notif.channel === 'sms' && <Smartphone className="w-5 h-5 text-purple-600" />}
                  {notif.channel === 'push' && <MessageSquare className="w-5 h-5 text-green-600" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white dark:text-white">{notif.title || notif.event_type}</h3>
                  <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mt-1">{notif.message || notif.content}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                    notif.status === 'sent' || notif.status === 'delivered'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                  }`}>
                    {notif.status}
                  </span>
                  <div className="text-xs text-slate-400 dark:text-neutral-300 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-400 py-8">No notifications found</div>
          )}
        </div>
      </div>
    </div>
  );
}
