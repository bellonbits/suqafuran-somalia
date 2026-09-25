"use client";

import React, { useState } from 'react';
import { ArrowLeft, Mail, Lock, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { authService } from '@/services/auth';

type Step = 'email' | 'code' | 'password' | 'success';

export default function ResetPasswordPage() {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    React.useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await authService.requestPasswordReset(email);
            setCooldown(response.cooldown_seconds || 60);
            setStep('code');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to send reset code');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await authService.verifyPasswordResetCode(email, code);
            setStep('password');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Invalid or expired code');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await authService.resetPassword(email, code, password);
            setStep('success');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (cooldown > 0) return;
        setError('');
        setLoading(true);

        try {
            const response = await authService.requestPasswordReset(email);
            setCooldown(response.cooldown_seconds || 60);
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to resend code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-neutral-950 dark:to-black flex items-center justify-center p-4">
            <div className="w-full max-w-xl">
                {/* Header */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-primary dark:text-sky-400 hover:text-primary-dark mb-8">
                    <ArrowLeft className="h-4 w-4" />
                    Back to home
                </Link>

                <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-gray-100 dark:border-neutral-800 shadow-2xl p-10 space-y-7">
                    {step !== 'success' && (
                        <>
                            <div>
                                <h1 className="text-3xl font-black text-gray-900 dark:text-neutral-50">Reset Password</h1>
                                <p className="text-base text-gray-600 dark:text-neutral-300 mt-1.5">
                                    {step === 'email' && "Enter your email address to receive a reset code"}
                                    {step === 'code' && "Enter the code we sent to your email"}
                                    {step === 'password' && "Create a new password for your account"}
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs font-bold p-3 rounded-2xl border border-red-100 dark:border-red-900/30">
                                    {error}
                                </div>
                            )}
                        </>
                    )}

                    {step === 'email' && (
                        <form onSubmit={handleRequestCode} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-600 dark:text-neutral-300">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="Enter your email..."
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-4 py-3.5 text-sm font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-premium w-full bg-primary text-white py-3.5 text-base shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:opacity-50 mt-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                ) : (
                                    'Send Reset Code'
                                )}
                            </button>
                        </form>
                    )}

                    {step === 'code' && (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-600 dark:text-neutral-300">Verification Code</label>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">
                                    We sent a code to {email}
                                </p>
                                <input
                                    type="text"
                                    required
                                    inputMode="numeric"
                                    placeholder="6-digit code"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    maxLength={6}
                                    className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black px-4 py-3 text-lg font-bold tracking-[0.25em] text-center outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-neutral-400">
                                    Didn't receive the code?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={cooldown > 0}
                                    className="text-xs font-bold text-primary dark:text-sky-400 hover:underline disabled:text-gray-400 disabled:dark:text-neutral-300 disabled:cursor-not-allowed"
                                >
                                    {cooldown > 0 ? `Resend in ${cooldown}s` : '🔄 Resend'}
                                </button>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-premium w-full bg-primary text-white py-3.5 text-base shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:opacity-50 mt-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                ) : (
                                    'Verify Code'
                                )}
                            </button>
                        </form>
                    )}

                    {step === 'password' && (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-600 dark:text-neutral-300">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        placeholder="At least 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-16 py-3.5 text-sm font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(s => !s)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 hover:text-primary dark:hover:text-sky-400"
                                    >
                                        {showPassword ? 'HIDE' : 'SHOW'}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-gray-600 dark:text-neutral-300">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        required
                                        minLength={8}
                                        placeholder="Confirm your password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-16 py-3.5 text-sm font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(s => !s)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400 hover:text-primary dark:hover:text-sky-400"
                                    >
                                        {showConfirm ? 'HIDE' : 'SHOW'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-premium w-full bg-primary text-white py-3.5 text-base shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:opacity-50 mt-2"
                            >
                                {loading ? (
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                ) : (
                                    'Reset Password'
                                )}
                            </button>
                        </form>
                    )}

                    {step === 'success' && (
                        <div className="space-y-6 text-center py-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-950/30 rounded-full flex items-center justify-center">
                                <span className="text-3xl">✅</span>
                            </div>

                            <div>
                                <h2 className="text-xl font-black text-gray-900 dark:text-neutral-50">Password Reset</h2>
                                <p className="text-sm text-gray-600 dark:text-neutral-300 mt-2">
                                    Your password has been successfully reset. You can now sign in with your new password.
                                </p>
                            </div>

                            <Link href="/" className="btn-premium w-full bg-primary text-white py-3.5 text-base shadow-lg shadow-primary/20 hover:bg-primary-dark">
                                Sign In Now
                            </Link>
                        </div>
                    )}

                    {step !== 'success' && (
                        <p className="text-[10px] text-gray-400 dark:text-neutral-400 text-center">
                            <Link href="/" className="text-primary dark:text-sky-400 hover:underline font-bold">
                                Back to sign in
                            </Link>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
