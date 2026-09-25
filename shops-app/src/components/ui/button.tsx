/**
 * SuqafuranButton
 * ---------------
 * Suqafuran-branded button that wraps Storefront UI's SfButton primitive.
 * All existing callers that import from `src/components/ui/button` keep working
 * via the re-exported `Button` alias.
 *
 * Usage:
 *   import { SuqafuranButton } from '@/components/ui/SuqafuranButton';
 *   // or the compat alias:
 *   import { Button } from '@/components/ui/button';
 */
import React from 'react';
import { SfButton, SfIconClose } from '@storefront-ui/react';
import { clsx } from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface SuqafuranButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** When true, renders only the icon (square, no padding change) */
  iconOnly?: boolean;
  slotPrefix?: React.ReactNode;
  slotSuffix?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary hover:bg-primary-600 active:bg-primary-700 text-white shadow-sm active:scale-[.97] transition-all duration-150 border-transparent',
  secondary:
    'bg-secondary-100 hover:bg-secondary-200 active:bg-secondary-300 text-secondary-800 dark:bg-secondary-800 dark:hover:bg-secondary-700 dark:text-secondary-100 border-transparent',
  outline:
    'border border-gray-300 dark:border-neutral-700 bg-transparent text-gray-800 dark:text-neutral-100 hover:bg-gray-50 dark:hover:bg-neutral-900 active:bg-gray-100 dark:active:bg-neutral-800',
  ghost:
    'border-transparent bg-transparent text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900 active:bg-gray-200',
  danger:
    'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white border-transparent shadow-sm',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const SuqafuranButton = React.forwardRef<
  HTMLButtonElement,
  SuqafuranButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      iconOnly,
      slotPrefix,
      slotSuffix,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    return (
      <SfButton
        ref={ref}
        className={clsx(
          // Base
          'inline-flex items-center justify-center gap-2 font-semibold rounded-xl',
          'cursor-pointer select-none transition-colors duration-150',
          'disabled:opacity-50 disabled:pointer-events-none',
          // Variant + size tokens
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        disabled={disabled || loading}
        slotPrefix={
          loading ? (
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          ) : (
            slotPrefix
          )
        }
        slotSuffix={slotSuffix}
        {...rest}
      >
        {children}
      </SfButton>
    );
  },
);

SuqafuranButton.displayName = 'SuqafuranButton';

// ── Legacy compat alias ───────────────────────────────────────────────────────
export { SuqafuranButton as Button };
