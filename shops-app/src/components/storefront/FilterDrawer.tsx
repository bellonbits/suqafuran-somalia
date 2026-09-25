/**
 * FilterDrawer
 *
 * Mobile-first filter panel for the Suqafuran marketplace.
 * Built on Storefront UI primitives:
 *   SfDrawer, SfButton, SfCheckbox, SfRadio, SfInput, SfSelect, SfDivider
 * with Framer Motion for the drawer slide and item stagger.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  SfButton,
  SfCheckbox,
  SfInput,
  SfIconClose,
  SfIconTune,
  SfSelect,
} from '@storefront-ui/react';
import { clsx } from 'clsx';

export interface FilterState {
  condition: string[];
  priceMin: string;
  priceMax: string;
  location: string;
  sortBy: string;
  verifiedOnly: boolean;
}

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  onApply: () => void;
  totalResults?: number;
}

const CONDITIONS = ['new', 'used', 'refurbished'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'popular', label: 'Most Popular' },
];

const SOMALIA_REGIONS = [
  'Mogadishu', 'Hargeisa', 'Bosaso', 'Kismayo', 'Garowe',
  'Baidoa', 'Beledweyne', 'Jowhar', 'Marka', 'Berbera',
  'Burao', 'Galkayo', 'Dhusamareb',
];

const drawerVariants: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0, transition: { type: 'spring', stiffness: 280, damping: 28 } },
  exit: { x: '100%', transition: { duration: 0.22, ease: 'easeIn' } },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.04, duration: 0.25, ease: 'easeOut' },
  }),
};

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  onChange,
  onApply,
  totalResults,
}) => {
  const setCondition = (cond: string, checked: boolean) => {
    const next = checked
      ? [...filters.condition, cond]
      : filters.condition.filter((c) => c !== cond);
    onChange({ ...filters, condition: next });
  };

  const activeCount = [
    filters.condition.length > 0,
    filters.priceMin || filters.priceMax,
    filters.location,
    filters.verifiedOnly,
    filters.sortBy !== 'newest',
  ].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────── */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* ── Drawer panel ─────────────────────────────────────────── */}
          <motion.aside
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm bg-white dark:bg-neutral-950 shadow-2xl flex flex-col"
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal
            aria-label="Filter listings"
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <SfIconTune className="text-sky-500" />
                <h2 className="font-black text-gray-900 dark:text-white text-lg">Filters</h2>
                {activeCount > 0 && (
                  <span className="bg-sky-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                    {activeCount}
                  </span>
                )}
              </div>
              <SfButton
                variant="tertiary"
                size="sm"
                onClick={onClose}
                className="!rounded-full !w-9 !h-9 !p-0"
                aria-label="Close"
              >
                <SfIconClose />
              </SfButton>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">

              {/* Sort By */}
              <motion.section variants={itemVariants} custom={0} initial="hidden" animate="visible">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 mb-3">
                  Sort By
                </h3>
                <SfSelect
                  value={filters.sortBy}
                  onChange={(e) => onChange({ ...filters, sortBy: e.target.value })}
                  className="!w-full !rounded-xl !border-gray-200 dark:!border-neutral-700 !bg-white dark:!bg-neutral-900 !text-sm !font-medium"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </SfSelect>
              </motion.section>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-neutral-800" />

              {/* Price Range */}
              <motion.section variants={itemVariants} custom={1} initial="hidden" animate="visible">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 mb-3">
                  Price Range (USD)
                </h3>
                <div className="flex gap-3 items-center">
                  <SfInput
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin}
                    onChange={(e) => onChange({ ...filters, priceMin: e.target.value })}
                    slotPrefix={<span className="text-gray-400 text-xs">$</span>}
                    className="!rounded-xl !border-gray-200 dark:!border-neutral-700 !bg-white dark:!bg-neutral-900 !text-sm"
                  />
                  <span className="text-gray-400 text-sm shrink-0">—</span>
                  <SfInput
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax}
                    onChange={(e) => onChange({ ...filters, priceMax: e.target.value })}
                    slotPrefix={<span className="text-gray-400 text-xs">$</span>}
                    className="!rounded-xl !border-gray-200 dark:!border-neutral-700 !bg-white dark:!bg-neutral-900 !text-sm"
                  />
                </div>
              </motion.section>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-neutral-800" />

              {/* Condition */}
              <motion.section variants={itemVariants} custom={2} initial="hidden" animate="visible">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 mb-3">
                  Condition
                </h3>
                <div className="space-y-2.5">
                  {CONDITIONS.map((cond) => (
                    <label
                      key={cond}
                      className="flex items-center gap-3 cursor-pointer group"
                    >
                      <SfCheckbox
                        checked={filters.condition.includes(cond)}
                        onChange={(e) => setCondition(cond, e.target.checked)}
                        className="accent-sky-500"
                      />
                      <span className="text-sm font-medium capitalize text-gray-700 dark:text-neutral-200 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {cond}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.section>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-neutral-800" />

              {/* Location */}
              <motion.section variants={itemVariants} custom={3} initial="hidden" animate="visible">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-neutral-400 mb-3">
                  Location
                </h3>
                <SfSelect
                  value={filters.location}
                  onChange={(e) => onChange({ ...filters, location: e.target.value })}
                  className="!w-full !rounded-xl !border-gray-200 dark:!border-neutral-700 !bg-white dark:!bg-neutral-900 !text-sm !font-medium"
                >
                  <option value="">All Somalia</option>
                  {SOMALIA_REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </SfSelect>
              </motion.section>

              {/* Divider */}
              <div className="h-px bg-gray-100 dark:bg-neutral-800" />

              {/* Verified sellers */}
              <motion.section variants={itemVariants} custom={4} initial="hidden" animate="visible">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <SfCheckbox
                    checked={filters.verifiedOnly}
                    onChange={(e) => onChange({ ...filters, verifiedOnly: e.target.checked })}
                    className="accent-sky-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-sky-600 transition-colors">
                      Verified Sellers Only
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                      ID-verified sellers in Somalia
                    </p>
                  </div>
                </label>
              </motion.section>
            </div>

            {/* ── Footer ─────────────────────────────────────────────── */}
            <div className="px-5 py-4 border-t border-gray-100 dark:border-neutral-800 flex gap-3">
              <SfButton
                variant="secondary"
                size="lg"
                onClick={() =>
                  onChange({
                    condition: [],
                    priceMin: '',
                    priceMax: '',
                    location: '',
                    sortBy: 'newest',
                    verifiedOnly: false,
                  })
                }
                className="flex-1 !rounded-2xl !border-gray-200 dark:!border-neutral-700 !font-bold !text-gray-700 dark:!text-neutral-300"
              >
                Clear All
              </SfButton>
              <motion.div
                className="flex-[2]"
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
              >
                <SfButton
                  size="lg"
                  onClick={() => { onApply(); onClose(); }}
                  className="w-full !rounded-2xl !bg-sky-500 hover:!bg-sky-600 !text-white !font-black !border-transparent !shadow-[0_4px_20px_rgba(14,165,233,0.4)]"
                >
                  {totalResults !== undefined
                    ? `Show ${totalResults.toLocaleString()} Results`
                    : 'Apply Filters'}
                </SfButton>
              </motion.div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
