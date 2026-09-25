import React from 'react';
import { SfButton } from '@storefront-ui/react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface SuqafuranButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white border-transparent shadow-[0_2px_12px_rgba(14,165,233,0.35)] hover:shadow-[0_4px_20px_rgba(14,165,233,0.5)]',
  secondary:
    'bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-800',
  ghost:
    'bg-transparent border border-transparent text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-500/10',
  danger:
    'bg-red-500 hover:bg-red-600 text-white border-transparent shadow-[0_2px_12px_rgba(239,68,68,0.3)]',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold rounded-lg',
  md: 'px-5 py-2.5 text-sm font-bold rounded-xl',
  lg: 'px-7 py-3.5 text-base font-bold rounded-2xl',
};

export const SuqafuranButton: React.FC<SuqafuranButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  children,
  className,
  disabled,
  ...rest
}) => {
  return (
    <motion.div
      whileTap={{ scale: disabled || loading ? 1 : 0.97 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={fullWidth ? 'w-full' : 'inline-block'}
    >
      <SfButton
        {...(rest as any)}
        disabled={disabled || loading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 transition-all duration-200 border outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          fullWidth && 'w-full',
          (disabled || loading) && 'opacity-50 cursor-not-allowed',
          className
        )}
        slotPrefix={
          loading ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : icon ? (
            icon
          ) : undefined
        }
        slotSuffix={iconRight}
      >
        {children}
      </SfButton>
    </motion.div>
  );
};
