"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { listingsService } from '../../../services/listings';
import { ListingFormData } from '../ListingWizard';

interface Category {
  id: number;
  name_en: string;
  slug: string;
  icon_name?: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: number;
  name_en: string;
  slug: string;
  subsubcategories?: Subsubcategory[];
}

interface Subsubcategory {
  id: number;
  name_en: string;
  slug: string;
}

interface Step2Props {
  data: ListingFormData;
  onUpdate: (data: Partial<ListingFormData>) => void;
  onError: (error: string) => void;
}

export const ListingStep2Category: React.FC<Step2Props> = ({
  data,
  onUpdate,
  onError,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const cats = await listingsService.getCategories();
      setCategories(cats);

      // Pre-select if already in form data
      if (data.category_id) {
        const selected = cats.find((c) => c.id === data.category_id);
        if (selected) {
          setSelectedCategory(selected);

          if (data.subcategory_id && selected.subcategories) {
            const subSelected = selected.subcategories.find(
              (s) => s.id === data.subcategory_id
            );
            if (subSelected) {
              setSelectedSubcategory(subSelected);
            }
          }
        }
      }
    } catch (err) {
      onError('Failed to load categories');
      console.error('Category loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    onUpdate({
      category_id: category.id,
      subcategory_id: undefined,
      subsubcategory_id: undefined,
    });
  };

  const handleSelectSubcategory = (subcategory: Subcategory) => {
    setSelectedSubcategory(subcategory);
    onUpdate({
      subcategory_id: subcategory.id,
      subsubcategory_id: undefined,
    });
  };

  const handleSelectSubsubcategory = (subsubcategory: Subsubcategory) => {
    onUpdate({
      subsubcategory_id: subsubcategory.id,
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-[#5bc0e8] animate-spin mb-3" />
        <p className="text-gray-600 dark:text-neutral-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Categories */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-3">
          Main Category *
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {categories.map((category) => (
            <motion.button
              key={category.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectCategory(category)}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                selectedCategory?.id === category.id
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
              }`}
            >
              <p className="font-semibold text-gray-900 dark:text-white">
                {category.name_en}
              </p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Subcategories */}
      {selectedCategory && selectedCategory.subcategories && selectedCategory.subcategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-3">
            Subcategory *
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {selectedCategory.subcategories.map((subcategory) => (
              <motion.button
                key={subcategory.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectSubcategory(subcategory)}
                className={`p-4 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
                  selectedSubcategory?.id === subcategory.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                }`}
              >
                <p className="font-semibold text-gray-900 dark:text-white">
                  {subcategory.name_en}
                </p>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Subsubcategories */}
      {selectedSubcategory && selectedSubcategory.subsubcategories && selectedSubcategory.subsubcategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-3">
            Specific Category
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
            {selectedSubcategory.subsubcategories.map((subsubcategory) => (
              <motion.button
                key={subsubcategory.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectSubsubcategory(subsubcategory)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  data.subsubcategory_id === subsubcategory.id
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700'
                }`}
              >
                <p className="font-semibold text-gray-900 dark:text-white">
                  {subsubcategory.name_en}
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {!selectedCategory && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-[#5bc0e8] dark:text-[#6cd4ff]">
            👉 Please select a category to get started
          </p>
        </div>
      )}
    </div>
  );
};
