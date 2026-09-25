/**
 * HomeFilterBar
 *
 * Quick product search for the homepage: keyword + category + condition +
 * price, plus one-tap shortcuts. Everything hands off to /search with the
 * same URL params SearchPage reads, so the full filter sidebar opens
 * pre-filled there.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SfInput, SfSelect, SfButton, SfIconSearch } from '@storefront-ui/react';
import { useT } from '@/lib/i18n';

interface HomeFilterBarProps {
  categories: { id: number; name: string }[];
}

const QUICK_FILTERS: { label: string; params: Record<string, string> }[] = [
  { label: 'All products', params: {} },
  { label: 'Brand new', params: { condition: 'new' } },
  { label: 'Used', params: { condition: 'used' } },
  { label: 'Under $50', params: { price_max: '50' } },
  { label: 'Under $200', params: { price_max: '200' } },
  { label: 'Most popular', params: { sort: 'popular' } },
  { label: 'Lowest price', params: { sort: 'price_asc' } },
];

// Every control shares one height, radius, ring and text size so the row lines up.
const CONTROL_H = '!h-11';
const fieldBox =
  `${CONTROL_H} !rounded-xl !bg-gray-50 dark:!bg-neutral-900 !ring-1 !ring-gray-200 dark:!ring-neutral-800 hover:!ring-orange-400 focus-within:!ring-2 focus-within:!ring-orange-500`;
const fieldInput = '!bg-transparent !text-sm text-gray-900 dark:text-white placeholder:text-gray-400';
const selectBox =
  `${CONTROL_H} !py-0 !pl-4 !pr-10 !rounded-xl !bg-gray-50 dark:!bg-neutral-900 !ring-1 !ring-inset !ring-gray-200 dark:!ring-neutral-800 hover:!ring-orange-400 focus:!ring-2 focus:!ring-orange-500 !text-sm text-gray-900 dark:text-white`;

export const HomeFilterBar: React.FC<HomeFilterBarProps> = ({ categories }) => {
  const navigate = useNavigate();
  const t = useT();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const go = (params: Record<string, string>) => {
    const search = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
    navigate(`/search${search.size ? `?${search}` : ''}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    go({ q: q.trim(), category, condition, price_min: priceMin, price_max: priceMax });
  };

  return (
    <div className="sm:bg-white sm:dark:bg-neutral-950 sm:rounded-2xl sm:ring-1 sm:ring-gray-100 sm:dark:ring-neutral-800 sm:shadow-sm sm:p-3 md:p-4">
      <form onSubmit={submit} className="hidden sm:grid grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] items-center gap-2.5">
        <SfInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('What are you looking for?')}
          aria-label="Search products"
          wrapperClassName={`col-span-2 lg:col-span-1 ${fieldBox}`}
          className={fieldInput}
          slotPrefix={<SfIconSearch size="sm" className="text-gray-400" />}
        />
        <SfSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={selectBox}>
          <option value="">{t('All categories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </SfSelect>
        <SfSelect value={condition} onChange={(e) => setCondition(e.target.value)} aria-label="Condition" className={selectBox}>
          <option value="">{t('Any condition')}</option>
          <option value="new">{t('Brand new')}</option>
          <option value="used">{t('Used')}</option>
          <option value="refurbished">{t('Refurbished')}</option>
        </SfSelect>
        <div className="flex items-center gap-2 col-span-2 lg:col-span-1">
          <SfInput
            type="number"
            inputMode="numeric"
            min={0}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder="Min $"
            aria-label="Minimum price"
            wrapperClassName={`flex-1 min-w-0 !px-3 ${fieldBox}`}
            className={`${fieldInput} !min-w-0`}
          />
          <span className="text-gray-400 text-sm shrink-0" aria-hidden>–</span>
          <SfInput
            type="number"
            inputMode="numeric"
            min={0}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder="Max $"
            aria-label="Maximum price"
            wrapperClassName={`flex-1 min-w-0 !px-3 ${fieldBox}`}
            className={`${fieldInput} !min-w-0`}
          />
        </div>
        <SfButton
          type="submit"
          className={`col-span-2 lg:col-span-1 ${CONTROL_H} !rounded-xl !bg-orange-500 hover:!bg-orange-600 active:!bg-orange-700 !text-white !text-sm !font-semibold !px-6 !shadow-none`}
          slotPrefix={<SfIconSearch size="sm" />}
        >
          {t('Search')}
        </SfButton>
      </form>

      {/* One-tap shortcuts -- shown on every size; on mobile they sit beside
          the existing search bar + filter drawer. */}
      <div className="sm:mt-2 -mx-4 px-4 sm:-mx-1 sm:px-1 py-1 flex items-center gap-2 overflow-x-auto overscroll-x-contain hide-scrollbar">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => go(f.params)}
            className="shrink-0 h-8 px-3.5 rounded-full text-[13px] font-medium bg-white dark:bg-neutral-950 ring-1 ring-inset ring-gray-200 dark:ring-neutral-800 text-gray-700 dark:text-neutral-200 hover:ring-orange-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
          >
            {t(f.label)}
          </button>
        ))}
      </div>
    </div>
  );
};
