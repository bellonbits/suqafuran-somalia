'use client';

import React from 'react';
import { AlertCircle, Check, AlertTriangle } from 'lucide-react';

interface TopicStatusBadgeProps {
  status: 'healthy' | 'lagging' | 'stalled';
  consumerLag: number;
  className?: string;
}

export const TopicStatusBadge: React.FC<TopicStatusBadgeProps> = ({
  status,
  consumerLag,
  className = '',
}) => {
  const statusConfig = {
    healthy: {
      icon: Check,
      bgColor: 'bg-green-100 dark:bg-green-900',
      textColor: 'text-green-700 dark:text-green-200',
      label: 'Healthy',
    },
    lagging: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900',
      textColor: 'text-yellow-700 dark:text-yellow-200',
      label: 'Lagging',
    },
    stalled: {
      icon: AlertCircle,
      bgColor: 'bg-red-100 dark:bg-red-900',
      textColor: 'text-red-700 dark:text-red-200',
      label: 'Stalled',
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${config.bgColor} ${config.textColor} ${className}`}
      title={`Status: ${config.label} | Lag: ${consumerLag} messages`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      {consumerLag > 0 && <span className="text-xs opacity-75">({consumerLag})</span>}
    </div>
  );
};
