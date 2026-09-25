'use client';

import React from 'react';
import { AlertCircle, Check, Info, AlertTriangle, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertMessageProps {
  type: AlertType;
  message: string;
  title?: string;
  onClose?: () => void;
  autoClose?: boolean;
  autoCloseDuration?: number;
}

export const AlertMessage: React.FC<AlertMessageProps> = ({
  type,
  message,
  title,
  onClose,
  autoClose = false,
  autoCloseDuration = 4000,
}) => {
  const [visible, setVisible] = React.useState(true);

  React.useEffect(() => {
    if (autoClose && autoCloseDuration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onClose?.();
      }, autoCloseDuration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, autoCloseDuration, onClose]);

  if (!visible) return null;

  const styles = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-300',
      title: 'text-green-900 dark:text-green-200',
      icon: 'text-green-600 dark:text-green-400',
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      title: 'text-red-900 dark:text-red-200',
      icon: 'text-red-600 dark:text-red-400',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-700 dark:text-yellow-300',
      title: 'text-yellow-900 dark:text-yellow-200',
      icon: 'text-yellow-600 dark:text-yellow-400',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-300',
      title: 'text-blue-900 dark:text-blue-200',
      icon: 'text-blue-600 dark:text-blue-400',
    },
  };

  const style = styles[type];

  const IconComponent = {
    success: Check,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }[type];

  return (
    <div className={`p-4 rounded-lg border ${style.bg} ${style.border} flex gap-3`}>
      <IconComponent className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
      <div className="flex-1">
        {title && <p className={`font-bold ${style.title} mb-1`}>{title}</p>}
        <p className={`text-sm ${style.text}`}>{message}</p>
      </div>
      {onClose && (
        <button
          onClick={() => {
            setVisible(false);
            onClose();
          }}
          className={`flex-shrink-0 ${style.icon} hover:opacity-70 transition-opacity`}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};
