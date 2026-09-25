"use client";

import React, { useState, useEffect } from 'react';
import { ListingFormData } from '../ListingWizard';
import { listingsService } from '../../../services/listings';

interface Step4Props {
  data: ListingFormData;
  onUpdate: (data: Partial<ListingFormData>) => void;
}

interface CategoryInfo {
  name_en: string;
}

export const ListingStep4Review: React.FC<Step4Props> = ({ data }) => {
  const [categories, setCategories] = useState<Record<number, string>>({});

  useEffect(() => {
    loadCategoryNames();
  }, [data.category_id]);

  const loadCategoryNames = async () => {
    try {
      const cats = await listingsService.getCategories();
      const categoryMap: Record<number, string> = {};

      const findCategoryName = (list: any[], id: number): string => {
        for (const cat of list) {
          if (cat.id === id) return cat.name_en;
          if (cat.subcategories) {
            for (const subcat of cat.subcategories) {
              if (subcat.id === id) return subcat.name_en;
              if (subcat.subsubcategories) {
                for (const subsubcat of subcat.subsubcategories) {
                  if (subsubcat.id === id) return subsubcat.name_en;
                }
              }
            }
          }
        }
        return 'Unknown';
      };

      if (data.category_id)
        categoryMap[data.category_id] = findCategoryName(cats, data.category_id);
      if (data.subcategory_id)
        categoryMap[data.subcategory_id] = findCategoryName(cats, data.subcategory_id);
      if (data.subsubcategory_id)
        categoryMap[data.subsubcategory_id] = findCategoryName(cats, data.subsubcategory_id);

      setCategories(categoryMap);
    } catch (err) {
      console.error('Failed to load category names:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-2">
          ✓ Ready to Publish!
        </h3>
        <p className="text-sm text-green-800 dark:text-green-200">
          Review your listing details below. Click "Publish Listing" to go live.
        </p>
      </div>

      {/* Title & Description Preview */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {data.title}
        </h3>
        <p className="text-gray-600 dark:text-neutral-300 mb-4">
          {data.description}
        </p>

        {data.images.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {data.images.map((image, index) => (
              <div key={index} className="aspect-square rounded-lg overflow-hidden">
                <img
                  src={image.url}
                  alt={`Listing image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Price */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider mb-1">
            Price
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            KSh {(data?.price || 0).toLocaleString()}
          </p>
          {data.negotiable && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Negotiable
            </p>
          )}
        </div>

        {/* Condition */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider mb-1">
            Condition
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white capitalize">
            {data.condition === 'like_new' ? 'Like New' : data.condition}
          </p>
        </div>

        {/* Category */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider mb-1">
            Category
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {categories[data.category_id] || 'Unknown'}
          </p>
        </div>

        {/* Photos */}
        <div className="p-4 bg-gray-50 dark:bg-neutral-900 rounded-lg">
          <p className="text-xs font-semibold text-gray-500 dark:text-neutral-300 uppercase tracking-wider mb-1">
            Photos
          </p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {data.images.length}
          </p>
        </div>
      </div>

      {/* Verification Checklist */}
      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
          Before publishing:
        </h4>
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              disabled
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600"
            />
            <span className="text-sm text-gray-700 dark:text-neutral-200">
              Title and description are accurate and clear
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              disabled
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600"
            />
            <span className="text-sm text-gray-700 dark:text-neutral-200">
              Photos clearly show the item's condition
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              disabled
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600"
            />
            <span className="text-sm text-gray-700 dark:text-neutral-200">
              Price is competitive and realistic
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              disabled
              className="w-5 h-5 mt-0.5 rounded border-gray-300 text-green-600"
            />
            <span className="text-sm text-gray-700 dark:text-neutral-200">
              All information is honest and accurate
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
