"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Phone, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuth';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, mode: initialMode = 'signin' }) => {
    const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');
    const [mode, setMode] = useState<'signin' | 'signup'>(
        typeof initialMode === 'string' && (initialMode === 'signin' || initialMode === 'signup')
            ? initialMode
            : 'signin'
    );
    const [step, setStep] = useState<'method' | 'input' | 'otp'>('method');

    // Email signup fields
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Phone signup fields
    const [phone, setPhone] = useState('');
    const [phoneFullName, setPhoneFullName] = useState('');
    const [otp, setOtp] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { setUser, login } = useAuthStore();

    const resetForm = () => {
        setEmail('');
        setFullName('');
        setPassword('');
        setConfirmPassword('');
        setPhone('');
        setPhoneFullName('');
        setOtp('');
        setError('');
    };

    const handleEmailSignup = async () => {
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
            // Call signup endpoint to send OTP
            await authAPI.signup({
                email,
                full_name: fullName,
                phone: '+254712345678', // Placeholder
                password,
            });
            // OTP sent, move to verification step
            setStep('otp');
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Signup failed. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailSignin = async () => {
        setError('');
        setLoading(true);
        try {
            const response = await authAPI.login({ email, password });
            if (response.access_token) {
                // Fetch full user profile from /users/me
                try {
                    const userProfile = await authService.getCurrentUser();
                    login(userProfile, response.access_token);
                } catch (profileErr) {
                    // Fallback to response user if /users/me fails
                    if (response.user) {
                        login(response.user as any, response.access_token);
                    }
                }
                onClose();
            }
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Login failed. Please check your credentials.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneSignup = async () => {
        setError('');
        setLoading(true);
        try {
            await authService.signupPhone({ phone, full_name: phoneFullName });
            await authService.requestPhoneOTP(phone);
            setStep('otp');
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Failed to signup. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneSignin = async () => {
        setError('');
        setLoading(true);
        try {
            await authService.requestPhoneOTP(phone);
            setStep('otp');
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Failed to send OTP. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyEmailOTP = async () => {
        setError('');
        setLoading(true);
        try {
            const response = await authService.verifyOTP({ email, otp });
            if (response.access_token) {
                // Fetch full user profile from /users/me
                try {
                    const userProfile = await authService.getCurrentUser();
                    login(userProfile, response.access_token);
                } catch (profileErr) {
                    // Fallback to response user if /users/me fails
                    if (response.user) {
                        login(response.user as any, response.access_token);
                    }
                }
                onClose();
            }
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Invalid OTP. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyPhoneOTP = async () => {
        setError('');
        setLoading(true);
        try {
            const response = await authService.verifyPhoneOTP(phone, otp);
            if (response.access_token) {
                // Fetch full user profile from /users/me
                try {
                    const userProfile = await authService.getCurrentUser();
                    login(userProfile, response.access_token);
                } catch (profileErr) {
                    // Fallback to response user if /users/me fails
                    if (response.user) {
                        login(response.user as any, response.access_token);
                    }
                }
                onClose();
            }
        } catch (err: any) {
            const errorMsg = typeof err?.response?.data?.detail === 'string'
                ? err.response.data.detail
                : 'Invalid OTP. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === 'signin' ? 'signup' : 'signin');
        setStep('method');
        resetForm();
    };

    const goBack = () => {
        setStep('method');
        resetForm();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-y-auto max-h-[90vh]"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>

                        {/* Header */}
                        <div className="mb-8">
                            <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">
                                {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {step === 'method'
                                    ? 'Choose your authentication method'
                                    : authMode === 'email'
                                    ? 'Enter your email details'
                                    : 'Enter your phone details'}
                            </p>
                        </div>

                        {/* Error Message */}
                        {error && typeof error === 'string' && (
                            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                            </div>
                        )}

                        {/* Method Selection */}
                        {step === 'method' ? (
                            <>
                                <div className="space-y-3 mb-6">
                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setAuthMode('email')}
                                        className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                            authMode === 'email'
                                                ? 'border-sky-600 bg-[#e0f7ff] dark:bg-sky-900/20'
                                                : 'border-gray-200 dark:border-neutral-800 hover:border-sky-600'
                                        }`}
                                    >
                                        <Mail className={`w-5 h-5 ${authMode === 'email' ? 'text-[#6cd4ff]' : 'text-gray-600'}`} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 dark:text-white">Email</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {mode === 'signup' ? 'Email, name & password' : 'Email & password'}
                                            </p>
                                        </div>
                                    </motion.button>

                                    <motion.button
                                        whileHover={{ scale: 1.02 }}
                                        onClick={() => setAuthMode('phone')}
                                        className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${
                                            authMode === 'phone'
                                                ? 'border-sky-600 bg-[#e0f7ff] dark:bg-sky-900/20'
                                                : 'border-gray-200 dark:border-neutral-800 hover:border-sky-600'
                                        }`}
                                    >
                                        <Phone className={`w-5 h-5 ${authMode === 'phone' ? 'text-[#6cd4ff]' : 'text-gray-600'}`} />
                                        <div className="text-left">
                                            <p className="font-bold text-gray-900 dark:text-white">Phone</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">
                                                {mode === 'signup' ? 'Phone & name + OTP' : 'Phone + OTP'}
                                            </p>
                                        </div>
                                    </motion.button>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setStep('input')}
                                    className="w-full bg-[#5bc0e8] hover:bg-sky-700 text-white font-bold py-3 px-6 rounded-full transition-all"
                                >
                                    Continue with {authMode === 'email' ? 'Email' : 'Phone'}
                                </motion.button>

                                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                                    {mode === 'signin'
                                        ? "Don't have an account? "
                                        : 'Already have an account? '}
                                    <button
                                        onClick={toggleMode}
                                        className="text-[#6cd4ff] hover:text-sky-700 font-bold"
                                    >
                                        {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                                    </button>
                                </p>
                            </>
                        ) : authMode === 'email' && step === 'input' ? (
                            <>
                                {/* Email Signup/Signin */}
                                <input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 mb-4 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                />

                                {mode === 'signup' && (
                                    <>
                                        <input
                                            type="text"
                                            placeholder="Your full name"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="w-full px-4 py-3 mb-4 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                        />
                                    </>
                                )}

                                <div className="relative mb-4">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {mode === 'signup' && (
                                    <div className="relative mb-6">
                                        <input
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Confirm password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-3 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={mode === 'signup' ? handleEmailSignup : handleEmailSignin}
                                    disabled={
                                        !email ||
                                        !password ||
                                        loading ||
                                        (mode === 'signup' && (!fullName || !confirmPassword))
                                    }
                                    className="w-full bg-[#5bc0e8] hover:bg-sky-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-full transition-all mb-4"
                                >
                                    {loading ? 'Processing...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                                </motion.button>

                                <button
                                    onClick={goBack}
                                    className="w-full text-center text-[#6cd4ff] hover:text-sky-700 font-bold py-2 text-sm"
                                >
                                    Back
                                </button>
                            </>
                        ) : authMode === 'phone' && step === 'input' ? (
                            <>
                                {/* Phone Signup/Signin */}
                                <input
                                    type="tel"
                                    placeholder="+254 712 345 678"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full px-4 py-3 mb-4 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                />

                                {mode === 'signup' && (
                                    <input
                                        type="text"
                                        placeholder="Your full name"
                                        value={phoneFullName}
                                        onChange={(e) => setPhoneFullName(e.target.value)}
                                        className="w-full px-4 py-3 mb-6 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900"
                                    />
                                )}

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={mode === 'signup' ? handlePhoneSignup : handlePhoneSignin}
                                    disabled={!phone || loading || (mode === 'signup' && !phoneFullName)}
                                    className="w-full bg-[#5bc0e8] hover:bg-sky-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-full transition-all mb-4"
                                >
                                    {loading ? 'Sending OTP...' : 'Send OTP'}
                                </motion.button>

                                <button
                                    onClick={goBack}
                                    className="w-full text-center text-[#6cd4ff] hover:text-sky-700 font-bold py-2 text-sm"
                                >
                                    Back
                                </button>
                            </>
                        ) : step === 'otp' ? (
                            <>
                                {/* OTP Verification for both email and phone */}
                                <div className="text-center mb-6">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        We sent a code to {authMode === 'email' ? email : phone}
                                    </p>
                                </div>
                                <input
                                    type="text"
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.slice(0, 6).replace(/\D/g, ''))}
                                    maxLength={6}
                                    className="w-full px-4 py-3 mb-6 rounded-full border-2 border-gray-200 dark:border-neutral-800 focus:border-sky-600 dark:focus:border-sky-600 outline-none transition-colors text-gray-900 dark:text-white bg-white dark:bg-neutral-900 text-center text-2xl tracking-widest font-bold"
                                />

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={authMode === 'email' ? handleVerifyEmailOTP : handleVerifyPhoneOTP}
                                    disabled={otp.length !== 6 || loading}
                                    className="w-full bg-[#5bc0e8] hover:bg-sky-700 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-full transition-all mb-4"
                                >
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                </motion.button>

                                <button
                                    onClick={() => setStep('input')}
                                    disabled={loading}
                                    className="w-full text-[#6cd4ff] hover:text-sky-700 font-bold py-2 text-sm disabled:text-gray-400"
                                >
                                    Resend OTP
                                </button>
                            </>
                        ) : null}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
