"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Loader2, Smartphone, Laptop, KeyRound, AlertTriangle, MailWarning, ShieldAlert } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/useAuth';

interface SecurityAlert {
    id: number;
    type: string;
    subject: string;
    status: string;
    at: string;
}

interface DeviceSession {
    id: number;
    first_seen_at: string;
    last_seen_at: string;
    is_banned: boolean;
    metadata: Record<string, any>;
}

const ALERT_META: Record<string, { icon: React.ElementType; label: string }> = {
    safety_password_change: { icon: KeyRound, label: 'Password changed' },
    safety_suspicious_login: { icon: AlertTriangle, label: 'New device login' },
    safety_protection: { icon: ShieldAlert, label: 'Account protection notice' },
    safety_scam_warning: { icon: MailWarning, label: 'Scam warning' },
};

export default function SecurityLogsPage() {
    const { isAuthenticated, isHydrated } = useAuthStore();
    const [alerts, setAlerts] = useState<SecurityAlert[] | null>(null);
    const [devices, setDevices] = useState<DeviceSession[] | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isHydrated) return;
        api.get('/users/me/security-log')
            .then((res) => {
                setAlerts(res.data?.alerts || []);
                setDevices(res.data?.devices || []);
            })
            .catch(() => setError('Could not load your security activity.'));
    }, [isHydrated]);

    const loading = !isHydrated || (alerts === null && !error);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-[#6cd4ff]" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
                <p className="text-gray-600 dark:text-neutral-300">Sign in to view your security activity.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black pt-20 pb-32">
            <div className="max-w-2xl mx-auto px-4 sm:px-6">
                <Link href="/account" className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white mb-6">
                    <ArrowLeft className="w-4 h-4" /> Back to Account
                </Link>

                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-2xl bg-green-50 dark:bg-green-900/20">
                        <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Security Activity</h1>
                </div>
                <p className="text-sm text-gray-500 dark:text-neutral-400 mb-8">
                    A record of security events and devices linked to your account. If you don't recognize something here, change your password right away.
                </p>

                {error && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                {/* Devices */}
                <h2 className="text-sm font-black uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">Devices</h2>
                <div className="space-y-3 mb-10">
                    {devices && devices.length === 0 && (
                        <p className="text-sm text-gray-400 dark:text-neutral-500 py-4">No device history recorded yet.</p>
                    )}
                    {devices?.map((device) => {
                        const isMobile = /mobile|android|iphone/i.test(device.metadata?.user_agent || device.metadata?.platform || '');
                        const Icon = isMobile ? Smartphone : Laptop;
                        return (
                            <div
                                key={device.id}
                                className="flex items-center gap-4 p-5 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-sm"
                            >
                                <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 shrink-0">
                                    <Icon className="w-4 h-4 text-gray-500 dark:text-neutral-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                                        {device.metadata?.platform || device.metadata?.browser || 'Device'}
                                        {device.is_banned && <span className="ml-2 text-xs font-bold text-red-600">Blocked</span>}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                                        First seen {new Date(device.first_seen_at).toLocaleDateString()} &middot; Last active {new Date(device.last_seen_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Alerts */}
                <h2 className="text-sm font-black uppercase tracking-wide text-gray-400 dark:text-neutral-500 mb-3">Security Alerts</h2>
                <div className="space-y-3">
                    {alerts && alerts.length === 0 && (
                        <p className="text-sm text-gray-400 dark:text-neutral-500 py-4">No security alerts on your account.</p>
                    )}
                    {alerts?.map((alert) => {
                        const meta = ALERT_META[alert.type] || { icon: ShieldAlert, label: alert.subject };
                        const Icon = meta.icon;
                        return (
                            <div
                                key={alert.id}
                                className="flex items-center gap-4 p-5 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-sm"
                            >
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 shrink-0">
                                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white text-sm">{meta.label}</p>
                                    <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">{new Date(alert.at).toLocaleString()}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
