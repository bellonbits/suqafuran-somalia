import React from 'react';
import { SfRating } from '@storefront-ui/react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface SuqafuranRatingProps {
  value: number;
  max?: number;
  count?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCount?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'sm' as const,
  sm: 'sm' as const,
  md: 'base' as const,
  lg: 'lg' as const,
};

const TEXT_SIZE: Record<string, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const SuqafuranRating: React.FC<SuqafuranRatingProps> = ({
  value,
  max = 5,
  count,
  size = 'sm',
  showCount = true,
  className,
}) => {
  return (
    <div className={clsx('flex items-center gap-1', className)}>
      <SfRating
        value={value}
        max={max}
        size={SIZE_MAP[size]}
        className="text-amber-400 fill-amber-400"
      />
      <span className={clsx('font-bold text-gray-800 dark:text-neutral-100', TEXT_SIZE[size])}>
        {value.toFixed(1)}
      </span>
      {showCount && count !== undefined && (
        <span className={clsx('text-gray-500 dark:text-neutral-400', TEXT_SIZE[size])}>
          ({count.toLocaleString()})
        </span>
      )}
    </div>
  );
};

// Animated variant that pops in on mount
export const SuqafuranRatingAnimated: React.FC<SuqafuranRatingProps> = (props) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
  >
    <SuqafuranRating {...props} />
  </motion.div>
);
