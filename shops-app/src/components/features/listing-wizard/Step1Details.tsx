"use client";

import React, { useState } from 'react';
import { Wand2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { aiService } from '../../../services/aiService';
import { ListingFormData } from '../ListingWizard';

interface Step1Props {
  data: ListingFormData;
  onUpdate: (data: Partial<ListingFormData>) => void;
  onError: (error: string) => void;
}

export const ListingStep1Details: React.FC<Step1Props> = ({
  data,
  onUpdate,
  onError,
}) => {
  const [generating, setGenerating] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);

  const handleGenerateDescription = async () => {
    if (!data.title.trim()) {
      onError('Please enter a title first');
      return;
    }

    setGenerating(true);
    onError('');

    try {
      // Pass category if available (can be category ID)
      const category = data.category_id ? String(data.category_id) : undefined;
      const result = await aiService.generateListingText(data.title, category);

      // Handle various response formats
      const description = typeof result === 'string'
        ? result
        : result?.description || result?.result || '';

      onUpdate({
        description: description,
      });
    } catch (err: any) {
      onError('Failed to generate description. Try writing it manually.');
      console.error('AI generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGetPriceRecommendation = async () => {
    if (!data.title.trim()) {
      onError('Please enter a title first');
      return;
    }

    setPriceLoading(true);
    onError('');

    try {
      // Need category_id for price recommendation, use a placeholder if not set
      const result = await aiService.getPriceRecommendation({
        title: data.title,
        category_id: data.category_id || 1,
        condition: data.condition,
        description: data.description,
      });

      onUpdate({
        price: result.recommended_price,
      });
    } catch (err: any) {
      onError('Failed to get price recommendation. Set the price manually.');
      console.error('Price recommendation error:', err);
    } finally {
      setPriceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-2">
          Title *
        </label>
        <input
          type="text"
          value={data.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="e.g., iPhone 13 Pro Max 128GB, Gold, Like New"
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
        />
        <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
          Be specific and descriptive (max 100 characters)
        </p>
      </div>

      {/* Description with AI */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-100">
            Description *
          </label>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGenerateDescription}
            disabled={generating || !data.title.trim()}
            className="flex items-center gap-2 px-3 py-1 text-sm rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {generating ? 'Generating...' : 'AI Generate'}
          </motion.button>
        </div>

        <textarea
          value={data.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Describe your item in detail. Mention condition, features, any defects..."
          rows={5}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
        />
        <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">
          {data.description.length}/2000 characters
        </p>
      </div>

      {/* Condition */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-2">
          Condition *
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['new', 'like_new', 'good', 'fair'].map((condition) => (
            <motion.button
              key={condition}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onUpdate({ condition: condition as any })}
              className={`py-3 px-4 rounded-lg font-semibold transition-all ${
                data.condition === condition
                  ? 'bg-[#5bc0e8] text-white'
                  : 'bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 hover:bg-gray-200 dark:hover:bg-neutral-800'
              }`}
            >
              {condition === 'like_new' ? 'Like New' : condition.charAt(0).toUpperCase() + condition.slice(1)}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Price with AI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-2">
            Price (KES) *
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-neutral-300">
              KSh
            </span>
            <input
              type="number"
              value={data.price || ''}
              onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="w-full pl-12 pr-4 py-3 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-100 mb-2">
            &nbsp;
          </label>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleGetPriceRecommendation}
            disabled={priceLoading || !data.title.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {priceLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            {priceLoading ? 'Calculating...' : 'AI Suggest Price'}
          </motion.button>
        </div>
      </div>

      {/* Negotiable */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="negotiable"
          checked={data.negotiable}
          onChange={(e) => onUpdate({ negotiable: e.target.checked })}
          className="w-5 h-5 rounded border-gray-300 text-[#5bc0e8] focus:ring-2 focus:ring-blue-500"
        />
        <label htmlFor="negotiable" className="text-sm font-semibold text-gray-700 dark:text-neutral-100">
          Price is negotiable
        </label>
      </div>
    </div>
  );
};
