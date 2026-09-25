/**
 * Filters
 *
 * Sidebar filter kit shared by the Search (products), Shops and Home pages.
 * Built on Storefront UI primitives:
 *   SfCheckbox, SfInput, SfButton, SfIcon*
 * with Framer Motion for the mobile slide-over.
 *
 * Every piece is controlled -- pages own the filter state (usually mirrored
 * into the URL) and these components only render it.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SfButton,
  SfCheckbox,
  SfIconTune,
  SfIconClose,
  SfIconStarFilled,
  SfIconUnfoldMore,
  SfIconArrowUpward,
  SfIconArrowDownward,
  SfIconGridView,
  SfIconViewList,
  SfIconChevronLeft,
  SfIconChevronRight,
} from '@storefront-ui/react';
import { clsx } from 'clsx';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

// ─── Panel ────────────────────────────────────────────────────────────────────
interface FilterPanelProps {
  activeCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({ activeCount = 0, onClear, children, className }) => (
  <div className={clsx('bg-white dark:bg-neutral-950 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-sm', className)}>
    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-neutral-800">
      <div className="flex items-center gap-2.5 text-gray-900 dark:text-white">
        <SfIconTune size="sm" className="text-gray-500 dark:text-neutral-400" />
        <h2 className="text-base font-semibold">Filters</h2>
        {activeCount > 0 && (
          <span className="bg-orange-500 text-white text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </div>
      {activeCount > 0 && onClear && (
        <button type="button" onClick={onClear} className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">
          Clear all
        </button>
      )}
    </div>
    <div className="px-5 py-2 divide-y divide-gray-100 dark:divide-neutral-800">{children}</div>
  </div>
);

export const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="py-5">
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{title}</h3>
    {children}
  </section>
);

// ─── "See more" helper ───────────────────────────────────────────────────────
function useCollapsible<T>(items: T[], initialVisible: number) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialVisible);
  const toggle = items.length > initialVisible ? (
    <button
      type="button"
      onClick={() => setExpanded((e) => !e)}
      className="mt-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:underline"
    >
      {expanded ? 'See less' : 'See more'}
    </button>
  ) : null;
  return { visible, toggle };
}

const Count: React.FC<{ n?: number }> = ({ n }) =>
  n === undefined ? null : <span className="text-xs text-gray-400 dark:text-neutral-500 tabular-nums">{n}</span>;

// ─── Single-select list (categories) ─────────────────────────────────────────
interface FilterLinkListProps {
  options: FilterOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  initialVisible?: number;
}

export const FilterLinkList: React.FC<FilterLinkListProps> = ({
  options,
  value,
  onChange,
  allLabel = 'All',
  initialVisible = 7,
}) => {
  const { visible, toggle } = useCollapsible(options, initialVisible);
  const row = (selected: boolean) =>
    clsx(
      'w-full flex items-center justify-between gap-3 py-1.5 text-left text-sm transition-colors',
      selected
        ? 'text-orange-600 dark:text-orange-400 font-semibold'
        : 'text-gray-600 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white'
    );
  return (
    <div>
      <ul>
        <li>
          <button type="button" onClick={() => onChange(null)} className={row(value === null)} aria-pressed={value === null}>
            {allLabel}
          </button>
        </li>
        {visible.map((opt) => (
          <li key={opt.value}>
            <button
              type="button"
              onClick={() => onChange(opt.value === value ? null : opt.value)}
              className={row(opt.value === value)}
              aria-pressed={opt.value === value}
            >
              <span className="truncate">{opt.label}</span>
              <Count n={opt.count} />
            </button>
          </li>
        ))}
      </ul>
      {toggle}
    </div>
  );
};

// ─── Multi-select checkboxes (condition, markets) ────────────────────────────
interface FilterCheckboxListProps {
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  initialVisible?: number;
}

export const FilterCheckboxList: React.FC<FilterCheckboxListProps> = ({ options, values, onChange, initialVisible = 6 }) => {
  const { visible, toggle } = useCollapsible(options, initialVisible);
  const toggleValue = (v: string, checked: boolean) =>
    onChange(checked ? [...values, v] : values.filter((x) => x !== v));
  return (
    <div>
      <ul className="space-y-1">
        {visible.map((opt) => (
          <li key={opt.value}>
            <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
              <SfCheckbox
                checked={values.includes(opt.value)}
                onChange={(e) => toggleValue(opt.value, e.target.checked)}
                className="sf-check !text-gray-300 dark:!text-neutral-600 hover:!text-orange-400"
              />
              <span className="flex-1 truncate text-sm text-gray-600 dark:text-neutral-300 group-hover:text-gray-900 dark:group-hover:text-white">
                {opt.label}
              </span>
              <Count n={opt.count} />
            </label>
          </li>
        ))}
      </ul>
      {toggle}
    </div>
  );
};

// ─── Price range (dual slider + min/max inputs) ──────────────────────────────
interface PriceRangeFilterProps {
  /** Slider bounds */
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  currencySymbol?: string;
  step?: number;
}

