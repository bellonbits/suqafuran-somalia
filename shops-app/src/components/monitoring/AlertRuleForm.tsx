'use client';

import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { useAlertsStore } from '../../store/monitoring/useAlertsStore';
import { alertsService } from '../../services/alertsService';
import type { AlertRule } from '../../store/monitoring/useAlertsStore';

interface AlertRuleFormProps {
  rule?: AlertRule | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const METRICS = [
  { value: 'notification_failure_rate', label: 'Notification Failure Rate (%)' },
  { value: 'kafka_lag', label: 'Kafka Consumer Lag' },
  { value: 'error_rate', label: 'Error Rate (%)' },
  { value: 'queue_depth', label: 'Queue Depth' },
  { value: 'payment_failures', label: 'Payment Failures (count)' },
];

const OPERATORS = [
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '>=', label: 'Greater or equal (>=)' },
  { value: '<=', label: 'Less or equal (<=)' },
  { value: '==', label: 'Equals (==)' },
];

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export const AlertRuleForm: React.FC<AlertRuleFormProps> = ({ rule, onClose, onSuccess }) => {
  const store = useAlertsStore();
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    metric: rule?.metric || 'notification_failure_rate',
    threshold: rule?.threshold || 0,
    comparison_operator: rule?.comparison_operator || '>',
    evaluation_window_minutes: rule?.evaluation_window_minutes || 5,
    aggregation_function: rule?.aggregation_function || 'avg',
    notification_channel: rule?.notification_channel || '',
    notification_target: rule?.notification_target || '',
    severity: rule?.severity || 'warning',
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      store.setSaveError('Rule name is required');
      return;
    }

    if (formData.threshold < 0) {
      store.setSaveError('Threshold must be non-negative');
      return;
    }

    store.setSaveLoading(true);

    try {
      if (rule) {
        // Update
        await alertsService.updateRule(rule.id, formData);
        store.setSaveSuccess('Alert rule updated successfully');
      } else {
        // Create
        await alertsService.createRule(formData);
        store.setSaveSuccess('Alert rule created successfully');
      }

      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to save rule';
      store.setSaveError(errorMsg);
    } finally {
      store.setSaveLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-neutral-950 rounded-lg max-w-2xl w-full shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800 sticky top-0 bg-white dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
              Rule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., High Notification Failure Rate"
              maxLength={255}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe when this alert should trigger..."
              rows={2}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Metric Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Metric *
              </label>
              <select
                value={formData.metric}
                onChange={(e) => handleChange('metric', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Operator *
              </label>
              <select
                value={formData.comparison_operator}
                onChange={(e) => handleChange('comparison_operator', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Threshold Value *
              </label>
              <input
                type="number"
                value={formData.threshold}
                onChange={(e) => handleChange('threshold', parseFloat(e.target.value))}
                step="0.1"
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                Severity *
              </label>
              <select
                value={formData.severity}
                onChange={(e) => handleChange('severity', e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Advanced Settings */}
          <details className="pt-2">
            <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-neutral-200">
              Advanced Settings
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Evaluation Window (minutes)
                </label>
                <input
                  type="number"
                  value={formData.evaluation_window_minutes}
                  onChange={(e) => handleChange('evaluation_window_minutes', parseInt(e.target.value))}
                  min="1"
                  max="60"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Aggregation Function
                </label>
                <select
                  value={formData.aggregation_function}
                  onChange={(e) => handleChange('aggregation_function', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="avg">Average</option>
                  <option value="max">Maximum</option>
                  <option value="min">Minimum</option>
                  <option value="sum">Sum</option>
                  <option value="count">Count</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Notification Channel
                </label>
                <input
                  type="text"
                  value={formData.notification_channel}
                  onChange={(e) => handleChange('notification_channel', e.target.value)}
                  placeholder="e.g., email, slack"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Notification Target
                </label>
                <input
                  type="text"
                  value={formData.notification_target}
                  onChange={(e) => handleChange('notification_target', e.target.value)}
                  placeholder="e.g., admin@example.com"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </details>

          {/* Messages */}
          {store.saveSuccess && (
            <div className="flex gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
              <p className="text-sm text-green-800 dark:text-green-300">{store.saveSuccess}</p>
            </div>
          )}

          {store.saveError && (
            <div className="flex gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">{store.saveError}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-neutral-800 sticky bottom-0 bg-white dark:bg-neutral-950">
          <button
            onClick={onClose}
            disabled={store.saveLoading}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-900 disabled:opacity-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={store.saveLoading || !formData.name.trim()}
            className="flex-1 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-medium transition-colors disabled:opacity-50"
          >
            {store.saveLoading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
};
