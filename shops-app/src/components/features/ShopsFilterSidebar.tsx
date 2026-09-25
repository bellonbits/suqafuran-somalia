"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface ShopsFilters {
  rating?: number;
  distance?: number;
  openNow?: boolean;
  verified?: boolean;
  freeDelivery?: boolean;
  sortBy?: 'rating' | 'distance' | 'newest' | 'products';
}

interface ShopsFilterSidebarProps {
  filters: ShopsFilters;
  onFiltersChange: (filters: ShopsFilters) => void;
  onClose?: () => void;
  isOpen?: boolean;
  isMobile?: boolean;
}

export const ShopsFilterSidebar: React.FC<ShopsFilterSidebarProps> = ({
  filters,
  onFiltersChange,
  onClose,
  isOpen = true,
  isMobile = false,
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['sort', 'filters'])
  );

  const toggleSection = (section: string) => {
    const newSections = new Set(expandedSections);
    if (newSections.has(section)) {
      newSections.delete(section);
    } else {
      newSections.add(section);
    }
    setExpandedSections(newSections);
  };

  const handleRatingChange = (rating: number) => {
    onFiltersChange({
      ...filters,
      rating: filters.rating === rating ? undefined : rating,
    });
  };

  const handleDistanceChange = (distance: number) => {
    onFiltersChange({
      ...filters,
      distance: filters.distance === distance ? undefined : distance,
    });
  };

  const handleToggle = (key: keyof ShopsFilters) => {
    onFiltersChange({
      ...filters,
      [key]: !filters[key],
    });
  };

  const content = (
    <div className="space-y-6">
      {/* Sort By */}
      <div>
        <motion.button
          onClick={() => toggleSection('sort')}
          className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="font-bold text-gray-900 dark:text-white">Sort By</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${
              expandedSections.has('sort') ? 'rotate-180' : ''
            }`}
          />
        </motion.button>

        <AnimatePresence>
          {expandedSections.has('sort') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 mt-3"
            >
              {[
                { key: 'rating', label: 'Highest Rated' },
                { key: 'distance', label: 'Nearest' },
                { key: 'newest', label: 'Recently Added' },
                { key: 'products', label: 'Most Products' },
              ].map((option) => (
                <label key={option.key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="sort"
                    checked={filters.sortBy === option.key}
                    onChange={() =>
                      onFiltersChange({
                        ...filters,
                        sortBy: option.key as any,
                      })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
                  />
                  <span className="text-sm text-gray-700 dark:text-neutral-200">
                    {option.label}
                  </span>
                </label>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Quick Filters */}
      <div>
        <motion.button
          onClick={() => toggleSection('filters')}
          className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-neutral-900 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
        >
          <span className="font-bold text-gray-900 dark:text-white">Filters</span>
          <ChevronDown
            className={`h-5 w-5 transition-transform ${
              expandedSections.has('filters') ? 'rotate-180' : ''
            }`}
          />
        </motion.button>

        <AnimatePresence>
          {expandedSections.has('filters') && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 mt-3"
            >
              {/* Open Now */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.openNow || false}
                  onChange={() => handleToggle('openNow')}
                  className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-200">Open Now</span>
              </label>

              {/* Verified Only */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.verified || false}
                  onChange={() => handleToggle('verified')}
                  className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-200">Verified Only</span>
              </label>

              {/* Free Delivery */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.freeDelivery || false}
                  onChange={() => handleToggle('freeDelivery')}
                  className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
                />
                <span className="text-sm text-gray-700 dark:text-neutral-200">Free Delivery</span>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Minimum Rating */}
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
          Minimum Rating
        </h4>
        <div className="space-y-2">
          {[4, 3.5, 3, 2.5].map((rating) => (
            <label key={rating} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.rating === rating}
                onChange={() => handleRatingChange(rating)}
                className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
              />
              <span className="text-sm text-gray-700 dark:text-neutral-200">
                 {rating}+ ({rating === 4 ? 'Excellent' : rating === 3.5 ? 'Very Good' : rating === 3 ? 'Good' : 'Fair'})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Distance */}
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-3">
          Distance
        </h4>
        <div className="space-y-2">
          {[1, 2, 5, 10].map((distance) => (
            <label key={distance} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.distance === distance}
                onChange={() => handleDistanceChange(distance)}
                className="w-4 h-4 rounded border-gray-300 text-[#5bc0e8]"
              />
              <span className="text-sm text-gray-700 dark:text-neutral-200">
                Within {distance} km
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Reset Filters */}
      {Object.keys(filters).some((key) => filters[key as keyof ShopsFilters]) && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() =>
            onFiltersChange({
              rating: undefined,
              distance: undefined,
              openNow: false,
              verified: false,
              freeDelivery: false,
              sortBy: undefined,
            })
          }
          className="w-full py-3 px-4 bg-gray-200 dark:bg-neutral-800 text-gray-900 dark:text-white font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"
        >
          Reset All Filters
        </motion.button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 z-40"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white dark:bg-neutral-950 shadow-2xl z-50 overflow-y-auto"
            >
              <div className="sticky top-0 flex items-center justify-between p-4 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filters</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="p-4">{content}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white dark:bg-neutral-950 rounded-2xl shadow-sm border border-gray-200 dark:border-neutral-800 p-6 h-fit sticky top-24"
    >
      {content}
    </motion.div>
  );
};
