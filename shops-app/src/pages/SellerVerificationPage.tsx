"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck, ShieldAlert, Shield, Clock, CheckCircle2,
  Upload, X, AlertCircle, ChevronRight, Loader, BadgeCheck, Star, TrendingUp
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/useAuth';

type VerificationStatus = 'not_started' | 'pending' | 'approved' | 'rejected';

interface VerificationData {
  status: VerificationStatus;
  submitted_at?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  phone_verified: boolean;
  email_verified: boolean;
}

interface Requirement {
  key: string;
  label: string;
  description: string;
  required: boolean;
  completed: boolean;
}

function StatusBanner({ status }: { status: VerificationStatus }) {
  const configs = {
    not_started: {
      icon: Shield,
      bg: 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800',
      iconColor: 'text-gray-400',
      title: 'Not Verified',
      description: 'Submit your documents to get the verified badge.',
    },
    pending: {
      icon: Clock,
      bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30',
      iconColor: 'text-blue-500',
      title: 'Under Review',
      description: 'Your documents have been submitted and are being reviewed by our team. This usually takes 1–2 business days.',
    },
    approved: {
      icon: ShieldCheck,
      bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30',
      iconColor: 'text-green-500',
      title: 'Verified Shop',
      description: 'Your shop is verified! The ✓ Verified badge is now showing on your listings and shop page.',
    },
    rejected: {
      icon: ShieldAlert,
      bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30',
      iconColor: 'text-red-500',
      title: 'Verification Rejected',
      description: 'Your verification was not approved. Please review the reason below and resubmit.',
    },
  };
  const { icon: Icon, bg, iconColor, title, description } = configs[status];
  return (
    <div className={`flex items-start gap-4 p-5 rounded-xl border ${bg}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconColor} bg-white dark:bg-neutral-950 shadow-sm`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-600 dark:text-neutral-300 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function BadgePreview() {
  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-6 text-center">
      <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-4">Badge Preview</p>
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-900 border border-green-300 dark:border-green-700 rounded-full shadow-sm mb-3">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <span className="text-sm font-bold text-gray-900 dark:text-white">Verified Shop</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-neutral-300">Displayed on your shop page and product listings</p>
    </div>
  );
}

export default function VerificationPage() {
  const { user } = useAuthStore();
  const [verification, setVerification] = useState<VerificationData>({
    status: 'not_started',
    phone_verified: false,
    email_verified: false,
  });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadVerification();
  }, []);

  const loadVerification = async () => {
    try {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      // First, try to auto-verify (checks if user has existing listings)
      const autoVerifyRes = await api.post(
        `/subscriptions/sellers/${user.id}/verification/auto-verify`
      ).catch(() => null);

      if (autoVerifyRes?.data?.auto_verified) {
        // Already verified as existing seller
        setVerification({
          status: 'approved',
          phone_verified: true,
          email_verified: true,
        });
        setSuccess('Auto-verified as existing shop owner! No need to re-verify.');
        setLoading(false);
        return;
      }

      // If not auto-verified, fetch regular verification status
      const statusRes = await api.get(
        `/subscriptions/sellers/${user.id}/verification/status`
      ).catch(() => null);

      if (statusRes?.data) {
        setVerification({
          status: statusRes.data.status as VerificationStatus,
          phone_verified: statusRes.data.phone_verified,
          email_verified: statusRes.data.email_verified,
        });
      } else {
        // Fallback to seller profile
        const profileRes = await api.get('/sellers/me').catch(() => null);
        if (profileRes?.data) {
          setVerification((prev) => ({
            ...prev,
            phone_verified: !!profileRes.data.phone,
            email_verified: !!profileRes.data.email,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load verification status:', err);
    } finally {
      setLoading(false);
    }
  };

  const requirements: Requirement[] = [
    {
      key: 'national_id',
      label: 'National ID or Passport',
      description: 'A clear photo of your government-issued ID',
      required: true,
      completed: files.length > 0 || verification.status === 'approved' || verification.status === 'pending',
    },
    {
      key: 'phone',
      label: 'Phone Verification',
      description: 'Your registered phone number must be verified',
      required: true,
      completed: verification.phone_verified,
    },
    {
      key: 'email',
      label: 'Email Verification',
      description: 'Your account email must be verified',
      required: true,
      completed: verification.email_verified,
    },
    {
      key: 'business_reg',
      label: 'Business Registration (optional)',
      description: 'Certificate of incorporation or business registration',
      required: false,
      completed: false,
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (files.length === 0) {
      setError('Please upload at least your National ID or Passport.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('documents', f));
      await api.post('/sellers/me/verification-documents', formData);
      setVerification((prev) => ({ ...prev, status: 'pending' }));
      setFiles([]);
      setSuccess("Documents submitted successfully! We'll review them within 1-2 business days.");
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to submit documents. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const benefits = [
    { icon: TrendingUp, label: 'Higher search ranking', desc: 'Verified shops appear higher in relevant search results' },
    { icon: Star, label: 'Increased buyer trust', desc: 'Buyers prefer verified sellers — see up to 30% more inquiries' },
    { icon: BadgeCheck, label: 'Badge on listings', desc: 'The ✓ Verified badge shows on every product and your shop page' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-7 h-7 animate-spin text-orange-500" />
          <p className="text-gray-500 text-sm">Loading verification status...</p>
        </div>
      </div>
    );
  }

  const canSubmit = verification.status === 'not_started' || verification.status === 'rejected';

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Shop Verification</h1>
        <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1">
          Get the <span className="font-semibold text-green-600">✓ Verified Shop</span> badge and unlock higher search rankings
        </p>
      </div>

      {/* Status Banner */}
      <StatusBanner status={verification.status} />

      {/* Rejection reason */}
      {verification.status === 'rejected' && verification.rejection_reason && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Reason for rejection</p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-1">{verification.rejection_reason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requirements */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-6">
          <h2 className="font-black text-gray-900 dark:text-white mb-5">Requirements</h2>
          <div className="space-y-4">
            {requirements.map((req) => (
              <div key={req.key} className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  req.completed
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-600'
                    : 'bg-gray-100 dark:bg-neutral-900 text-gray-400'
                }`}>
                  {req.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-neutral-700" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {req.label}
                    {!req.required && (
                      <span className="ml-2 text-xs font-normal text-gray-400">(optional)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">{req.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Badge preview */}
        <div className="space-y-4">
          <BadgePreview />

          {/* Benefits */}
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
            <h3 className="font-black text-gray-900 dark:text-white mb-4 text-sm">Benefits</h3>
            <div className="space-y-3">
              {benefits.map((b) => (
                <div key={b.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0">
                    <b.icon className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{b.label}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Document Upload (only if can submit) */}
      {canSubmit && (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-6">
          <h2 className="font-black text-gray-900 dark:text-white mb-2">Upload Documents</h2>
          <p className="text-sm text-gray-500 dark:text-neutral-300 mb-5">
            Upload a clear photo of your National ID, Passport, or business registration documents.
            Accepted formats: JPG, PNG, PDF.
          </p>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-xl p-8 text-center cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 transition-colors"
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200">Click to upload documents</p>
            <p className="text-xs text-gray-400 dark:text-neutral-400 mt-1">JPG, PNG, PDF up to 10 MB each</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-neutral-900 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Upload className="w-4 h-4 text-orange-500" />
                    </div>
                    <p className="text-sm text-gray-700 dark:text-neutral-200 truncate">{f.name}</p>
                  </div>
                  <button onClick={() => removeFile(idx)} className="p-1 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded ml-2 flex-shrink-0">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Error / Success */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          {success && (
            <div className="mt-4 flex items-center gap-2 text-green-600 text-sm bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> {success}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || files.length === 0}
            className="mt-5 w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm"
          >
            {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            Submit for Verification
          </button>
        </div>
      )}

      {/* Pending state info */}
      {verification.status === 'pending' && (
        <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-5">
          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">What happens next?</h3>
          <ul className="space-y-1.5 text-sm text-blue-700 dark:text-blue-400">
            <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5" /> Our team reviews your documents (1–2 business days)</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5" /> You'll receive an email notification with the result</li>
            <li className="flex items-center gap-2"><ChevronRight className="w-3.5 h-3.5" /> Once approved, the ✓ Verified badge is automatically displayed</li>
          </ul>
        </div>
      )}
    </div>
  );
}
