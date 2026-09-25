"use client";

import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User as UserIcon, Phone, Loader2, RotateCw } from 'lucide-react';
import { useAuthModal } from '../../store/useAuthModal';
import { useAuthStore } from '../../store/useAuth';
import { authService } from '../../services/auth';
import { identifyUser, trackEvent } from '../../lib/analytics';

type Method = 'email' | 'phone';
type Step = 'form' | 'otp';

const COUNTRY_CODES = [
    { code: '+252', label: 'Somalia +252', flag: '🇸🇴' },
    { code: '+254', label: 'Kenya +254', flag: '🇰🇪' },
    { code: '+251', label: 'Ethiopia +251', flag: '🇪🇹' },
    { code: '+253', label: 'Djibouti +253', flag: '🇩🇯' },
];

export const AuthModal: React.FC = () => {
    const { isOpen, mode, open, close } = useAuthModal();
    const { login: storeLogin } = useAuthStore();

    const [method, setMethod] = useState<Method>('email');
    const [step, setStep] = useState<Step>('form');

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [countryCode, setCountryCode] = useState('+252');
    const [localPhone, setLocalPhone] = useState('');
    const [otp, setOtp] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);

    const phone = `${countryCode}${localPhone.replace(/\D/g, '')}`;

    // Reset transient state whenever the modal opens or the user switches mode/method
    useEffect(() => {
        if (isOpen) {
            setStep('form');
            setOtp('');
            setError('');
            setPassword('');
        }
    }, [isOpen, mode, method]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    if (!isOpen) return null;

    const finishLogin = async (token: string) => {
        const user = await authService.getMe(token);
        storeLogin(user, token);
        identifyUser(user);
        trackEvent(mode === 'signup' ? 'Signup Completed' : 'Login', { method });
        close();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        setLoading(true);
        try {
            if (mode === 'signin' && method === 'email') {
                const { access_token } = await authService.loginWithPassword(email, password);
                await finishLogin(access_token);
            } else if (mode === 'signin' && method === 'phone') {
                if (step === 'form') {
                    const ack = await authService.requestPhoneOtp(phone);
                    setCooldown(ack.cooldown_seconds || 60);
                    setStep('otp');
                } else {
                    const { access_token } = await authService.verifyPhoneOtp(phone, otp);
                    await finishLogin(access_token);
                }
            } else if (mode === 'signup' && method === 'email') {
                if (step === 'form') {
                    const ack = await authService.signupEmail({ full_name: fullName, email, password });
                    setCooldown(ack.cooldown_seconds || 60);
                    setStep('otp');
                } else {
                    const { access_token } = await authService.verifyEmailOtp(email, otp);
                    await finishLogin(access_token);
                }
            } else if (mode === 'signup' && method === 'phone') {
                if (step === 'form') {
                    const ack = await authService.signupPhone({ full_name: fullName, phone });
                    setCooldown(ack.cooldown_seconds || 60);
                    setStep('otp');
                } else {
                    const { access_token } = await authService.verifyPhoneOtp(phone, otp);
                    await finishLogin(access_token);
                }
            }
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setError('');
        try {
            const ack = method === 'email'
                ? await authService.requestEmailOtp(email)
                : await authService.requestPhoneOtp(phone);
            setCooldown(ack.cooldown_seconds || 60);
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Failed to resend code');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60" onClick={close} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 }}>
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full mx-4 max-w-md rounded-3xl bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto animate-scale-in"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-gray-900 dark:text-neutral-50 font-poppins">Sign in or Sign up</h2>
                    <button onClick={close} className="text-gray-400 hover:text-gray-700 dark:hover:text-neutral-100 cursor-pointer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex border border-gray-200 dark:border-neutral-800 rounded-full p-0.5 bg-slate-100 dark:bg-black">
                    {(['signin', 'signup'] as const).map(m => (
                        <button
                            key={m}
                            onClick={() => open(m)}
                            className={`flex-1 py-2 rounded-full text-xs font-black transition-all cursor-pointer ${mode === m ? 'bg-slate-900 text-white dark:bg-neutral-200 dark:text-neutral-100 shadow' : 'text-gray-500 dark:text-neutral-300'}`}
                        >
                            {m === 'signin' ? 'Sign In' : 'Sign Up'}
                        </button>
                    ))}
                </div>

                {step === 'form' && (
                    <div className="flex gap-2">
                        {(['email', 'phone'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMethod(m)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${method === m ? 'border-primary bg-primary/5 text-primary dark:text-sky-400 dark:border-sky-400' : 'border-gray-200 text-gray-500 dark:border-neutral-800 dark:text-neutral-300'}`}
                            >
                                {m === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                                {m === 'email' ? 'Email' : 'Phone'}
                            </button>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-2xl border border-red-100 dark:bg-red-950/20 dark:border-red-900/30">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5">
                    {step === 'otp' ? (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 dark:text-neutral-300 block mb-1">
                                    Verification Code
                                </label>
                                <p className="text-[10px] text-gray-500 dark:text-neutral-400 mb-2">
                                    We sent a code to {method === 'email' ? email : phone}
                                </p>
                            </div>
                            <input
                                type="text"
                                required
                                autoFocus
                                inputMode="numeric"
                                placeholder="6-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                maxLength={6}
                                className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black px-4 py-3 text-lg font-bold tracking-[0.25em] text-center outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                            />
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                                    Didn't receive the code?
                                </span>
                                <button
                                    type="button"
                                    onClick={handleResend}
                                    disabled={cooldown > 0}
                                    className="flex items-center gap-1 text-[11px] font-bold text-primary dark:text-sky-400 hover:underline disabled:text-gray-400 disabled:dark:text-neutral-300 disabled:cursor-not-allowed"
                                >
                                    {cooldown > 0 ? (
                                        `Resend in ${cooldown}s`
                                    ) : (
                                        <>
                                            <RotateCw className="h-3 w-3" />
                                            Resend code
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {mode === 'signup' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 dark:text-neutral-300">Full Name</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Enter full name..."
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-4 py-3 text-xs font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                        />
                                    </div>
                                </div>
                            )}

                            {method === 'email' ? (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 dark:text-neutral-300">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="Enter email..."
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-4 py-3 text-xs font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 dark:text-neutral-300">Mobile Number</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={countryCode}
                                            onChange={(e) => setCountryCode(e.target.value)}
                                            className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black px-2 text-xs font-bold outline-none focus:border-primary dark:text-neutral-50"
                                        >
                                            {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                                        </select>
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <input
                                                type="tel"
                                                required
                                                placeholder="Phone number..."
                                                value={localPhone}
                                                onChange={(e) => setLocalPhone(e.target.value)}
                                                className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-4 py-3 text-xs font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mode === 'signin' && method === 'email' && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-600 dark:text-neutral-300">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => window.location.href = '/reset-password'}
                                            className="text-[10px] font-bold text-primary dark:text-sky-400 hover:underline"
                                        >
                                            Forgot?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            placeholder="Enter password..."
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-16 py-3 text-xs font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(s => !s)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 hover:text-primary dark:hover:text-sky-400"
                                        >
                                            {showPassword ? 'HIDE' : 'SHOW'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {mode === 'signup' && method === 'email' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-600 dark:text-neutral-300">Password</label>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            required
                                            minLength={8}
                                            placeholder="At least 8 characters"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black pl-11 pr-16 py-3 text-xs font-semibold outline-none focus:border-primary focus:bg-white dark:text-neutral-50"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(s => !s)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 hover:text-primary dark:hover:text-sky-400"
                                        >
                                            {showPassword ? 'HIDE' : 'SHOW'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-premium w-full bg-primary text-white py-3 shadow-lg shadow-primary/20 hover:bg-primary-dark disabled:opacity-50 mt-2"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : step === 'otp' ? (
                            <span>Verify &amp; Continue</span>
                        ) : mode === 'signin' && method === 'phone' ? (
                            <span>Send Code</span>
                        ) : mode === 'signup' ? (
                            <span>Create Account</span>
                        ) : (
                            <span>Sign In</span>
                        )}
                    </button>
                </form>

                <p className="text-[10px] text-gray-400 dark:text-neutral-400 text-center leading-relaxed">
                    By continuing you agree to receive a verification code by {method === 'email' ? 'email' : 'SMS'}.
                </p>
            </div>
        </div>
    );
};
