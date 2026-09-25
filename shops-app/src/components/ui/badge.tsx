/**
 * SuqafuranBadge
 * Thin Suqafuran wrapper over Storefront UI's SfBadge.
 * Maps our existing badge-* CSS class semantics to SFUI.
 */
import React from 'react';
import { SfBadge } from '@storefront-ui/react';
import { clsx } from 'clsx';

type BadgeColor = 'primary' | 'green' | 'yellow' | 'red' | 'blue' | 'gray' | 'orange' | 'purple';

interface SuqafuranBadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  className?: string;
  /** Render as a dot (no children visible) */
  dot?: boolean;
  content?: number | string;
}

const colorClasses: Record<BadgeColor, string> = {
  primary: 'bg-primary/10 text-primary-700 dark:bg-primary/20 dark:text-primary-300',
  green:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400',
  yellow:  'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  red:     'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400',
  blue:    'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400',
  gray:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  orange:  'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  purple:  'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
};

export const SuqafuranBadge: React.FC<SuqafuranBadgeProps> = ({
  children,
  color = 'primary',
  className,
  content,
}) => {
  if (content !== undefined) {
    return (
      <SfBadge
        content={content}
        className={clsx(
          'text-[10px] font-black',
          'bg-primary text-white',
          className,
        )}
      />
    );
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-2xl text-[11px] font-bold whitespace-nowrap',
        colorClasses[color],
        className,
      )}
    >
      {children}
    </span>
  );
};