export const PriceRangeFilter: React.FC<PriceRangeFilterProps> = ({
  min,
  max,
  value,
  onChange,
  currencySymbol = '$',
  step = 1,
}) => {
  const span = Math.max(max - min, 1);
  const [lo, hi] = value;
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;
  const numberInput = 'w-full h-9 px-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 ring-1 ring-gray-200 dark:ring-neutral-800 focus:ring-2 focus:ring-orange-500 outline-none text-sm text-gray-900 dark:text-white tabular-nums';

  return (
    <div>
      <div className="relative h-5">
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1 rounded-full bg-gray-200 dark:bg-neutral-800" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-orange-500"
          style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => onChange([Math.min(Number(e.target.value), hi), hi])}
          className="range-dual"
          aria-label="Minimum price"
          style={{ zIndex: lo > max - span * 0.1 ? 5 : 3 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => onChange([lo, Math.max(Number(e.target.value), lo)])}
          className="range-dual"
          aria-label="Maximum price"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          value={lo}
          onChange={(e) => onChange([Math.max(min, Number(e.target.value) || 0), hi])}
          className={numberInput}
          aria-label={`Minimum price in ${currencySymbol}`}
        />
        <span className="text-gray-400 text-sm">–</span>
        <input
          type="number"
          inputMode="numeric"
          value={hi}
          onChange={(e) => onChange([lo, Number(e.target.value) || 0])}
          className={numberInput}
          aria-label={`Maximum price in ${currencySymbol}`}
        />
      </div>
      <p className="mt-2 text-sm font-medium text-gray-700 dark:text-neutral-200 tabular-nums">
        {currencySymbol}{lo.toLocaleString()} – {currencySymbol}{hi.toLocaleString()}{hi >= max ? '+' : ''}
      </p>
    </div>
  );
};

// ─── Stars & rating filter ───────────────────────────────────────────────────
export const Stars: React.FC<{ value: number; max?: number; className?: string }> = ({ value, max = 5, className }) => (
  <span className={clsx('inline-flex items-center', className)} aria-label={`${value} out of ${max} stars`}>
    {Array.from({ length: max }, (_, i) => (
      <SfIconStarFilled
        key={i}
        size="xs"
        className={i < Math.round(value) ? 'text-amber-400' : 'text-gray-200 dark:text-neutral-700'}
      />
    ))}
  </span>
);

interface RatingFilterProps {
  /** Minimum star rating, or null for any */
  value: number | null;
  onChange: (value: number | null) => void;
  counts?: Partial<Record<number, number>>;
}

export const RatingFilter: React.FC<RatingFilterProps> = ({ value, onChange, counts }) => (
  <ul className="space-y-1">
    {[5, 4, 3, 2, 1].map((stars) => (
      <li key={stars}>
        <label className="flex items-center gap-3 py-1.5 cursor-pointer group">
          <SfCheckbox
            checked={value === stars}
            onChange={(e) => onChange(e.target.checked ? stars : null)}
            className="sf-check !text-gray-300 dark:!text-neutral-600 hover:!text-orange-400"
          />
          <span className="flex-1 flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-400">
            <Stars value={stars} />
            {stars < 5 && 'and up'}
          </span>
          <Count n={counts?.[stars]} />
        </label>
      </li>
    ))}
  </ul>
);

// ─── Sort bar ────────────────────────────────────────────────────────────────
interface SortBarProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  /** Adds a "Price" tab that toggles between price_asc and price_desc */
  withPrice?: boolean;
}

