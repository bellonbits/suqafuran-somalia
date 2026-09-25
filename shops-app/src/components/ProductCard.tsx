"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Heart, ShoppingCart } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/services/api';
import { ProductQuickViewModal } from './ProductQuickViewModal';

interface ProductCardProps {
  id: number;
  name: string;
  category: string;
  image: string;
  price: number;
  originalPrice: number;
  rating: number;
  reviews?: number;
  weight: string;
  description?: string;
  discount?: number;
  delay?: number;
  shopName?: string;
  shopVerified?: boolean;
  onAddToCart?: (productId: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  name,
  category,
  image,
  price,
  originalPrice,
  rating,
  reviews = 0,
  weight,
  description = 'High-quality product with excellent features.',
  discount = 0,
  delay = 0,
  shopName,
  shopVerified,
  onAddToCart,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const discountPercent = discount || (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0);

  const handleCardClick = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, delay }}
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleCardClick}
        className="bg-white dark:bg-neutral-950 rounded-3xl overflow-hidden card-shadow-premium hover:shadow-[0_12px_32px_rgba(0,0,0,0.12)] border border-gray-100 dark:border-neutral-800 transition-all cursor-pointer group flex flex-col h-full"
        style={{ pointerEvents: 'auto' }}
      >
      {/* Image Container (65-70% ratio height) */}
      <div className="relative h-56 sm:h-64 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-neutral-900 dark:to-neutral-950 overflow-hidden shrink-0">
        <img
          src={optimizeCloudinaryUrl(image, { width: 500, quality: 'auto', fetch_format: 'auto' }) || image}
          alt={name}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500 ease-out"
        />

        {/* Discount Badge */}
        {discountPercent > 0 && (
          <div className="absolute top-3 left-3 bg-orange-600 text-white px-3 py-1 rounded-full font-black text-xs shadow-md">
            -{discountPercent}%
          </div>
        )}

        {/* Favorite Button */}
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation();
            setIsFavorite(!isFavorite);
          }}
          className="absolute top-3 right-3 w-9 h-9 rounded-full border border-gray-200/80 dark:border-neutral-800 flex items-center justify-center bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md transition-all shadow-sm"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400 dark:text-neutral-300'
            }`}
          />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col justify-between flex-1">
        <div>
          {/* Shop Name & Rating */}
          <div className="flex items-center justify-between mb-1.5 gap-2">
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 truncate max-w-[130px]">
              {shopName || category}
            </span>
            <div className="flex items-center gap-1 text-xs font-bold text-amber-500 shrink-0">
              <span>★</span>
              <span className="text-gray-800 dark:text-neutral-100">{rating.toFixed(1)}</span>
            </div>
          </div>

          {/* Product Name */}
          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-1 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors leading-tight">
            {name}
          </h3>

          {/* Weight / Detail */}
          {weight && <p className="text-xs text-gray-500 dark:text-neutral-300 mb-2">{weight}</p>}
        </div>

        {/* Price & Elevated Action Button */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gray-100 dark:border-neutral-800">
          <div className="flex flex-col">
            <span className="text-base font-black text-gray-900 dark:text-white leading-tight">
              KSh {price.toLocaleString()}
            </span>
            {originalPrice > price && (
              <span className="text-[11px] text-gray-400 line-through">
                KSh {originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Rounded Elevated ○ + Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              if (onAddToCart) {
                onAddToCart(id);
              } else {
                setIsModalOpen(true);
              }
            }}
            className="w-9 h-9 rounded-full bg-orange-600 hover:bg-orange-500 text-white btn-shadow-elevated flex items-center justify-center transition-all shrink-0 font-black text-lg"
            title="Add to cart"
          >
            +
          </motion.button>
        </div>
      </div>
    </motion.div>

    {/* Product Quick View Modal */}
    <ProductQuickViewModal
      isOpen={isModalOpen}
      product={{
        id,
        name,
        category,
        image,
        price,
        originalPrice,
        rating,
        reviews,
        description,
      }}
      onClose={() => setIsModalOpen(false)}
      onAddToCart={(productId) => {
        onAddToCart?.(productId);
        setIsModalOpen(false);
      }}
    />
    </>
  );
};
