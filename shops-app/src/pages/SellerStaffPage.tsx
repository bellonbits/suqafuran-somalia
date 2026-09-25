"use client";

import React, { useState, useEffect } from 'react';
import {
  UserPlus, Trash2, Shield, Package, MessageSquare,
  ShoppingCart, Crown, Users, Loader, Mail, X, AlertCircle, CheckCircle2
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/store/useAuth';
import { PlanGate } from '@/components/seller/PlanGate';

type StaffRole = 'manager' | 'sales' | 'inventory';

interface StaffMember {
  id: number;
  email: string;
  name: string;
  role: StaffRole;
  last_active?: string;
  invited_at: string;
  status: 'active' | 'pending';
}

interface FeatureInfo {
  max_staff: number;
  plan_name: string;
}

const ROLE_CONFIG: Record<StaffRole, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; perms: string[] }> = {
  manager: {
    label: 'Manager',
    icon: Shield,
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    perms: ['Manage products & orders', 'Reply to messages', 'Update stock'],
  },
  sales: {
    label: 'Salesperson',
    icon: MessageSquare,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    perms: ['Reply to messages', 'View orders', 'View products'],
  },
  inventory: {
    label: 'Inventory',
    icon: Package,
    color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    perms: ['Update stock only', 'View products'],
  },
};

const PERMISSION_MATRIX = [
  { action: 'Manage products', manager: true, sales: false, inventory: false },
  { action: 'Manage orders', manager: true, sales: false, inventory: false },
  { action: 'Reply to messages', manager: true, sales: true, inventory: false },
  { action: 'Update stock', manager: true, sales: false, inventory: true },
  { action: 'View analytics', manager: true, sales: false, inventory: false },
  { action: 'View products', manager: true, sales: true, inventory: true },
];

function InviteModal({
  onClose, onInvited, currentCount, maxStaff,
}: {
  onClose: () => void;
  onInvited: () => void;
  currentCount: number;
  maxStaff: number;
}) {
  const [form, setForm] = useState({ email: '', role: 'sales' as StaffRole });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canInvite = currentCount < maxStaff;

  const handleInvite = async () => {
    if (!form.email.trim()) { setError('Please enter an email address.'); return; }
    if (!canInvite) { setError(`You've reached the staff limit (${maxStaff}) for your plan.`); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/sellers/me/staff', { email: form.email.trim(), role: form.role });
      onInvited();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to invite staff member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">Invite Staff Member</h2>
            <p className="text-sm text-gray-500 dark:text-neutral-300 mt-0.5">{currentCount} / {maxStaff} staff used</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!canInvite && (
            <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              You've reached your staff limit. Upgrade to add more.
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@example.com"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Role</label>
            <div className="space-y-2">
              {(Object.keys(ROLE_CONFIG) as StaffRole[]).map((role) => {
                const config = ROLE_CONFIG[role];
                const Icon = config.icon;
                return (
                  <button
                    key={role}
                    onClick={() => setForm({ ...form, role })}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      form.role === role
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                        : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{config.label}</p>
                      <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">{config.perms.join(' · ')}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-200">
            Cancel
          </button>
          <button
            onClick={handleInvite}
            disabled={saving || !canInvite}
            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invite
          </button>
        </div>
      </div>
    </div>
  );
}

function StaffContent({ maxStaff }: { maxStaff: number }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sellers/me/staff').catch(() => null);
      setStaff(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: number) => {
    setRemovingId(id);
    try {
      await api.delete(`/sellers/me/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Remove failed:', err);
    } finally {
      setRemovingId(null);
    }
  };

  const usedSlots = staff.length;
  const pct = Math.round((usedSlots / maxStaff) * 100);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Staff Accounts</h1>
          <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1">
            Invite your team members and assign them roles
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          Invite Staff
        </button>
      </div>

      {/* Usage bar */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200">Staff Slots Used</p>
          <p className="text-sm font-black text-gray-900 dark:text-white">{usedSlots} / {maxStaff}</p>
        </div>
        <div className="h-2.5 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-orange-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 dark:text-neutral-400 mt-1.5">{maxStaff - usedSlots} slots remaining</p>
      </div>

      {/* Staff list */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800">
        <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <h2 className="font-black text-gray-900 dark:text-white">Team Members</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <>
            {/* Owner row */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">You (Owner)</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-300">Full access to all features</p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 font-bold">
                Owner
              </span>
            </div>

            {staff.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="w-14 h-14 bg-gray-100 dark:bg-neutral-900 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-gray-300 dark:text-neutral-300" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white mb-1">No staff members yet</p>
                <p className="text-sm text-gray-500 dark:text-neutral-300 mb-5">
                  Invite team members to help manage your shop
                </p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" /> Invite First Member
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                {staff.map((member) => {
                  const roleConf = ROLE_CONFIG[member.role];
                  const Icon = roleConf.icon;
                  return (
                    <div key={member.id} className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${roleConf.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{member.name || member.email}</p>
                            {member.status === 'pending' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-semibold">
                                Pending
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5">
                            {member.email} · {roleConf.label}
                            {member.last_active && ` · Last active ${new Date(member.last_active).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removingId === member.id}
                        className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        {removingId === member.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Permissions table */}
      <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="font-black text-gray-900 dark:text-white">Role Permissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-neutral-900">
                <th className="text-left py-3 px-5 text-xs font-bold text-gray-500 dark:text-neutral-300">Permission</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-purple-600 dark:text-purple-400">Manager</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-blue-600 dark:text-blue-400">Sales</th>
                <th className="text-center py-3 px-4 text-xs font-bold text-green-600 dark:text-green-400">Inventory</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row) => (
                <tr key={row.action} className="border-t border-gray-100 dark:border-neutral-800">
                  <td className="py-3 px-5 text-gray-700 dark:text-neutral-200">{row.action}</td>
                  {(['manager', 'sales', 'inventory'] as StaffRole[]).map((role) => (
                    <td key={role} className="text-center py-3 px-4">
                      {row[role] ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-gray-300 dark:text-neutral-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvited={loadStaff}
          currentCount={usedSlots}
          maxStaff={maxStaff}
        />
      )}
    </div>
  );
}

function StaffPageWithPlanCheck() {
  const { user } = useAuthStore();
  const [maxStaff, setMaxStaff] = useState(3);
  const [planChecked, setPlanChecked] = useState(false);
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    if (!user) return;
    api.get(`/subscriptions/sellers/${user.id}/features`).then((res) => {
      setMaxStaff(res.data?.max_staff || 3);
      setPlanName(res.data?.plan_name || 'free');
    }).catch(() => {}).finally(() => setPlanChecked(true));
  }, [user]);

  // For enterprise (10 staff) or business (3 staff)
  const requiredPlan = maxStaff >= 10 ? 'enterprise' : 'business';

  return (
    <PlanGate
      requiredPlan="business"
      featureName="Staff Accounts"
      featureDescription="Invite team members — managers, salespeople, and inventory staff — and control what each can access."
    >
      <StaffContent maxStaff={maxStaff} />
    </PlanGate>
  );
}

export default StaffPageWithPlanCheck;
