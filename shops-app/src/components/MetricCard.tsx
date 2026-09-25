"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendPercent?: number;
  color?: 'blue' | 'purple' | 'green' | 'red' | 'indigo' | 'orange';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subtext,
  trend,
  trendPercent,
  color = 'blue',
}) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
    red: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
    orange: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex items-center justify-between transition-all"
    >
      <div className="flex items-center gap-4">
        {/* Icon Pill */}
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${colorMap[color] || colorMap.blue}`}>
          <div className="w-5 h-5">{icon}</div>
        </div>

        {/* Content */}
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-neutral-400 mb-0.5">{label}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{value}</h3>
          </div>
          {subtext && <p className="text-[11px] text-slate-400 mt-0.5">{subtext}</p>}
        </div>
      </div>

      {/* Trend indicator arrow pill */}
      {trend && trendPercent !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-xl ${
          trend === 'up'
            ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
            : 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          <span>{trendPercent}%</span>
        </div>
      )}
    </motion.div>
  );
};

