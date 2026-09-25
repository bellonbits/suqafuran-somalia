"use client";

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';

interface Category {
  id: number;
  name_en: string;
  slug: string;
  icon_name?: string;
}

interface CategoryChipsProps {
  categories: Category[];
  selectedCategories: Set<string>;
  onCategoryToggle: (slug: string) => void;
  onClearAll?: () => void;
  loading?: boolean;
  categoriesWithListings?: Set<number | string>;
}

// Banner images for categories
const CATEGORY_BANNER_MAP: Record<string, string> = {
  'electronics': '/categories/electronics.png',
  'mobile-phones': '/categories/phones.png',
  'phones': '/categories/phones.png',
  'fashion': '/categories/shoes.png',
  'clothing': '/categories/shoes.png',
  'clothing-shoes': '/categories/shoes.png',
  'shoes': '/categories/shoes.png',
  'food-groceries': '/categories/grocery.jpg',
  'groceries': '/categories/grocery.jpg',
  'health-beauty': '/categories/skincare.png',
  'beauty': '/categories/skincare.png',
  'home': '/categories/house.png',
  'home-living': '/categories/house.png',
  'household-items': '/categories/house.png',
  'sports': '/categories/sport.jpg',
  'leisure-sports': '/categories/sport.jpg',
  'vehicles': '/categories/car.png',
  'automotive': '/categories/car.png',
  'livestock': '/categories/livestock.png',
  'baby': '/categories/baby.png',
  'babies-kids': '/categories/baby.png',
  'services': '/categories/services.png',
};

