"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, X, Check, Archive, Trash2, Settings, ShoppingBag,
  CreditCard, Truck, AlertCircle, Gift, Info
} from 'lucide-react';
import { useNotifications, Notification } from '@/store/useNotifications';
import Link from 'next/link';

const NotificationIcon = ({ type }: { type: Notification['type'] }) => {
  const icons = {
    order: ShoppingBag,
    payment: CreditCard,
    delivery: Truck,
    issue: AlertCircle,
    promotion: Gift,
    system: Info,
  };

  const Icon = icons[type];
  const colors = {
    order: 'text-[#5bc0e8]',
    payment: 'text-green-600',
    delivery: 'text-purple-600',
    issue: 'text-red-600',
    promotion: 'text-yellow-600',
    system: 'text-gray-600',
  };

  return <Icon size={20} className={colors[type]} />;
};

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const { notifications, unreadCount, markAsRead, archiveNotification, deleteNotification, markAllAsRead } =
    useNotifications();

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') {
      return n.status === 'unread';
    }
    return n.status !== 'archived';
  });

  const handleNotificationClick = (notification: Notification) => {
    if (notification.status === 'unread') {
      markAsRead(notification.id);
    }
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <>
      {/* Bell Icon */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors"
      >
        <Bell size={24} className="text-gray-700 dark:text-gray-300" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 bg-red-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.div>
        )}
      </motion.button>

      {/* Notification Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-30"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-20 right-0 z-40 w-96 bg-white dark:bg-neutral-950 rounded-xl shadow-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">
                    Notifications
                  </h2>
                  {unreadCount > 0 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {unreadCount} unread
                    </p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg"
                >
                  <X size={20} />
                </motion.button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
                {(['all', 'unread'] as const).map((tab) => (
                  <motion.button
                    key={tab}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setFilter(tab)}
                    className={`px-3 py-1 rounded-full text-sm font-bold transition-all ${
                      filter === tab
                        ? 'bg-[#5bc0e8] text-white'
                        : 'bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-white'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </motion.button>
                ))}
              </div>

              {/* Notifications List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredNotifications.length > 0 ? (
                  <div className="space-y-2 p-4">
                    {filteredNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-4 rounded-lg cursor-pointer transition-all group ${
                          notification.status === 'unread'
                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                            : 'bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800'
                        } hover:shadow-md`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            <NotificationIcon type={notification.type} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-2">
                              {notification.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                              {new Date(notification.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>

                          {notification.status === 'unread' && (
                            <div className="w-2 h-2 bg-[#5bc0e8] rounded-full flex-shrink-0 mt-2" />
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          {notification.status === 'unread' && (
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded transition-colors"
                              title="Mark as read"
                            >
                              <Check size={16} className="text-green-600" />
                            </motion.button>
                          )}

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveNotification(notification.id);
                            }}
                            className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Archive"
                          >
                            <Archive size={16} className="text-gray-600" />
                          </motion.button>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            className="p-1 hover:bg-white dark:hover:bg-neutral-800 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </motion.button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Bell size={32} className="mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              {filteredNotifications.length > 0 && (
                <div className="border-t border-gray-200 dark:border-neutral-800 p-4 flex gap-2">
                  {unreadCount > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      onClick={markAllAsRead}
                      className="flex-1 bg-[#5bc0e8] hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-all"
                    >
                      <Check size={16} className="inline mr-2" />
                      Mark all as read
                    </motion.button>
                  )}

                  <Link
                    href="/notifications/preferences"
                    className="flex-1 bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 text-gray-900 dark:text-white font-bold py-2 px-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Settings size={16} />
                    Settings
                  </Link>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
