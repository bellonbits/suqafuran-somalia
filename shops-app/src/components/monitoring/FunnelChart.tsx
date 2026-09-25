'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface FunnelStage {
  name: string;
  count: number;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  title?: string;
  height?: number;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
  stages,
  title = 'Notification Funnel',
  height = 300,
}) => {
  if (stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50 dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800">
        <p className="text-slate-500 dark:text-neutral-300">No data available</p>
      </div>
    );
  }

  // Calculate drop-off percentages
  const maxCount = Math.max(...stages.map((s) => s.count));
  const dataWithDropoff = stages.map((stage, index) => {
    const previousCount = index === 0 ? stages[0].count : stages[index - 1].count;
    const dropoffPercent = previousCount > 0
      ? ((previousCount - stage.count) / previousCount * 100).toFixed(1)
      : '0';
    return {
      ...stage,
      percentage: ((stage.count / maxCount) * 100).toFixed(0),
      dropoff: dropoffPercent,
    };
  });

  return (
    <div className="bg-white dark:bg-neutral-950 rounded-lg border border-slate-200 dark:border-neutral-800 p-6">
      {title && (
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={dataWithDropoff}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#64748b"
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#f1f5f9',
            }}
            formatter={(value) => {
              if (typeof value === 'number') {
                return value.toLocaleString();
              }
              return value;
            }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Bar
            dataKey="count"
            fill="#f97316"
            radius={[8, 8, 0, 0]}
            animationDuration={300}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Dropoff summary */}
      <div className="mt-6 space-y-2">
        <h4 className="text-sm font-semibold text-slate-700 dark:text-neutral-200">
          Drop-off at Each Stage
        </h4>
        <div className="space-y-1">
          {dataWithDropoff.map((stage, index) => (
            <div key={stage.name} className="flex justify-between text-xs text-slate-600 dark:text-neutral-300">
              <span>
                {stage.name} {index > 0 && `→ ${stage.dropoff}% loss`}
              </span>
              <span className="font-medium">{stage.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
