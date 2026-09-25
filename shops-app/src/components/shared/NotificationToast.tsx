"use client";

import React, { useEffect, useState } from 'react';
import { Bell, X, CheckCircle, AlertCircle, Info, MessageSquare } from 'lucide-react';
import { useRealtimeStore } from '../../store/useRealtime';

interface Toast {
    id: string;
    type: string;
    title: string;
    message: string;
    icon: React.ReactNode;
    bgColor: string;
}

export function NotificationToast() {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const lastEvent = useRealtimeStore((s) => s.lastEvent);

    useEffect(() => {
        if (!lastEvent) return;

        const id = `${lastEvent.type}-${Date.now()}`;
        let icon = <Info className="w-5 h-5" />;
        let bgColor = 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
        let title = 'Notification';
        let message = '';

        const payload = lastEvent.payload as Record<string, unknown>;

        switch (lastEvent.type) {
            case 'new_message':
                icon = <MessageSquare className="w-5 h-5" />;
                bgColor = 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
                title = 'New Message';
                message = `${payload.from_name || 'Someone'} sent you a message`;
                break;
            case 'order_status':
                icon = <CheckCircle className="w-5 h-5" />;
                bgColor = 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800';
                title = 'Order Update';
                message = payload.message || 'Your order has been updated';
                break;
            case 'new_review':
                icon = <CheckCircle className="w-5 h-5" />;
                bgColor = 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800';
                title = 'New Review';
                message = `${payload.reviewer_name || 'Someone'} left you a review`;
                break;
            case 'new_follow':
                icon = <CheckCircle className="w-5 h-5" />;
                bgColor = 'bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800';
                title = 'New Follower';
                message = `${payload.follower_name || 'Someone'} started following you`;
                break;
            case 'error':
                icon = <AlertCircle className="w-5 h-5" />;
                bgColor = 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
                title = 'Error';
                message = payload.message || 'An error occurred';
                break;
            default:
                title = lastEvent.type.replace(/_/g, ' ').toUpperCase();
                message = payload.message || JSON.stringify(payload).slice(0, 100);
        }

        const newToast: Toast = { id, type: lastEvent.type, title, message, icon, bgColor };
        setToasts((prev) => [newToast, ...prev]);

        const timer = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);

        return () => clearTimeout(timer);
    }, [lastEvent]);

    return (
        <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm pointer-events-none">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border pointer-events-auto animate-in fade-in slide-in-from-top-2 ${toast.bgColor}`}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {toast.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">
                            {toast.title}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                            {toast.message}
                        </p>
                    </div>
                    <button
                        onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}
