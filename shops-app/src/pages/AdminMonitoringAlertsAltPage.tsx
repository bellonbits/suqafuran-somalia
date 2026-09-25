'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { Plus, Edit2, Trash2, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';
import { MonitoringLayout } from '@/components/monitoring/MonitoringLayout';
import { AlertRuleForm } from '@/components/monitoring/AlertRuleForm';
import { useAlertsStore } from '@/store/monitoring/useAlertsStore';
import { alertsService } from '@/services/alertsService';

export default function AlertsPage() {
  const store = useAlertsStore();
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'history'>('rules');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const loadRules = useCallback(async () => {
    store.setRulesLoading(true);
    try {
      const skip = (store.rulesPage - 1) * store.rulesLimit;
      const response = await alertsService.listRules(skip, store.rulesLimit);
      store.setRules(response.rules, response.total);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load rules';
      store.setRulesError(errorMsg);
    }
  }, [store]);

  const loadHistory = useCallback(async () => {
    store.setHistoryLoading(true);
    try {
      const skip = (store.historyPage - 1) * store.historyLimit;
      const response = await alertsService.getAlertHistory(
        skip,
        store.historyLimit,
        store.historyHours
      );
      store.setHistory(response.alerts, response.total);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load history';
      store.setHistoryError(errorMsg);
    }
  }, [store]);

  const loadStats = useCallback(async () => {
    store.setStatsLoading(true);
    try {
      const stats = await alertsService.getAlertStats(24);
      store.setStats(stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [store]);

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRules();
    } else {
      loadHistory();
    }
    loadStats();
  }, [activeTab, store.rulesPage, store.historyPage, store.historyHours, loadRules, loadHistory, loadStats]);

  const handleEdit = (rule: any) => {
    store.setEditingRule(rule);
    store.setEditMode('edit');
    setShowForm(true);
  };

  const handleCreate = () => {
    store.setEditingRule(null);
    store.setEditMode('create');
    setShowForm(true);
  };

  const handleDelete = async (ruleId: number) => {
    try {
      await alertsService.deleteRule(ruleId);
      loadRules();
      setDeleteConfirm(null);
    } catch (error) {
      alert('Failed to delete rule');
    }
  };

  const handleResolveAlert = async (alertId: number) => {
    try {
      await alertsService.resolveAlert(alertId);
      loadHistory();
    } catch (error) {
      alert('Failed to resolve alert');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    store.setEditingRule(null);
    store.setSaveSuccess(null);
    store.setSaveError(null);
  };

  const rulesPageCount = Math.ceil(store.totalRules / store.rulesLimit);
  const historyPageCount = Math.ceil(store.totalHistory / store.historyLimit);

  return (
    <MonitoringLayout>
      <div className="space-y-6">
        {/* Stats */}
        {store.stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1">Active Rules</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{store.stats.active_rules}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1">Firing Alerts</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{store.stats.firing_alerts}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1">Resolved</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{store.stats.resolved_alerts}</p>
            </div>
            <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800 p-4">
              <p className="text-sm font-medium text-slate-600 dark:text-neutral-300 mb-1">Total (24h)</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{store.stats.total_alerts}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-slate-200 dark:border-neutral-800">
          <div className="flex gap-0 border-b border-slate-200 dark:border-neutral-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('rules')}
              className={`flex-1 px-4 sm:px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'rules'
                  ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100'
              }`}
            >
              Alert Rules
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 px-4 sm:px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap ${
                activeTab === 'history'
                  ? 'text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                  : 'text-slate-600 dark:text-neutral-300 hover:text-slate-900 dark:hover:text-neutral-100'
              }`}
            >
              Alert History
            </button>
          </div>

          {/* Rules Tab */}
          {activeTab === 'rules' && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Rule
                </button>
              </div>

              {store.rulesError && (
                <div className="flex gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">{store.rulesError}</p>
                </div>
              )}

              {store.rulesLoading && (
                <div className="flex items-center justify-center h-40">
                  <Loader className="h-8 w-8 animate-spin text-orange-600" />
                </div>
              )}

              {!store.rulesLoading && store.rules.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-600 dark:text-neutral-300">No alert rules yet</p>
                </div>
              )}

              {!store.rulesLoading && store.rules.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Rule</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white hidden sm:table-cell">Metric</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white hidden md:table-cell">Condition</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white">Severity</th>
                        <th className="px-4 py-3 text-left font-semibold text-slate-900 dark:text-white hidden sm:table-cell">Status</th>
                        <th className="px-4 py-3 text-center font-semibold text-slate-900 dark:text-white">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-neutral-800">
                      {store.rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50 dark:hover:bg-neutral-900">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900 dark:text-white text-sm">{rule.name}</p>
                            {rule.description && (
                              <p className="text-xs text-slate-500 dark:text-neutral-300 mt-1 line-clamp-1">{rule.description}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-neutral-300 hidden sm:table-cell">
                            {rule.metric}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600 dark:text-neutral-300 hidden md:table-cell">
                            {rule.comparison_operator} {rule.threshold}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                rule.severity === 'critical'
                                  ? 'bg-rose-50 dark:bg-rose-950/30 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : rule.severity === 'warning'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : 'bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}
                            >
                              {rule.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                rule.enabled
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 dark:bg-gray-900 dark:text-gray-200'
                              }`}
                            >
                              {rule.enabled ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-2">
                              <button
                                onClick={() => handleEdit(rule)}
                                className="p-1 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
                                title="Edit rule"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(rule.id)}
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                title="Delete rule"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {deleteConfirm === rule.id && (
                              <div className="absolute mt-2 bg-white dark:bg-neutral-900 rounded shadow-lg p-2 text-xs space-y-2 z-50">
                                <p className="text-slate-700 dark:text-neutral-200">Delete this rule?</p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(null)}
                                    className="px-2 py-1 bg-slate-300 dark:bg-neutral-700 rounded hover:bg-slate-400 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {rulesPageCount > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 text-xs sm:text-sm">
                  <p className="text-slate-600 dark:text-neutral-300">
                    Showing {(store.rulesPage - 1) * store.rulesLimit + 1}-
                    {Math.min(store.rulesPage * store.rulesLimit, store.totalRules)} of {store.totalRules}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => store.setRulesPage(Math.max(1, store.rulesPage - 1))}
                      disabled={store.rulesPage === 1}
                      className="p-2 rounded border border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => store.setRulesPage(Math.min(rulesPageCount, store.rulesPage + 1))}
                      disabled={store.rulesPage === rulesPageCount}
                      className="p-2 rounded border border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-neutral-200">Lookback Period</label>
                  <select
                    value={store.historyHours}
                    onChange={(e) => store.setHistoryHours(parseInt(e.target.value))}
                    className="mt-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white text-sm"
                  >
                    <option value={1}>Last 1 hour</option>
                    <option value={6}>Last 6 hours</option>
                    <option value={24}>Last 24 hours</option>
                    <option value={168}>Last 7 days</option>
                  </select>
                </div>
              </div>

              {store.historyError && (
                <div className="flex gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800 dark:text-red-300">{store.historyError}</p>
                </div>
              )}

              {store.historyLoading && (
                <div className="flex items-center justify-center h-40">
                  <Loader className="h-8 w-8 animate-spin text-orange-600" />
                </div>
              )}

              {!store.historyLoading && store.history.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-600 dark:text-neutral-300">No alerts in this period</p>
                </div>
              )}

              {!store.historyLoading && store.history.length > 0 && (
                <div className="space-y-2">
                  {store.history.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 rounded-xl border ${
                        alert.status === 'firing'
                          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs px-2 py-1 rounded font-medium ${
                                alert.status === 'firing'
                                  ? 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-200'
                                  : 'bg-green-200 text-green-800 dark:bg-green-900 dark:text-green-200'
                              }`}
                            >
                              {alert.status === 'firing' ? 'Firing' : 'Resolved'}
                            </span>
                            {alert.value !== undefined && (
                              <span className="text-xs font-mono text-slate-600 dark:text-neutral-300">
                                Value: {alert.value.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {alert.message && (
                            <p className="text-sm text-slate-700 dark:text-neutral-200 mt-2 line-clamp-2">{alert.message}</p>
                          )}
                          <p className="text-xs text-slate-500 dark:text-neutral-300 mt-1">
                            {new Date(alert.fired_at).toLocaleString()}
                          </p>
                        </div>

                        {alert.status === 'firing' && (
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="mt-2 sm:mt-0 w-full sm:w-auto px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {historyPageCount > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 text-xs sm:text-sm">
                  <p className="text-slate-600 dark:text-neutral-300">
                    Showing {(store.historyPage - 1) * store.historyLimit + 1}-
                    {Math.min(store.historyPage * store.historyLimit, store.totalHistory)} of {store.totalHistory}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => store.setHistoryPage(Math.max(1, store.historyPage - 1))}
                      disabled={store.historyPage === 1}
                      className="p-2 rounded border border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => store.setHistoryPage(Math.min(historyPageCount, store.historyPage + 1))}
                      disabled={store.historyPage === historyPageCount}
                      className="p-2 rounded border border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alert Rule Form Modal */}
      {showForm && (
        <AlertRuleForm
          rule={store.editingRule}
          onClose={handleCloseForm}
          onSuccess={loadRules}
        />
      )}
    </MonitoringLayout>
  );
}
