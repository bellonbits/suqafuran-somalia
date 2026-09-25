"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Loader, Users, Lock, Unlock, Trash2, ShieldOff,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Store,
  ShieldCheck, ShieldAlert, UserCog, Filter,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import api from '@/services/api';

interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  is_suspended: boolean;
  is_admin: boolean;
  business_name?: string | null;
  location?: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  referral_code?: string | null;
  created_at: string;
}

interface SignupStats {
  total: number;
  buyers: number;
  sellers: number;
  admins: number;
  verified: number;
  unverified: number;
  active: number;
  inactive: number;
  suspended: number;
}

const adminNavItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
  ...item,
  icon: <Icon className="w-5 h-5" />
}));

const AVATAR_COLORS = [
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-purple-400 to-pink-500',
  'from-amber-400 to-orange-500',
  'from-rose-400 to-red-500',
  'from-indigo-400 to-violet-500',
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

const PAGE_SIZE = 50;

const UsersManagementPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SignupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [totalMatching, setTotalMatching] = useState(0);

  const [userType, setUserType] = useState<'all' | 'buyer' | 'seller' | 'admin'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive' | 'suspended'>('all');
  const [verification, setVerification] = useState<'all' | 'verified' | 'unverified'>('all');
  const [location, setLocation] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filterParams = useCallback(() => {
    const p: Record<string, string> = {};
    if (searchQuery) p.search = searchQuery;
    if (userType !== 'all') p.user_type = userType;
    if (status !== 'all') p.status = status;
    if (verification !== 'all') p.verification = verification;
    if (location) p.location = location;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [searchQuery, userType, status, verification, location, dateFrom, dateTo]);

  useEffect(() => { setPage(0); }, [searchQuery, userType, status, verification, location, dateFrom, dateTo]);

  useEffect(() => { loadUsers(); }, [page, filterParams]);

  useEffect(() => { loadStats(); }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { ...filterParams(), limit: PAGE_SIZE, skip: page * PAGE_SIZE };
      const [usersRes, countRes] = await Promise.all([
        api.get('/admin/users', { params }),
        api.get('/admin/users/count', { params: filterParams() }),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setTotalMatching(countRes.data?.total ?? 0);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await api.get('/admin/users/signup-stats');
      setStats(res.data);
    } catch {
      // Cards stay hidden -- table still works
    }
  };

  const refresh = () => { loadUsers(); loadStats(); };

  const handleToggleStatus = async (userId: number, isActive: boolean) => {
    await api.post(`/admin/users/${userId}/status`, { is_active: !isActive }).catch(() => null);
    refresh();
  };

  const handleToggleSuspend = async (userId: number, isSuspended: boolean) => {
    await api.put(`/admin/users/${userId}`, { is_suspended: !isSuspended }).catch(() => null);
    refresh();
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    await api.delete(`/admin/users/${userId}`).catch(() => null);
    refresh();
  };

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total, icon: Users, color: 'bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400' },
    { label: 'Buyers', value: stats.buyers, icon: Users, color: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' },
    { label: 'Sellers', value: stats.sellers, icon: Store, color: 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' },
    { label: 'Admins', value: stats.admins, icon: UserCog, color: 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400' },
    { label: 'Verified', value: stats.verified, icon: ShieldCheck, color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Unverified', value: stats.unverified, icon: ShieldAlert, color: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' },
    { label: 'Active', value: stats.active, icon: Unlock, color: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' },
    { label: 'Suspended', value: stats.suspended, icon: ShieldOff, color: 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' },
  ] : [];

  return (
    <DashboardLayout title="Users Management" navItems={adminNavItems} userRole="admin">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Registered Signups</h2>
          <p className="text-sm text-slate-400 mt-0.5">Every registered account, filterable by type, status, verification, location, and date</p>
        </div>
      </div>

      {/* Stat cards */}
      {statCards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
          {statCards.map((c) => (
            <div key={c.label} className="stat-card flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-slate-900 dark:text-white leading-none">{c.value.toLocaleString()}</p>
                <p className="text-[11px] text-slate-400 mt-1">{c.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users by name, email or phone…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-neutral-800 rounded-2xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white dark:bg-neutral-950 shadow-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              showFilters ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-neutral-200'
            }`}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">User Type</label>
              <select value={userType} onChange={(e) => setUserType(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white">
                <option value="all">All</option>
                <option value="buyer">Buyers</option>
                <option value="seller">Sellers</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white">
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Verification</label>
              <select value={verification} onChange={(e) => setVerification(e.target.value as any)} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white">
                <option value="all">All</option>
                <option value="verified">Verified</option>
                <option value="unverified">Unverified</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Nairobi" className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white placeholder-slate-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase block mb-1">To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-sm text-slate-900 dark:text-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="data-table-wrapper">
          <div className="flex justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-slate-400 text-sm font-medium">Loading users…</p>
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
                  <th className="hidden md:table-cell">Email</th>
                  <th className="hidden lg:table-cell">Phone</th>
                  <th>Type</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th className="hidden sm:table-cell">Location</th>
                  <th className="hidden sm:table-cell">Registered</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-400 font-medium">No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColor(user.id)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm`}>
                            {(user.full_name || user.email || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white leading-tight">
                              {user.full_name || user.email?.split('@')[0] || 'Unknown'}
                            </p>
                            {user.business_name && <p className="text-xs text-slate-400 mt-0.5">{user.business_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <span className="text-gray-600 dark:text-neutral-300 text-sm">{user.email || '—'}</span>
                      </td>
                      <td className="hidden lg:table-cell">
                        <span className="text-gray-600 dark:text-neutral-300 text-sm font-mono">{user.phone || '—'}</span>
                      </td>
                      <td>
                        <span className={`badge ${user.is_admin ? 'badge-blue' : user.business_name ? 'badge-purple' : 'badge-gray'}`}>
                          {user.is_admin ? 'Admin' : user.business_name ? 'Seller' : 'Buyer'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className={`badge ${user.is_verified ? 'badge-green' : 'badge-gray'}`}>
                            {user.is_verified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                        <div className="flex gap-1 mt-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${user.email_verified ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-slate-400 bg-slate-50 dark:bg-neutral-900'}`}>Email</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${user.phone_verified ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'text-slate-400 bg-slate-50 dark:bg-neutral-900'}`}>Phone</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${user.is_suspended ? 'badge-red' : user.is_active ? 'badge-green' : 'badge-gray'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.is_suspended ? 'bg-red-500' : user.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {user.is_suspended ? 'Suspended' : user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-gray-500 dark:text-neutral-400 text-xs">{user.location || '—'}</span>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className="text-gray-500 dark:text-neutral-400 text-xs">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleStatus(user.id, user.is_active)}
                            title={user.is_active ? 'Deactivate' : 'Activate'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.is_active
                                ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
                                : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            {user.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(user.id, user.is_suspended)}
                            title={user.is_suspended ? 'Lift suspension' : 'Suspend'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              user.is_suspended ? 'text-emerald-500 hover:bg-emerald-50' : 'text-amber-500 hover:bg-amber-50'
                            }`}
                          >
                            {user.is_suspended ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            title="Delete user"
                            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-950/20 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing <span className="font-extrabold text-slate-600 dark:text-neutral-100">{users.length}</span> of{' '}
              <span className="font-extrabold text-slate-600 dark:text-neutral-100">{totalMatching.toLocaleString()}</span> matching users
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-500 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold text-slate-600 dark:text-neutral-200 px-2">Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalMatching}
                className="p-1.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-slate-500 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default UsersManagementPage;
