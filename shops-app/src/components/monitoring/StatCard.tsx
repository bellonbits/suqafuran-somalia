'use client';

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  change?: number; // percentage change
  changeLabel?: string;
  status?: 'success' | 'warning' | 'critical' | 'neutral';
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  change,
  changeLabel,
  status = 'neutral',
  icon,
  trend,
}) => {
  const statusColors = {
    success: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
    warning: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300',
    critical: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
    neutral: 'bg-slate-50 dark:bg-neutral-950 text-slate-700 dark:text-neutral-200',
  };

  const trendColors = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className={`rounded-lg p-4 border border-opacity-20 ${statusColors[status]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-bold">{value}</p>
            {unit && <span className="text-sm opacity-75">{unit}</span>}
          </div>
          {change !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              <span className={`text-xs font-medium ${trendColors[trend || 'neutral']}`}>
                {change > 0 ? '+' : ''}{change}% {changeLabel || 'vs last period'}
              </span>
            </div>
          )}
        </div>
        {icon && <div className="text-2xl opacity-50">{icon}</div>}
      </div>
    </div>
  );
};
