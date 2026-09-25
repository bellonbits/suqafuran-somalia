/**
 * SuqafuranInput
 * Wraps Storefront UI's SfInput with Suqafuran brand theming.
 * Drop-in replacement wherever a styled <input> is needed.
 */
import React from 'react';
import { SfInput } from '@storefront-ui/react';
import { clsx } from 'clsx';

export interface SuqafuranInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'base' | 'lg';
  invalid?: boolean;
  slotPrefix?: React.ReactNode;
  slotSuffix?: React.ReactNode;
  wrapperClassName?: string;
}

export const SuqafuranInput = React.forwardRef<
  HTMLInputElement,
  SuqafuranInputProps
>(
  (
    {
      size = 'base',
      invalid = false,
      slotPrefix,
      slotSuffix,
      wrapperClassName,
      className,
      ...rest
    },
    ref,
  ) => {
    return (
      <SfInput
        ref={ref}
        size={size}
        invalid={invalid}
        slotPrefix={slotPrefix}
        slotSuffix={slotSuffix}
        wrapperClassName={clsx(
          // Override SFUI ring with Suqafuran primary
          'ring-primary focus-within:ring-primary',
          'rounded-xl bg-white dark:bg-neutral-950',
          'border border-gray-200 dark:border-neutral-800',
          'focus-within:border-primary',
          invalid && 'border-rose-500 ring-rose-500',
          wrapperClassName,
        )}
        className={clsx(
          'text-gray-900 dark:text-neutral-50 placeholder:text-gray-400',
          'bg-transparent outline-none w-full',
          className,
        )}
        {...rest}
      />
    );
  },
);

SuqafuranInput.displayName = 'SuqafuranInput';
