"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { authService } from '@/services/authService';
import { Mail, Phone, MapPin, Shield, Calendar, LogOut, Loader2, AlertCircle, Copy, Check, Camera, ExternalLink, Edit2, X, Save, Bell, ShieldCheck } from 'lucide-react';
import api, { resolveMediaUrl } from '@/services/api';
import { VerificationSection } from '@/components/features/VerificationSection';

function AccountPageContent() {
  const searchParams = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isHydrated, logout } = useAuthStore();
  const openAuthModal = useAuthModal((s) => s.open);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'verification'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ full_name: '', phone: '', email: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const profileData = await authService.getCurrentUser();
        setProfile(profileData);
      } catch (err: any) {
        setError('Failed to load profile. Please try again.');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    const tab = searchParams.get('tab');
    if (tab === 'verification') {
      setActiveTab('verification');
    }
  }, [isAuthenticated, searchParams]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setAvatarPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploading(true);
      const res = await authService.uploadAvatar(file);

      if (res && res.avatar_url) {
        setProfile((prev: any) => ({ ...prev, avatar_url: res.avatar_url }));
        if (user) {
          useAuthStore.getState().setUser({ ...user, avatar_url: res.avatar_url });
        }
        setAvatarPreview(null);
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload image');
      setAvatarPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleEditClick = () => {
    setEditFormData({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      email: profile.email || '',
    });
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditFormData({ full_name: '', phone: '', email: '' });
  };

  const handleSaveProfile = async () => {
    setEditError('');
    setEditSuccess('');

    // Validation
    if (!editFormData.full_name.trim()) {
      setEditError('Full name is required');
      return;
    }

    if (editFormData.email && !editFormData.email.includes('@')) {
      setEditError('Please enter a valid email address');
      return;
    }

    try {
      setIsSaving(true);

      const updateData: any = {
        full_name: editFormData.full_name,
        phone: editFormData.phone,
      };

      if (editFormData.email && editFormData.email !== profile.email) {
        updateData.email = editFormData.email;
      }

      await authService.updateProfile(updateData);

      setProfile((prev: any) => ({
        ...prev,
        full_name: editFormData.full_name,
        phone: editFormData.phone,
        email: editFormData.email,
      }));

      if (user) {
        useAuthStore.getState().setUser({
          ...user,
          full_name: editFormData.full_name,
          email: editFormData.email,
        });
      }

      setEditSuccess('✓ Profile updated successfully!');
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess('');
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update profile';

      // Specific error messages
      if (errorMessage.includes('already') || errorMessage.includes('exists')) {
        setEditError('This email address is already in use. Please use a different one.');
      } else if (errorMessage.includes('email')) {
        setEditError('Email update failed. Please check your email and try again.');
      } else if (errorMessage.includes('phone')) {
        setEditError('Phone update failed. Please check your phone number and try again.');
      } else if (errorMessage.includes('name')) {
        setEditError('Name update failed. Please try again.');
      } else {
        setEditError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isHydrated && !isAuthenticated) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 text-center space-y-4">
        <p className="font-bold text-gray-500">Sign in to view your account.</p>
        <button
          onClick={() => openAuthModal('signin')}
          className="text-primary font-black hover:underline cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-[#6cd4ff]" />
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
        <div className="max-w-md w-full p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <div className="flex gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-900 dark:text-red-200">Error</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error || 'Failed to load profile'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const resolvedAvatar = avatarPreview || resolveMediaUrl(profile.avatar_url);

  return (
    <div className="min-h-screen bg-white dark:bg-black pt-20 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">

        {/* Header Section with Avatar + Info */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 mb-8 items-start md:items-start">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {resolvedAvatar ? (
              <img
                src={resolvedAvatar}
                alt={profile.full_name}
                className="w-32 h-32 rounded-2xl object-cover shadow-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}
            <div
              className="avatar-fallback w-32 h-32 rounded-2xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center text-white font-black text-4xl shadow-lg"
              style={{ display: resolvedAvatar ? 'none' : 'flex' }}
            >
              {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>

            <button
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute bottom-2 right-2 p-3 bg-[#6cd4ff] hover:bg-[#5bc0e8] disabled:bg-slate-400 text-white rounded-full shadow-lg transition-colors"
              title="Change profile picture"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
              disabled={uploading}
            />
          </div>

          {/* Profile Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                {editError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> {editError}
                    </p>
                  </div>
                )}

                {editSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                      <Check className="w-4 h-4" /> {editSuccess}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6cd4ff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6cd4ff]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6cd4ff]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-[#6cd4ff] hover:bg-[#5bc0e8] disabled:bg-slate-400 text-white font-bold rounded-lg transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                  <button
                    onClick={handleEditCancel}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-gray-200 dark:bg-neutral-900 hover:bg-gray-300 dark:hover:bg-neutral-800 text-gray-900 dark:text-white font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-1">{profile.full_name}</h1>
                    <p className="text-base text-gray-600 dark:text-gray-400 font-medium">Account Member</p>
                  </div>
                  <button
                    onClick={handleEditClick}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
                    title="Edit profile"
                  >
                    <Edit2 className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                </div>

                {/* Contact Info Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#6cd4ff] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{profile.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#6cd4ff] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{profile.phone || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-[#6cd4ff] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">{profile.is_verified ? '✓ Verified' : 'Pending'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#6cd4ff] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Member Since</p>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white">
                        {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/settings/notifications"
                    className="flex items-center gap-2 px-6 py-3 bg-[#e0f7ff] dark:bg-sky-950/40 text-[#0ea5e9] font-bold rounded-full hover:bg-[#c9f0ff] transition-colors"
                  >
                    <Bell className="w-4 h-4" />
                    Notification Settings
                  </Link>
                  <Link
                    href="/security-logs"
                    className="flex items-center gap-2 px-6 py-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-bold rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Security Activity
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-8 border-b border-gray-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-2 py-4 font-bold text-base border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-sky-500 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-2 py-4 font-bold text-base border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'verification'
                ? 'border-sky-500 text-gray-900 dark:text-white'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Verification
          </button>
        </div>

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
        <div className="space-y-12">

          {/* Account Status Section */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Account Status</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">Active Status</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${profile.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-bold text-gray-900 dark:text-white">{profile.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">Verification</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${profile.is_verified ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="font-bold text-gray-900 dark:text-white">{profile.is_verified ? 'Verified' : 'Pending'}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">Account Health</p>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${!profile.is_suspended ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="font-bold text-gray-900 dark:text-white">{!profile.is_suspended ? 'Good' : 'Suspended'}</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-bold uppercase">Trust Score</p>
                <p className="font-bold text-gray-900 dark:text-white text-lg">{profile.trust_score || 0}</p>
              </div>
            </div>
          </div>

          {/* Security Information */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Security Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Email Card */}
              <div className="p-7 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-md">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Email Address</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white break-all">{profile.email}</p>
                  </div>
                  {profile.email_verified && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" /> Verified
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(profile.email, 'email')}
                  className="flex items-center gap-2 text-sm font-semibold text-[#6cd4ff] hover:text-sky-700 transition-colors"
                >
                  {copiedField === 'email' ? (<><Check className="w-4 h-4" /> Copied</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
                </button>
              </div>

              {/* Phone Card */}
              <div className="p-7 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-md">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-2">Phone Number</p>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{profile.phone || 'Not provided'}</p>
                  </div>
                  {profile.phone_verified && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-full flex-shrink-0">
                      <Shield className="w-3.5 h-3.5" /> Verified
                    </div>
                  )}
                </div>
                {profile.phone && (
                  <button
                    onClick={() => handleCopy(profile.phone, 'phone')}
                    className="flex items-center gap-2 text-sm font-semibold text-[#6cd4ff] hover:text-sky-700 transition-colors"
                  >
                    {copiedField === 'phone' ? (<><Check className="w-4 h-4" /> Copied</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Additional Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

              <div className="p-7 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-md">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-3">Trust Level</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white mb-2">{profile.trust_level || 'NEW'}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Score: {profile.trust_score || 0}</p>
              </div>

              <div className="p-7 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-md">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-3">Account Age</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  {Math.floor((new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                </p>
              </div>

              <div className="p-7 rounded-3xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-md">
                <p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase mb-3">Member Since</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {new Date(profile.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>

        </div>
        )}

        {/* Verification Tab */}
        {activeTab === 'verification' && (
          <VerificationSection />
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return <AccountPageContent />;
}
