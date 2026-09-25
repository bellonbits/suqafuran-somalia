"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { optimizeCloudinaryUrl } from '@/services/api';
import { makeShopSlug } from '@/services/listings';

interface ShopCircleCardProps {
  id: number;
  name: string;
  image: string;
  delay?: number;
}

export const ShopCircleCard: React.FC<ShopCircleCardProps> = ({
  id,
  name,
  image,
  delay = 0,
}) => {
  const router = useRouter();

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ scale: 1.08, y: -8 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => router.push(`/shop/${makeShopSlug(name, id)}`)}
      className="flex flex-col items-center gap-4 cursor-pointer group"
    >
      {/* Circular Image Container */}
      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-xl group-hover:shadow-2xl transition-shadow">
        {/* Background circle with border */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-100 to-sky-50" />

        {/* Image */}
        {image ? (
          <img
            src={optimizeCloudinaryUrl(image, { width: 300, quality: 'auto', fetch_format: 'auto' }) || image}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
            <span className="text-4xl">🏪</span>
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>

      {/* Label */}
      <div className="text-center">
        <h3 className="font-bold text-gray-900 text-sm md:text-base line-clamp-1 group-hover:text-[#6cd4ff] transition-colors">
          {name}
        </h3>
        <div className="h-1 w-8 bg-gradient-to-r from-sky-400 to-sky-500 rounded-full mx-auto mt-1 group-hover:w-12 transition-all" />
      </div>
    </motion.button>
  );
};
