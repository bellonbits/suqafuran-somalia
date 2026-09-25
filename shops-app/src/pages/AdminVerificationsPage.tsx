"use client";
import React, { useState, useEffect } from 'react';
import {
  Search, Loader, Eye, CheckCircle, X, UserCheck,
  FileText, Clock, XCircle, FileImage, Video, ExternalLink,
  UserX, RotateCcw, MessageCircleQuestion, ShieldOff
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import api from '@/services/api';

const adminNavItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
  ...item,
  icon: <Icon className="w-5 h-5" />
}));

const AVATAR_COLORS = [
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-orange-500',
];

function getStatusBadge(status: string) {
  switch (status) {
    case 'approved': return 'badge badge-green';
    case 'pending':  return 'badge badge-yellow';
    case 'rejected': return 'badge badge-red';
    default:         return 'badge badge-gray';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'approved': return <CheckCircle className="w-3.5 h-3.5" />;
    case 'rejected': return <XCircle className="w-3.5 h-3.5" />;
    default:         return <Clock className="w-3.5 h-3.5" />;
  }
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600 font-bold';
  if (score >= 50) return 'text-amber-600 font-bold';
  return 'text-red-600 font-bold';
}

const VerificationsPage = () => {
  const [verifications, setVerifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedVerification, setSelectedVerification] = useState<any>(null);
  const [serverStats, setServerStats] = useState<{ pending: number; approved: number; rejected: number; suspended_sellers: number } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [infoRequestText, setInfoRequestText] = useState('');
  const [showInfoRequestBox, setShowInfoRequestBox] = useState(false);

  useEffect(() => { loadVerifications(); loadStats(); }, []);

  const loadVerifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/verifications/').catch(() => null);
      if (res?.data) setVerifications(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading verifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/verifications/stats');
      setServerStats(res.data);
    } catch {
      // Falls back to the client-side counts below
    }
  };

  const refresh = () => { loadVerifications(); loadStats(); };

  const handleApprove = async (id: number) => {
    try {
      await api.patch(`/verifications/${id}`, { status: 'approved' }).catch(() => null);
      refresh();
    } catch {}
  };

  const handleReject = async (id: number) => {
    try {
      await api.patch(`/verifications/${id}`, { status: 'rejected' }).catch(() => null);
      refresh();
    } catch {}
  };

  const handleReverify = async (id: number) => {
    setActionBusy(true);
    try {
      await api.post(`/verifications/${id}/reverify`);
      refresh();
      setSelectedVerification(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleSuspendSeller = async (id: number) => {
    setActionBusy(true);
    try {
      await api.post(`/verifications/${id}/suspend-seller`, { reason: 'Suspended from verification review' });
      refresh();
      setSelectedVerification(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleReactivateSeller = async (id: number) => {
    setActionBusy(true);
    try {
      await api.post(`/verifications/${id}/reactivate-seller`);
      refresh();
      setSelectedVerification(null);
    } finally {
      setActionBusy(false);
    }
  };

  const handleRequestInfo = async (id: number) => {
    if (!infoRequestText.trim()) return;
    setActionBusy(true);
    try {
      await api.post(`/verifications/${id}/request-info`, { message: infoRequestText.trim() });
      setInfoRequestText('');
      setShowInfoRequestBox(false);
      refresh();
      setSelectedVerification(null);
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = verifications.filter(v => {
    const name = v.user?.full_name || v.full_name || v.user_name || '';
    const phone = v.user?.phone || v.phone || '';
    const matchSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      phone.includes(searchQuery);
    const matchStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount  = serverStats?.pending ?? verifications.filter(v => v.status === 'pending').length;
  const approvedCount = serverStats?.approved ?? verifications.filter(v => v.status === 'approved').length;
  const rejectedCount = serverStats?.rejected ?? verifications.filter(v => v.status === 'rejected').length;
  const suspendedSellersCount = serverStats?.suspended_sellers ?? 0;

  return (
    <DashboardLayout title="Verifications" navItems={adminNavItems} userRole="admin">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Verification Requests</h2>
          <p className="text-sm text-slate-400 mt-0.5">Review and approve user identity verifications</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-5 mb-7">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{verifications.length}</p>
            <p className="text-sm text-slate-400 mt-0.5">Total</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{pendingCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">Pending Review</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{approvedCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">Approved</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{rejectedCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">Rejected</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-neutral-900 flex items-center justify-center">
            <ShieldOff className="w-6 h-6 text-slate-600 dark:text-neutral-300" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{suspendedSellersCount}</p>
            <p className="text-sm text-slate-400 mt-0.5">Suspended Sellers</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white dark:bg-neutral-950 shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-200 hover:bg-gray-50'
              }`}
            >
              {s} {s !== 'all' && <span className="ml-1 opacity-70 text-xs">({
                s === 'pending' ? pendingCount : s === 'approved' ? approvedCount : rejectedCount
              })</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="data-table-wrapper">
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-slate-400 text-sm">Loading verifications…</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th className="hidden md:table-cell">Document Type</th>
                  <th>Match Score</th>
                  <th className="hidden sm:table-cell">Submitted</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No verifications found</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((v, idx) => {
                    const name = v.user?.full_name || v.full_name || v.user_name || 'Unknown';
                    const phone = v.user?.phone || v.phone || '';
                    const score = v.facial_match_score || v.match_score || v.admin_score || 0;

                    return (
                      <tr key={v.id}>
                        {/* User */}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white leading-tight">{name}</p>
                              {phone && <p className="text-xs text-slate-400 mt-0.5 font-mono">{phone}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Tier */}
                        <td>
                          <span className="badge badge-blue">
                            {v.tier || v.user?.verified_level || v.verification_level || 'STANDARD'}
                          </span>
                        </td>
                        {/* Doc type */}
                        <td className="hidden md:table-cell">
                          <span className="text-slate-600 dark:text-neutral-200 text-sm">{v.document_type || v.id_type || '—'}</span>
                        </td>
                        {/* Match score */}
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${score >= 80 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                            <span className={`text-sm ${scoreColor(score)}`}>{score}%</span>
                          </div>
                        </td>
                        {/* Submitted */}
                        <td className="hidden sm:table-cell">
                          <span className="text-slate-400 text-xs">
                            {v.created_at ? new Date(v.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </span>
                        </td>
                        {/* Status */}
                        <td>
                          <span className={getStatusBadge(v.status)}>
                            {getStatusIcon(v.status)}
                            {v.status === 'approved' ? 'Approved' : v.status === 'pending' ? 'Pending' : 'Rejected'}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedVerification(v)}
                              className="p-1.5 rounded-lg text-sky-500 hover:bg-sky-50 transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {v.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(v.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 hover:bg-emerald-200 transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(v.id)}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/30 text-red-700 hover:bg-red-200 transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {v.status === 'rejected' && (
                              <button
                                onClick={() => handleApprove(v.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 hover:bg-emerald-200 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 border-t border-slate-100 dark:border-neutral-800 bg-gray-50/50 text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-600 dark:text-neutral-200">{filtered.length}</span> of{' '}
            <span className="font-semibold text-slate-600 dark:text-neutral-200">{verifications.length}</span> verifications
          </div>
        </div>
      )}

      {/* ── Detail Modal ─────────────────────────────────── */}
      {selectedVerification && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setSelectedVerification(null); }}
        >
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 dark:border-neutral-800 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Verification #{selectedVerification.id}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Identity verification request details</p>
              </div>
              <button
                onClick={() => setSelectedVerification(null)}
                className="p-2 hover:bg-slate-100 dark:bg-neutral-900 rounded-xl transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* User info */}
              <div className="bg-slate-50 dark:bg-neutral-900/40 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">User Information</p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', val: selectedVerification.user?.full_name || selectedVerification.full_name || '—' },
                    { label: 'Business Name', val: selectedVerification.user?.business_name || '—' },
                    { label: 'Phone', val: selectedVerification.user?.phone || selectedVerification.phone || '—' },
                    { label: 'Email', val: selectedVerification.user?.email || selectedVerification.email || '—' },
                    { label: 'Location', val: selectedVerification.user?.location || '—' },
                    { label: 'Level', val: selectedVerification.tier || selectedVerification.user?.verified_level || 'STANDARD' },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-slate-400 font-semibold mb-1">{f.label}</p>
                      <p className="text-sm text-slate-900 dark:text-white font-medium">{f.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification info */}
              <div className="bg-slate-50 dark:bg-neutral-900/40 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Verification Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Document Type</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">{selectedVerification.document_type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Status</p>
                    <span className={getStatusBadge(selectedVerification.status)}>
                      {getStatusIcon(selectedVerification.status)}
                      {selectedVerification.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Match Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${(selectedVerification.facial_match_score || 0) >= 80 ? 'bg-emerald-500' : (selectedVerification.facial_match_score || 0) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(selectedVerification.facial_match_score || 0, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm ${scoreColor(selectedVerification.facial_match_score || 0)}`}>
                        {selectedVerification.facial_match_score || 0}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Submitted</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">
                      {selectedVerification.created_at ? new Date(selectedVerification.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Verification Officer</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">
                      {selectedVerification.reviewed_by || 'Not yet reviewed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-semibold mb-1">Verification Date</p>
                    <p className="text-sm text-slate-900 dark:text-white font-medium">
                      {selectedVerification.reviewed_at ? new Date(selectedVerification.reviewed_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ID Number */}
              {selectedVerification.id_number && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-2">ID Number</p>
                  <p className="text-lg font-black text-sky-600 font-mono">{selectedVerification.id_number}</p>
                </div>
              )}

              {/* Documents */}
              {(() => {
                const docs: any[] = [];
                if (selectedVerification.selfie_url) docs.push({ url: selectedVerification.selfie_url, label: 'Selfie', type: 'image' });
                if (selectedVerification.proof_of_address_url) docs.push({ url: selectedVerification.proof_of_address_url, label: 'Proof of Address', type: 'image' });
                if (selectedVerification.video_selfie_url) docs.push({ url: selectedVerification.video_selfie_url, label: 'Video Selfie', type: 'video' });
                if (Array.isArray(selectedVerification.document_urls)) {
                  selectedVerification.document_urls.forEach((url: string, i: number) => {
                    if (url) docs.push({ url, label: `Document ${i + 1}`, type: url.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image' });
                  });
                }
                const unique = Array.from(new Map(docs.map(d => [d.url, d])).values());
                if (!unique.length) return null;
                return (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Documents & Images ({unique.length})
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {unique.map((doc, i) => (
                        <div key={i} className="border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-neutral-900/40 border-b border-slate-200 dark:border-neutral-800">
                            {doc.type === 'pdf' ? <FileImage className="w-4 h-4 text-red-500" /> :
                             doc.type === 'video' ? <Video className="w-4 h-4 text-sky-500" /> :
                             <FileImage className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-200">{doc.label}</span>
                          </div>
                          {doc.type === 'pdf' ? (
                            <div className="p-6 flex flex-col items-center gap-3 bg-white">
                              <FileText className="w-12 h-12 text-red-500" />
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-600 transition-colors">
                                <ExternalLink className="w-4 h-4" /> View PDF
                              </a>
                            </div>
                          ) : doc.type === 'video' ? (
                            <div className="bg-black">
                              <video src={doc.url} controls className="w-full max-h-64" />
                            </div>
                          ) : (
                            <img src={doc.url} alt={doc.label} className="w-full max-h-80 object-contain bg-slate-50 dark:bg-neutral-900/40" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Admin Notes */}
              {selectedVerification.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Admin Notes</p>
                  <p className="text-sm text-amber-800">{selectedVerification.notes}</p>
                </div>
              )}

              {/* Request more info */}
              {showInfoRequestBox && (
                <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/40 rounded-xl p-4">
                  <p className="text-xs font-bold text-sky-700 uppercase tracking-wider mb-2">What's missing?</p>
                  <textarea
                    value={infoRequestText}
                    onChange={(e) => setInfoRequestText(e.target.value)}
                    placeholder="e.g. Your ID photo is blurry -- please re-upload a clearer copy."
                    className="w-full text-sm p-3 rounded-lg border border-sky-200 dark:border-sky-900/40 bg-white dark:bg-neutral-950 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                    rows={3}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      disabled={actionBusy || !infoRequestText.trim()}
                      onClick={() => handleRequestInfo(selectedVerification.id)}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      Send Request
                    </button>
                    <button
                      onClick={() => { setShowInfoRequestBox(false); setInfoRequestText(''); }}
                      className="px-4 py-2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg text-sm font-semibold text-slate-600 dark:text-neutral-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Modal actions */}
              <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-neutral-800">
                {selectedVerification.status === 'pending' && (
                  <>
                    <button
                      onClick={() => { handleApprove(selectedVerification.id); setSelectedVerification(null); }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => { handleReject(selectedVerification.id); setSelectedVerification(null); }}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                    <button
                      onClick={() => setShowInfoRequestBox(true)}
                      className="flex-1 py-2.5 bg-sky-50 dark:bg-sky-950/30 hover:bg-sky-100 text-sky-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircleQuestion className="w-4 h-4" /> Request Info
                    </button>
                  </>
                )}
                {selectedVerification.status === 'rejected' && (
                  <>
                    <button
                      onClick={() => { handleApprove(selectedVerification.id); setSelectedVerification(null); }}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve Anyway
                    </button>
                    <button
                      disabled={actionBusy}
                      onClick={() => handleReverify(selectedVerification.id)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-neutral-900 hover:bg-gray-200 text-slate-700 dark:text-neutral-200 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Re-verify
                    </button>
                  </>
                )}
                {selectedVerification.status === 'approved' && (
                  <div className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 rounded-xl font-semibold text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Already Approved
                  </div>
                )}

                {selectedVerification.user?.is_suspended ? (
                  <button
                    disabled={actionBusy}
                    onClick={() => handleReactivateSeller(selectedVerification.id)}
                    className="flex-1 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" /> Reactivate Seller
                  </button>
                ) : (
                  <button
                    disabled={actionBusy}
                    onClick={() => handleSuspendSeller(selectedVerification.id)}
                    className="flex-1 py-2.5 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-red-700 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <UserX className="w-4 h-4" /> Suspend Seller
                  </button>
                )}

                <button
                  onClick={() => { setSelectedVerification(null); setShowInfoRequestBox(false); setInfoRequestText(''); }}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-neutral-900 hover:bg-gray-200 text-slate-700 dark:text-neutral-200 rounded-xl font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default VerificationsPage;
