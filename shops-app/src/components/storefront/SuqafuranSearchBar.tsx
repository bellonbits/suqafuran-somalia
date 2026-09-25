/**
 * SuqafuranSearchBar
 *
 * Hero search bar built on SfInput + SfButton with Framer Motion animations.
 * Includes suggestion dropdown with animated reveal.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { SfInput, SfButton, SfIconSearch, SfIconClose } from '@storefront-ui/react';
import { clsx } from 'clsx';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  autoFocus?: boolean;
  onSearch?: (query: string) => void;
  /** Pass recent searches to display as suggestions */
  recentSearches?: string[];
}

const POPULAR_IN_SOMALIA = [
  'iPhone', 'Samsung Galaxy', 'Toyota Land Cruiser', 'Abaya', 'Dirac',
  'Laptop', 'Sofa', 'Refrigerator', 'Camels', 'Rice',
];

const suggestionsVariants: Variants = {
  hidden: { opacity: 0, y: -8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.15 } },
};

const SIZE_CLASSES = {
  sm: '!h-10 !text-sm',
  md: '!h-12 !text-sm',
  lg: '!h-14 !text-base',
};

export const SuqafuranSearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search products, shops, services…',
  className,
  size = 'md',
  autoFocus = false,
  onSearch,
  recentSearches = [],
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const suggestions = query.length < 2
    ? recentSearches.slice(0, 5)
    : POPULAR_IN_SOMALIA.filter((s) => s.toLowerCase().includes(query.toLowerCase())).slice(0, 5);

  const showSuggestions = isFocused && suggestions.length > 0;

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    if (onSearch) {
      onSearch(q.trim());
    } else {
      navigate(`/search?q=${encodeURIComponent(q.trim())}`);
    }
    setIsFocused(false);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapperRef} className={clsx('relative w-full', className)}>
      <motion.div
        animate={isFocused ? { scale: 1.01 } : { scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <SfInput
          ref={inputRef as any}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          slotPrefix={
            <SfIconSearch
              className={clsx(
                'transition-colors duration-200',
                isFocused ? 'text-[#0078E8]' : 'text-gray-400'
              )}
            />
          }
          slotSuffix={
            <div className="flex items-center gap-1">
              <AnimatePresence>
                {query && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <SfButton
                      size="sm"
                      variant="tertiary"
                      onClick={() => setQuery('')}
                      className="!rounded-full !w-6 !h-6 !p-0 !text-gray-400 hover:!text-gray-600"
                      aria-label="Clear search"
                    >
                      <SfIconClose size="xs" />
                    </SfButton>
                  </motion.div>
                )}
              </AnimatePresence>
              <SfButton
                size="sm"
                onClick={() => handleSearch(query)}
                className="!rounded-full !bg-[#0078E8] hover:!bg-[#0066C7] active:!bg-[#0058AD] !text-white !font-bold !px-4 !h-9 !text-xs shrink-0"
              >
                Search
              </SfButton>
            </div>
          }
          // The pill styling belongs on SfInput's wrapper -- on the <input>
          // itself it rendered as a pill nested inside SFUI's default box.
          wrapperClassName={clsx(
            '!rounded-full !bg-white dark:!bg-neutral-900 !pl-4 !pr-1.5 !gap-2',
            '!ring-1 !transition-shadow !duration-200',
            isFocused
              ? '!ring-2 !ring-[#0078E8]/60'
              : '!ring-gray-200 dark:!ring-neutral-700 hover:!ring-gray-300',
            SIZE_CLASSES[size]
          )}
          className="!bg-transparent !min-w-0 !text-sm !text-gray-900 dark:!text-white placeholder:!text-gray-400 dark:placeholder:!text-neutral-500"
        />
      </motion.div>

      {/* ── Suggestions dropdown ─────────────────────────────────────── */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            variants={suggestionsVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-full left-0 right-0 mt-2 z-50 bg-white dark:bg-neutral-900 rounded-2xl border border-gray-100 dark:border-neutral-800 shadow-xl overflow-hidden"
          >
            {recentSearches.length > 0 && query.length < 2 && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500">
                Recent
              </p>
            )}
            {query.length >= 2 && suggestions.length > 0 && (
              <p className="px-4 pt-3 pb-1 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-neutral-500">
                Popular in Somalia
              </p>
            )}
            {suggestions.map((s, i) => (
              <motion.button
                key={s}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => { setQuery(s); handleSearch(s); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-800 dark:text-neutral-200 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-left"
              >
                <SfIconSearch size="xs" className="text-gray-400 shrink-0" />
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
