"use client";

import React, { useState, useEffect } from 'react';
import { Save, Bell, Lock, Loader } from 'lucide-react';
import api from '@/services/api';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: true,
    orderAlerts: true,
    lowStockAlerts: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await api.get('/seller/settings').catch(() => null);

      if (res?.data) {
        setSettings({
          notifications: res.data.push_notifications ?? true,
          emailNotifications: res.data.email_notifications ?? true,
          orderAlerts: res.data.order_alerts ?? true,
          lowStockAlerts: res.data.low_stock_alerts ?? true,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await api.put('/seller/settings', {
        push_notifications: settings.notifications,
        email_notifications: settings.emailNotifications,
        order_alerts: settings.orderAlerts,
        low_stock_alerts: settings.lowStockAlerts,
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-neutral-300">Manage your account and notification preferences</p>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Push Notifications</p>
              <p className="text-xs text-gray-600 dark:text-neutral-300">Receive push notifications on your device</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
              className="w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Email Notifications</p>
              <p className="text-xs text-gray-600 dark:text-neutral-300">Receive email updates about your orders</p>
            </div>
            <input
              type="checkbox"
              checked={settings.emailNotifications}
              onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              className="w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Order Alerts</p>
              <p className="text-xs text-gray-600 dark:text-neutral-300">Get notified when you receive new orders</p>
            </div>
            <input
              type="checkbox"
              checked={settings.orderAlerts}
              onChange={(e) => setSettings({...settings, orderAlerts: e.target.checked})}
              className="w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Low Stock Alerts</p>
              <p className="text-xs text-gray-600 dark:text-neutral-300">Get notified when products are running low</p>
            </div>
            <input
              type="checkbox"
              checked={settings.lowStockAlerts}
              onChange={(e) => setSettings({...settings, lowStockAlerts: e.target.checked})}
              className="w-4 h-4"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Account Security</h2>
        </div>

        <div className="space-y-4">
          <button className="w-full px-4 py-3 border border-gray-200 dark:border-neutral-800 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-900 text-left font-semibold text-gray-900 dark:text-white">
            Change Password
          </button>
          <button className="w-full px-4 py-3 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-left font-semibold text-red-600">
            Delete Account
          </button>
        </div>
      </div>

      <button
        onClick={handleSaveSettings}
        disabled={saving}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2"
      >
        {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
