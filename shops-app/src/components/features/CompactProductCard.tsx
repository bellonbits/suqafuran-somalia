"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
import { optimizeCloudinaryUrl } from '@/services/api';

interface CompactProductCardProps {
    product: any;
    quantity: number;
    onQuantityChange: (qty: number) => void;
    onOpenModal?: () => void;
}

export const CompactProductCard: React.FC<CompactProductCardProps> = ({
    product,
    quantity,
    onQuantityChange,
    onOpenModal,
}) => {
    const hasDiscount = Math.random() > 0.7;
    const discountPercent = hasDiscount ? Math.floor(Math.random() * 40) + 10 : 0;

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-gray-100 dark:border-neutral-800 p-3 flex gap-3 hover:shadow-md transition-all cursor-pointer"
            onClick={() => onOpenModal?.()}
        >
            {/* Product Image */}
            <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0">
                {product.images?.[0] ? (
                    <img
                        src={optimizeCloudinaryUrl(product.images[0], { width: 150 }) || product.images[0]}
                        alt={product.title_en}
                        loading="eager"
                        decoding="async"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-8 h-8 text-gray-400" />
                    </div>
                )}

                {/* Discount Badge */}
                {hasDiscount && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded-md font-bold text-xs flex items-center gap-1">
                        <Minus className="w-3 h-3" />
                        {discountPercent}%
                    </div>
                )}
            </div>

            {/* Product Info */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
                {/* Title & Description */}
                <div onClick={(e) => e.stopPropagation()}>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 mb-1">
                        {product.title_en}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-300 line-clamp-1">
                        {product.description || 'Premium quality product'}
                    </p>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-2">
                    <span className="text-sm"></span>
                    <span className="text-xs text-gray-600 dark:text-neutral-300 font-semibold">4.8</span>
                </div>

                {/* Price & Action */}
                <div className="flex items-end justify-between gap-2">
                    <div onClick={(e) => e.stopPropagation()}>
                        <p className="font-bold text-gray-900 dark:text-white text-sm">
                            KSh {(product?.price || 0).toLocaleString()}
                        </p>
                        {product.original_price && (
                            <p className="text-xs text-gray-400 line-through">
                                KSh {product.original_price.toLocaleString()}
                            </p>
                        )}
                    </div>

                    {/* Quantity Control */}
                    <div onClick={(e) => e.stopPropagation()}>
                        {quantity === 0 ? (
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => onQuantityChange(1)}
                                className="bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 p-2 rounded-full transition-colors"
                            >
                                <Plus className="w-4 h-4 text-gray-700 dark:text-neutral-200" />
                            </motion.button>
                        ) : (
                            <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-800 rounded-full px-2 py-1">
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onQuantityChange(quantity - 1)}
                                    className="text-gray-700 dark:text-neutral-200 hover:text-red-600"
                                >
                                    <Minus className="w-3 h-3" />
                                </motion.button>
                                <span className="text-xs font-bold text-gray-900 dark:text-white w-4 text-center">
                                    {quantity}
                                </span>
                                <motion.button
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => onQuantityChange(quantity + 1)}
                                    className="text-gray-700 dark:text-neutral-200 hover:text-[#5bc0e8]"
                                >
                                    <Plus className="w-3 h-3" />
                                </motion.button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
