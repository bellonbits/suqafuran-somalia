"use client";

import React, { useState, useEffect } from 'react';
import {
  Plus, Loader, Tag, Trash2, Copy, Check, AlertCircle,
  Ticket, BarChart2, X, RefreshCw, Megaphone, TrendingUp
} from 'lucide-react';
import api from '@/services/api';
import { PlanGate } from '@/components/seller/PlanGate';

// ─── Types ───────────────────────────────────────────────────────────
interface DiscountCode {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expiry_date: string | null;
  max_uses: number | null;
  current_uses: number;
  revenue_generated: number;
  is_active: boolean;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  clicks: number;
  conversions: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────
function generateCode(prefix = '') {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return prefix ? `${prefix}${rand}` : rand;
}

function CodeBadge({ code, onCopy }: { code: string; onCopy: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopy();
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
    >
      <span className="font-mono text-sm font-bold text-gray-900 dark:text-white tracking-wider">{code}</span>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
    </button>
  );
}

// ─── Create Code Modal ───────────────────────────────────────────────
function CreateCodeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: generateCode(),
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 10,
    expiry_date: '',
    max_uses: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.code.trim() || !form.discount_value) {
      setError('Please fill in all required fields.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post('/marketing/codes', {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        expiry_date: form.expiry_date || null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
      });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create code. Try a different code name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Create Discount Code</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-300 mt-0.5">Customers enter this at checkout</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Code */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">
              Code <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="flex-1 px-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white font-mono text-sm uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="SUMMER10"
              />
              <button
                onClick={() => setForm({ ...form, code: generateCode() })}
                className="px-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                title="Generate random code"
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Discount Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">Type</label>
              <select
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (KSh)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">
                Value <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {form.discount_type === 'percentage' ? '%' : 'KSh'}
                </span>
                <input
                  type="number"
                  min={1}
                  max={form.discount_type === 'percentage' ? 100 : undefined}
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Expiry + Max Uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">Expiry Date</label>
              <input
                type="date"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">Max Uses</label>
              <input
                type="number"
                min={1}
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="Unlimited"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 text-center">
            <p className="font-mono text-xl font-black text-orange-700 dark:text-orange-400 tracking-widest">
              {form.code || 'YOUR_CODE'}
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mt-1 font-semibold">
              {form.discount_type === 'percentage' ? `${form.discount_value}% OFF` : `KSh ${form.discount_value} OFF`}
            </p>
            {form.expiry_date && (
              <p className="text-xs text-orange-500 mt-1">
                Expires: {new Date(form.expiry_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Code
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────
type Tab = 'codes' | 'campaigns';

function MarketingPageContent() {
  const [tab, setTab] = useState<Tab>('codes');
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, campaignsRes] = await Promise.all([
        api.get('/marketing/codes').catch(() => null),
        api.get('/campaigns?limit=50').catch(() => null),
      ]);
      setCodes(Array.isArray(codesRes?.data) ? codesRes.data : []);
      setCampaigns(Array.isArray(campaignsRes?.data) ? campaignsRes.data : []);
    } catch (err) {
      console.error('Marketing load error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCode = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/marketing/codes/${id}`);
      setCodes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeletingId(null);
    }
  };

  const totalUses = codes.reduce((sum, c) => sum + c.current_uses, 0);
  const totalRevenue = codes.reduce((sum, c) => sum + c.revenue_generated, 0);
  const activeCodes = codes.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Marketing</h1>
          <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1">Discount codes and promotional campaigns</p>
        </div>
        {tab === 'codes' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Code
          </button>
        )}
        {tab === 'campaigns' && (
          <button className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-900 rounded-xl p-1 w-fit">
        {([['codes', 'Discount Codes', Ticket], ['campaigns', 'Campaigns', Megaphone]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === key
                ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-neutral-300 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-7 h-7 animate-spin text-orange-500" />
        </div>
      ) : tab === 'codes' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Active Codes', value: activeCodes, icon: Tag, color: 'bg-orange-100 dark:bg-orange-900/20 text-orange-600' },
              { label: 'Total Uses', value: totalUses, icon: BarChart2, color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600' },
              { label: 'Revenue Generated', value: `KSh ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-green-100 dark:bg-green-900/20 text-green-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-neutral-950 rounded-xl p-4 border border-gray-200 dark:border-neutral-800">
                <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-black text-gray-900 dark:text-white">{value}</p>
                <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Codes list */}
          <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800">
            <div className="p-5 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="font-black text-gray-900 dark:text-white">Your Codes</h2>
            </div>

            {codes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-4">
                  <Ticket className="w-7 h-7 text-orange-500" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">No discount codes yet</p>
                <p className="text-sm text-gray-500 dark:text-neutral-300 mb-5">Create your first code to boost sales</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Code
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {codes.map((code) => {
                  const expired = code.expiry_date ? new Date(code.expiry_date) < new Date() : false;
                  const maxedOut = code.max_uses !== null && code.current_uses >= code.max_uses;
                  const statusOk = code.is_active && !expired && !maxedOut;
                  return (
                    <div key={code.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5">
                      <div className="flex items-center gap-4">
                        <CodeBadge code={code.code} onCopy={() => {}} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {code.discount_type === 'percentage'
                                ? `${code.discount_value}% OFF`
                                : `KSh ${code.discount_value.toLocaleString()} OFF`}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                              statusOk
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                                : 'bg-gray-100 text-gray-500 dark:bg-neutral-900 dark:text-neutral-300'
                            }`}>
                              {statusOk ? 'Active' : expired ? 'Expired' : maxedOut ? 'Maxed Out' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-neutral-300 mt-1">
                            <span>{code.current_uses} uses{code.max_uses ? ` / ${code.max_uses} max` : ''}</span>
                            <span>·</span>
                            <span>KSh {code.revenue_generated.toLocaleString()} generated</span>
                            {code.expiry_date && (
                              <>
                                <span>·</span>
                                <span>Expires {new Date(code.expiry_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        disabled={deletingId === code.id}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors disabled:opacity-50"
                      >
                        {deletingId === code.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        /* Campaigns tab */
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800">
          <div className="p-5 border-b border-gray-200 dark:border-neutral-800">
            <h2 className="font-black text-gray-900 dark:text-white">Active Campaigns</h2>
          </div>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-4">
                <Megaphone className="w-7 h-7 text-orange-500" />
              </div>
              <p className="font-bold text-gray-900 dark:text-white mb-1">No campaigns yet</p>
              <p className="text-sm text-gray-500 dark:text-neutral-300">Launch a campaign to boost your shop visibility</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {campaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-5">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">
                      {c.clicks} clicks · {c.conversions} conversions
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    c.status === 'active'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-neutral-900'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateCodeModal onClose={() => setShowCreateModal(false)} onCreated={loadData} />
      )}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <PlanGate
      requiredPlan="starter"
      featureName="Marketing Codes"
      featureDescription="Create discount codes like SUMMER10 or WELCOME500 to boost sales. Track usage and revenue per code. Available on the Starter plan."
    >
      <MarketingPageContent />
    </PlanGate>
  );
}
