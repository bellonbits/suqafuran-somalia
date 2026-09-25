"use client";

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, ShoppingCart, Star } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/services/api';

interface ProductQuickViewModalProps {
  isOpen: boolean;
  product?: {
    id: number;
    name: string;
    image: string;
    images?: string[];
    price: number;
    originalPrice: number;
    rating: number;
    reviews: number;
    description: string;
    category: string;
  };
  onClose: () => void;
  onAddToCart?: (productId: number) => void;
}

export const ProductQuickViewModal: React.FC<ProductQuickViewModalProps> = ({
  isOpen,
  product,
  onClose,
  onAddToCart,
}) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [mounted, setMounted] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset to the first image whenever a different product is opened
  useEffect(() => {
    setActiveImage(0);
    if (galleryRef.current) galleryRef.current.scrollLeft = 0;
  }, [product?.id, isOpen]);

  useEffect(() => {
    console.log('🎯 ProductQuickViewModal render', { isOpen, productName: product?.name, mounted });
  }, [isOpen, product?.name, mounted]);

  if (!product || !mounted) return null;

  const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  const handleGalleryScroll = () => {
    const el = galleryRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveImage(index);
  };

  const scrollToImage = (index: number) => {
    const el = galleryRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setActiveImage(index);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-50"
          />

          {/* Modal - Glovo Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full mx-4 max-w-md max-h-[90vh] overflow-y-auto relative pointer-events-auto">
              {/* Close Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="absolute top-6 right-6 z-10 w-12 h-12 rounded-full border-2 border-orange-500 text-orange-500 hover:bg-orange-50 flex items-center justify-center shadow-lg transition-all"
              >
                <X className="w-6 h-6" />
              </motion.button>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-8"
              >
                {/* Product Image Gallery — swipe/scroll through all photos */}
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-6">
                  <div
                    ref={galleryRef}
                    onScroll={handleGalleryScroll}
                    className="no-scrollbar h-full w-full flex overflow-x-auto snap-x snap-mandatory"
                  >
                    {images.map((src, i) => (
                      <img
                        key={i}
                        src={optimizeCloudinaryUrl(src, { width: 600, quality: 'auto', fetch_format: 'auto' }) || src}
                        alt={`${product.name} ${i + 1}`}
                        className="h-full w-full object-cover shrink-0 snap-center"
                        draggable={false}
                      />
                    ))}
                  </div>

                  {/* Discount Badge - Glovo Style */}
                  {discountPercent > 0 && (
                    <div className="absolute bottom-4 left-4 bg-red-600 text-white px-3 py-2 rounded-lg font-bold text-base pointer-events-none">
                      -{discountPercent}%
                    </div>
                  )}

                  {/* Dot indicators + tap-to-jump, only when there's more than one photo */}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => scrollToImage(i)}
                          aria-label={`View photo ${i + 1}`}
                          className={`rounded-full transition-all ${
                            i === activeImage ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Title */}
                <h2 className="text-2xl font-black text-gray-900 mb-4 line-clamp-3 leading-tight">
                  {product.name}
                </h2>

                {/* Price - Glovo Style */}
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-3xl font-black text-gray-900">
                    KSh{(product?.price ?? 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  </span>
                  {product.originalPrice > product.price && (
                    <span className="text-lg text-gray-400 line-through">
                      KSh{product.originalPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                  )}
                </div>

                {/* Description - Prominent Display */}
                <p className="text-gray-700 leading-relaxed text-base mb-8">
                  {product.description}
                </p>

                {/* Quantity Selector - Glovo Style */}
                <div className="flex items-center justify-center gap-4 mb-6 bg-gray-100 rounded-full p-2 w-fit mx-auto">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-700 font-bold text-lg transition-colors flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded-full hover:bg-gray-200 text-gray-700 font-bold text-lg transition-colors flex items-center justify-center"
                  >
                    +
                  </button>
                </div>

                {/* Add to Cart Button - Glovo Style */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onAddToCart?.(product.id);
                    onClose();
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 px-6 rounded-full text-lg transition-colors shadow-lg"
                >
                  Add {quantity} for KSh{((product?.price ?? 0) * quantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </motion.button>

                {/* Favorite Button - Bottom */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="w-full mt-4 py-3 rounded-full border-2 border-gray-300 hover:border-red-600 flex items-center justify-center gap-2 transition-all"
                >
                  <Heart
                    className={`w-5 h-5 transition-colors ${
                      isFavorite ? 'fill-red-600 text-red-600' : 'text-gray-400'
                    }`}
                  />
                  <span className={`font-semibold ${isFavorite ? 'text-red-600' : 'text-gray-700'}`}>
                    {isFavorite ? 'Saved' : 'Save'}
                  </span>
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