// Comprehensive icon mapping for all categories
const CATEGORY_ICON_MAP: Record<string, string> = {
  // Food & Groceries
  'groceries': '/icons/fruits.png',
  'food-groceries': '/icons/fruits.png',
  'street-market': '/icons/street-market.png',
  'farm': '/icons/farm.png',
  'fruits': '/icons/fruits.png',

  // Electronics & Phones
  'electronics': '/icons/mobile-app.png',
  'phones': '/icons/mobile-app.png',
  'phone': '/icons/mobile-app.png',
  'mobile': '/icons/mobile-app.png',
  'mobile-app': '/icons/mobile-app.png',
  'mobile-phones': '/icons/mobile-app.png',

  // Fashion & Clothing
  'fashion': '/icons/street-market.png',
  'clothing': '/icons/street-market.png',
  'clothing-shoes': '/icons/street-market.png',
  'shoes': '/icons/street-market.png',

  // Beauty & Personal Care
  'health-beauty': '/icons/beauty.png',
  'beauty': '/icons/beauty.png',
  'beauty-personal-care': '/icons/beauty.png',
  'beauty-and-personal': '/icons/beauty.png',
  'beauty-personal': '/icons/beauty.png',
  'makeup': '/icons/beauty.png',
  'personal-care': '/icons/beauty.png',

  // Pharmacy
  'pharmacy': '/icons/repair.png',

  // Sports & Leisure
  'sports': '/icons/soccer-ball.png',
  'leisure-sports': '/icons/soccer-ball.png',
  'soccer': '/icons/soccer-ball.png',

  // Home & Furniture
  'home': '/icons/households.png',
  'home-living': '/icons/households.png',
  'home-garden': '/icons/households.png',
  'furniture': '/icons/households.png',
  'household-items': '/icons/households.png',
  'household': '/icons/households.png',

  // Books & Stationery
  'books': '/icons/keyboard.png',
  'stationery': '/icons/keyboard.png',
  'keyboard': '/icons/keyboard.png',

  // Flowers & Plants
  'flowers': '/icons/farm.png',
  'plants': '/icons/farm.png',
  'flowers-plants': '/icons/farm.png',

  // Automotive
  'automotive': '/icons/classic-car.png',
  'cars': '/icons/classic-car.png',
  'vehicles': '/icons/classic-car.png',

  // Livestock & Animals
  'livestock': '/icons/cow.png',
  'animals': '/icons/cow.png',
  'cattle': '/icons/cow.png',

  // Containers & Storage
  'container': '/icons/container.png',
  'containers': '/icons/container.png',
  'storage': '/icons/container.png',

  // Jobs & Employment
  'jobs': '/icons/job-search.png',
  'job-search': '/icons/job-search.png',
  'employment': '/icons/job-search.png',

  // Professional Services & Repair
  'surveyor': '/icons/surveyor.png',
  'services': '/icons/repair.png',
  'repair': '/icons/repair.png',
  'repair-construction': '/icons/repair.png',
  'repair-and-construction': '/icons/repair.png',
  'repair-and-constructions': '/icons/repair.png',
  'maintenance': '/icons/repair.png',
  'technical': '/icons/repair.png',
  'construction': '/icons/repair.png',

  // Rental & Properties
  'rental': '/icons/for-rent.png',
  'for-rent': '/icons/for-rent.png',
  'rent': '/icons/for-rent.png',
  'properties': '/icons/for-rent.png',

  // Support & Services
  'support': '/icons/24-hours-support.png',
  'customer-service': '/icons/24-hours-support.png',

  // Babies & Kids
  'baby': '/icons/baby.png',
  'babies': '/icons/baby.png',
  'kids': '/icons/baby.png',
  'children': '/icons/baby.png',
  'baby-kids': '/icons/baby.png',
  'babies-kids': '/icons/baby.png',
  'babies-and-kids': '/icons/baby.png',
  'baby-and-kids': '/icons/baby.png',
};

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  categories,
  selectedCategories,
  onCategoryToggle,
  onClearAll,
  loading = false,
  categoriesWithListings,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories]);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (container) {
      setShowLeftScroll(container.scrollLeft > 0);
      setShowRightScroll(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 10
      );
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = 200;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScroll, 100);
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="shrink-0 flex flex-col items-center gap-2"
          >
            <div className="w-20 h-20 bg-gray-200 dark:bg-neutral-800 rounded-2xl animate-pulse" />
            <div className="h-3 w-12 bg-gray-200 dark:bg-neutral-800 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Left Scroll Button */}
      {showLeftScroll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-neutral-950 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
        >
          <ChevronLeft className="h-5 w-5 text-gray-700 dark:text-neutral-200" />
        </motion.button>
      )}

      {/* Categories Scroll Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-8 overflow-x-auto pb-4 scroll-smooth px-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* All Categories Button */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            onClearAll?.();
          }}
          className={`shrink-0 flex flex-col items-center gap-3 text-center transition-all ${
            selectedCategories.size === 0
              ? 'opacity-100'
              : 'opacity-50 hover:opacity-75'
          }`}
        >
          <div className={`w-24 h-24 flex items-center justify-center rounded-full ${
            selectedCategories.size === 0
              ? 'bg-[#e0f7ff] dark:bg-blue-900'
              : 'bg-gray-100 dark:bg-neutral-900'
          }`}>
            <ShoppingBag className={`w-12 h-12 ${
              selectedCategories.size === 0
                ? 'text-[#5bc0e8] dark:text-blue-300'
                : 'text-gray-700 dark:text-neutral-200'
            }`} />
          </div>
          <span className={`text-sm font-bold w-20 line-clamp-2 ${
            selectedCategories.size === 0
              ? 'text-[#5bc0e8] dark:text-blue-300'
              : 'text-gray-900 dark:text-white'
          }`}>
            All
          </span>
        </motion.button>

        {/* Category Chips - Only show if they have listings */}
        {categories
          .filter((category) => {
            // Show category only if it has listings (or if categoriesWithListings not provided)
            if (!categoriesWithListings || categoriesWithListings.size === 0) return true;
            return categoriesWithListings.has(category.id) ||
                   categoriesWithListings.has(category.slug) ||
                   categoriesWithListings.has(category.slug.toLowerCase());
          })
          .map((category) => {
            const iconPath = CATEGORY_ICON_MAP[category.slug.toLowerCase()] ||
                             CATEGORY_ICON_MAP[category.name_en.toLowerCase().replace(/ /g, '-')] ||
                             '/icons/shelves.png';

            const isSelected = selectedCategories.has(category.slug);

            return (
              <motion.button
                key={category.id}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onCategoryToggle(category.slug)}
                className={`shrink-0 flex flex-col items-center gap-3 text-center transition-all ${
                  isSelected
                    ? 'opacity-100'
                    : 'opacity-60 hover:opacity-80'
                }`}
              >
                <div className={`w-24 h-24 flex items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? 'bg-[#e0f7ff] dark:bg-blue-900 border-blue-500 dark:border-blue-400'
                    : 'bg-gray-100 dark:bg-neutral-900 border-transparent'
                }`}>
                  <img
                    src={iconPath}
                    alt={category.name_en}
                    className="w-12 h-12 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <span className={`text-sm font-bold w-20 line-clamp-2 transition-colors ${
                  isSelected
                    ? 'text-[#5bc0e8] dark:text-blue-300'
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {category.name_en}
                </span>
              </motion.button>
            );
          })}
      </div>

      {/* Right Scroll Button */}
      {showRightScroll && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white dark:bg-neutral-950 shadow-lg rounded-full p-2 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
        >
          <ChevronRight className="h-5 w-5 text-gray-700 dark:text-neutral-200" />
        </motion.button>
      )}
    </div>
  );
};