export const SortBar: React.FC<SortBarProps> = ({ options, value, onChange, withPrice }) => {
  const tab = (active: boolean) =>
    clsx(
      'px-3 py-1.5 text-sm whitespace-nowrap rounded-md transition-colors flex items-center gap-1',
      active
        ? 'text-orange-600 dark:text-orange-400 font-semibold bg-orange-50 dark:bg-orange-950/40'
        : 'text-gray-500 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white'
    );
  const priceActive = value === 'price_asc' || value === 'price_desc';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="hidden md:inline text-sm text-gray-500 dark:text-neutral-400 shrink-0">Sort by:</span>
      <div className="flex items-center gap-0.5 p-1 rounded-lg ring-1 ring-gray-200 dark:ring-neutral-800 bg-white dark:bg-neutral-950 overflow-x-auto hide-scrollbar">
        {options.map((opt) => (
          <button key={opt.value} type="button" onClick={() => onChange(opt.value)} className={tab(value === opt.value)} aria-pressed={value === opt.value}>
            {opt.label}
          </button>
        ))}
        {withPrice && (
          <button
            type="button"
            onClick={() => onChange(value === 'price_asc' ? 'price_desc' : 'price_asc')}
            className={tab(priceActive)}
            aria-pressed={priceActive}
            aria-label={value === 'price_asc' ? 'Price, low to high' : value === 'price_desc' ? 'Price, high to low' : 'Sort by price'}
          >
            Price
            {value === 'price_asc' ? <SfIconArrowUpward size="xs" /> : value === 'price_desc' ? <SfIconArrowDownward size="xs" /> : <SfIconUnfoldMore size="xs" />}
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Grid / list toggle ──────────────────────────────────────────────────────
export const ViewToggle: React.FC<{ value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    {(['grid', 'list'] as const).map((mode) => (
      <button
        key={mode}
        type="button"
        onClick={() => onChange(mode)}
        aria-label={mode === 'grid' ? 'Grid view' : 'List view'}
        aria-pressed={value === mode}
        className={clsx(
          'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
          value === mode
            ? 'bg-white dark:bg-neutral-900 shadow-sm ring-1 ring-gray-200 dark:ring-neutral-800 text-orange-600 dark:text-orange-400'
            : 'text-gray-400 hover:text-gray-700 dark:hover:text-neutral-200'
        )}
      >
        {mode === 'grid' ? <SfIconGridView size="sm" /> : <SfIconViewList size="sm" />}
      </button>
    ))}
  </div>
);

// ─── Mobile slide-over wrapping a FilterPanel's contents ─────────────────────
interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  resultCount?: number;
  children: React.ReactNode;
}

export const MobileFilterSheet: React.FC<MobileFilterSheetProps> = ({ open, onClose, resultCount, children }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />
        <motion.aside
          className="fixed left-0 top-0 bottom-0 z-[61] w-full max-w-sm bg-gray-50 dark:bg-black shadow-2xl flex flex-col lg:hidden"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          initial={{ x: '-100%' }}
          animate={{ x: 0, transition: { type: 'spring', stiffness: 280, damping: 28 } }}
          exit={{ x: '-100%', transition: { duration: 0.2 } }}
          role="dialog"
          aria-modal
          aria-label="Filters"
        >
          <div className="flex justify-end px-3 pt-3">
            <SfButton variant="tertiary" size="sm" square onClick={onClose} aria-label="Close filters" className="!rounded-full !text-gray-600 dark:!text-neutral-300">
              <SfIconClose />
            </SfButton>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-3">{children}</div>
          <div className="p-4 border-t border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}>
            <SfButton onClick={onClose} className="w-full !rounded-xl !bg-orange-500 hover:!bg-orange-600 !text-white !font-semibold">
              {resultCount !== undefined ? `Show ${resultCount.toLocaleString()} results` : 'Show results'}
            </SfButton>
          </div>
        </motion.aside>
      </>
    )}
  </AnimatePresence>
);

/** Button that opens the MobileFilterSheet -- hidden on lg+ where the sidebar shows. */
export const MobileFilterButton: React.FC<{ onClick: () => void; activeCount?: number }> = ({ onClick, activeCount = 0 }) => (
  <SfButton
    variant="secondary"
    onClick={onClick}
    className="lg:hidden shrink-0 !rounded-full !ring-gray-200 dark:!ring-neutral-800 !bg-white dark:!bg-neutral-950 !text-gray-700 dark:!text-neutral-200 hover:!bg-gray-50 !font-medium"
    slotPrefix={<SfIconTune size="sm" />}
  >
    Filters
    {activeCount > 0 && (
      <span className="bg-orange-500 text-white text-[10px] font-bold min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center">
        {activeCount}
      </span>
    )}
  </SfButton>
);

// ─── Pagination ──────────────────────────────────────────────────────────────
interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, onChange }) => {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) =>
    totalPages <= 7 ? i + 1
      : page <= 4 ? i + 1
      : page >= totalPages - 3 ? totalPages - 6 + i
      : page - 3 + i
  );
  const nav = 'w-9 h-9 rounded-full flex items-center justify-center ring-1 ring-gray-200 dark:ring-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-orange-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  return (
    <nav className="flex items-center justify-center gap-2 mt-12 mb-4" aria-label="Pagination">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 1} className={nav} aria-label="Previous page">
        <SfIconChevronLeft size="sm" />
      </button>
      {pages.map((pg) => (
        <button
          key={pg}
          type="button"
          onClick={() => onChange(pg)}
          aria-current={page === pg ? 'page' : undefined}
          className={clsx(
            'w-9 h-9 rounded-full text-sm font-bold transition-all',
            page === pg
              ? 'bg-orange-500 text-white shadow-md'
              : 'ring-1 ring-gray-200 dark:ring-neutral-800 text-gray-600 dark:text-neutral-300 hover:bg-orange-50 dark:hover:bg-neutral-900'
          )}
        >
          {pg}
        </button>
      ))}
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === totalPages} className={nav} aria-label="Next page">
        <SfIconChevronRight size="sm" />
      </button>
    </nav>
  );
};
