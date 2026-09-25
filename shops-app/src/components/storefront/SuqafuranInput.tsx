import React, { forwardRef } from 'react';
import { SfInput } from '@storefront-ui/react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface SuqafuranInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  slotPrefix?: React.ReactNode;
  slotSuffix?: React.ReactNode;
  wrapperClassName?: string;
}

export const SuqafuranInput = forwardRef<HTMLInputElement, SuqafuranInputProps>(
  ({ label, error, hint, slotPrefix, slotSuffix, wrapperClassName, className, id, ...rest }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={clsx('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-gray-700 dark:text-neutral-300 tracking-wide uppercase"
          >
            {label}
          </label>
        )}

        <motion.div
          animate={error ? { x: [-4, 4, -3, 3, 0] } : {}}
          transition={{ duration: 0.35 }}
        >
          <SfInput
            ref={ref as any}
            id={inputId}
            slotPrefix={slotPrefix}
            slotSuffix={slotSuffix}
            invalid={!!error}
            className={clsx(
              '!rounded-xl !border !bg-white dark:!bg-neutral-900 !text-gray-900 dark:!text-white !text-sm !font-medium !px-4 !py-3 !h-12',
              '!transition-all !duration-200',
              error
                ? '!border-red-400 !ring-1 !ring-red-400 focus:!ring-red-400'
                : '!border-gray-200 dark:!border-neutral-700 focus:!border-sky-400 focus:!ring-1 focus:!ring-sky-400',
              '!placeholder-gray-400 dark:!placeholder-neutral-500',
              'focus:!outline-none',
              className
            )}
            {...(rest as any)}
          />
        </motion.div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs text-red-500 font-medium"
          >
            {error}
          </motion.p>
        )}
        {hint && !error && (
          <p className="text-xs text-gray-500 dark:text-neutral-400">{hint}</p>
        )}
      </div>
    );
  }
);

SuqafuranInput.displayName = 'SuqafuranInput';
