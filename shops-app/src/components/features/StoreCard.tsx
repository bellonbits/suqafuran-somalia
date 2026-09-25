"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeShopSlug } from '@/services/listings';

interface StoreCardProps {
  id: number | string;
  name: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  distance?: number;
  category?: string;
  subcategories?: string[];
  productCount?: number;
  coverImage?: string;
  logo?: string;
  isVerified?: boolean;
  isFreeDelivery?: boolean;
  isOpen?: boolean;
  promotion?: string;
  popularProducts?: any[];
  shopPageBanner?: string;
  location?: string;
}

// Exact mapping of categories/subcategories to banner images
// Based on /new-frontend/public/categories/
const CATEGORY_BANNER_MAP: Record<string, string> = {
  // ===== ELECTRONICS (ID: 4) =====
  'electronics': '/categories/electronics.png',
  'audio & headphones': '/categories/electronics.png',
  'computers': '/categories/electronics.png',
  'tvs': '/categories/electronics.png',
  'cameras': '/categories/electronics.png',
  'networking': '/categories/electronics.png',
  'gaming': '/categories/electronics.png',
  'other electronics': '/categories/electronics.png',

  // ===== MOBILE PHONES (ID: 16) =====
  'phones': '/categories/phones.png',
  'mobile phones': '/categories/phones.png',
  'tablets': '/categories/phones.png',
  'phone accessories': '/categories/phones.png',
  'smart watches': '/categories/phones.png',

  // ===== CLOTHING & SHOES (ID: 2) =====
  'clothing & shoes': '/categories/shoes.png',
  "men's clothing": '/categories/shoes.png',
  "women's clothing": '/categories/shoes.png',
  "children's clothing": '/categories/shoes.png',
  'shoes': '/categories/shoes.png',
  'clothing accessories': '/categories/shoes.png',
  'watches & sunglasses': '/categories/shoes.png',

  // ===== FOOD & GROCERIES (ID: 1) =====
  'food & groceries': '/categories/grocery.jpg',
  'eggs': '/categories/grocery.jpg',
  'spices & condiments': '/categories/grocery.jpg',
  'bakery': '/categories/grocery.jpg',
  'snacks': '/categories/grocery.jpg',
  'vegetables': '/categories/grocery.jpg',
  'fruits': '/categories/grocery.jpg',
  'rice & pasta': '/categories/grocery.jpg',
  'meat': '/categories/grocery.jpg',
  'seafood': '/categories/grocery.jpg',
  'milk & dairy': '/categories/grocery.jpg',
  'prepared foods': '/categories/grocery.jpg',
  'beverages': '/categories/grocery.jpg',

  // ===== HOUSEHOLD ITEMS (ID: 3) =====
  'household items': '/categories/house.png',
  'kitchenware': '/categories/house.png',
  'bedding': '/categories/house.png',
  'home decor': '/categories/house.png',
  'cleaning supplies': '/categories/house.png',
  'appliances': '/categories/house.png',
  'furniture': '/categories/house.png',
  'garden supplies': '/categories/house.png',

  // ===== PROPERTY (ID: 8) =====
  'property': '/categories/house.png',
  'houses for rent': '/categories/house.png',
  'houses for sale': '/categories/house.png',
  'offices & commercial': '/categories/house.png',
  'new builds': '/categories/house.png',
  'short stay': '/categories/house.png',

  // ===== BEAUTY & PERSONAL CARE (ID: 11) =====
  'beauty & personal care': '/categories/skincare.jpg',
  'hair beauty': '/categories/skincare.jpg',
  'face care': '/categories/skincare.jpg',
  'oral care': '/categories/skincare.jpg',
  'body care': '/categories/skincare.jpg',
  'fragrance': '/categories/skincare.jpg',
  'makeup': '/categories/skincare.jpg',
  'tools & accessories': '/categories/skincare.jpg',
  'vitamins & supplements': '/categories/skincare.jpg',
  'massagers': '/categories/skincare.jpg',
  'beauty treatments': '/categories/skincare.jpg',

  // ===== LEISURE & SPORTS (ID: 13) =====
  'leisure & sports': '/categories/sport.jpg',
  'football shoes': '/categories/sport.jpg',
  'training bags': '/categories/sport.jpg',
  'football nets': '/categories/sport.jpg',
  'football tracksuit': '/categories/sport.jpg',
  'match shorts': '/categories/sport.jpg',
  'football ball': '/categories/sport.jpg',
  'sports equipment': '/categories/sport.jpg',
  'musical instruments': '/categories/sport.jpg',
  'books & magazines': '/categories/sport.jpg',
  'art & collectibles': '/categories/sport.jpg',
  'hobbies': '/categories/sport.jpg',

  // ===== VEHICLES (ID: 5) =====
  'vehicles': '/categories/car.png',
  'trucks': '/categories/car.png',
  'cars': '/categories/car.png',
  'motorcycles': '/categories/car.png',
  'tuk-tuks': '/categories/car.png',
  'trucks & buses': '/categories/car.png',
  'vehicle parts & accessories': '/categories/car.png',
  'car services': '/categories/car.png',

  // ===== LIVESTOCK (ID: 6) =====
  'livestock': '/categories/livestock.png',
  'wildlife': '/categories/livestock.png',
  'sea food': '/categories/livestock.png',
  'goats': '/categories/livestock.png',
  'sheep': '/categories/livestock.png',
  'cattle': '/categories/livestock.png',
  'poultry': '/categories/livestock.png',
  'camels': '/categories/livestock.png',
  'pets': '/categories/livestock.png',

  // ===== BABIES & KIDS (ID: 12) =====
  'babies & kids': '/categories/baby.png',
  'toys & games': '/categories/baby.png',
  'kids clothing': '/categories/baby.png',
  'baby gear': '/categories/baby.png',
  'baby food': '/categories/baby.png',
  'kids education': '/categories/baby.png',

  // ===== SERVICES (ID: 9) =====
  'services': '/categories/services.png',
  'building & construction': '/categories/services.png',
  'computer & it': '/categories/services.png',
  'cleaning services': '/categories/services.png',
  'repair services': '/categories/services.png',
  'printing services': '/categories/services.png',
  'legal & financial': '/categories/services.png',
  'travel & tourism': '/categories/services.png',
  'education & training': '/categories/services.png',
  'beauty & wellness': '/categories/services.png',
  'photography & video': '/categories/services.png',
  'healthcare': '/categories/services.png',
  'other services': '/categories/services.png',

  // ===== REPAIR & CONSTRUCTION (ID: 15) =====
  'repair & construction': '/categories/services.png',
  'building materials': '/categories/services.png',
  'electrical supplies': '/categories/services.png',
  'hand & power tools': '/categories/services.png',
  'doors, windows & steel': '/categories/services.png',
  'solar energy': '/categories/services.png',
  'plumbing': '/categories/services.png',

  // ===== JOBS (ID: 10) =====
  'jobs': '/categories/services.png',
  'tech & it': '/categories/services.png',
  'education': '/categories/services.png',
  'medical & health jobs': '/categories/services.png',
  'sales & marketing': '/categories/services.png',
  'admin & office': '/categories/services.png',
  'construction & trade': '/categories/services.png',
  'driver & transport': '/categories/services.png',
  'domestic & cleaning': '/categories/services.png',
  'other jobs': '/categories/services.png',

  // ===== LAND & FARMS (ID: 7) =====
  'land & farms': '/categories/livestock.png',
  'vacant land': '/categories/livestock.png',
  'farms': '/categories/livestock.png',
  'agricultural land': '/categories/livestock.png',
  'market gardens': '/categories/livestock.png',

  // ===== AGRICULTURE & FOOD (ID: 17) =====
  'agriculture & food': '/categories/livestock.png',
  'grains': '/categories/livestock.png',

  // ===== COMMERCIAL EQUIPMENT (ID: 14) =====
  'commercial equipment': '/categories/services.png',
  'office equipment': '/categories/services.png',
  'industrial machinery': '/categories/services.png',
  'agricultural equipment': '/categories/services.png',
  'restaurant equipment': '/categories/services.png',
  'other commercial': '/categories/services.png',
};

export const StoreCard: React.FC<StoreCardProps> = ({
  id,
  name,
  rating,
  reviewCount,
  deliveryTime,
  distance,
  category,
  subcategories = [],
  productCount,
  coverImage,
  logo,
  isVerified,
  isFreeDelivery,
  isOpen,
  promotion,
  popularProducts = [],
  shopPageBanner,
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const handleCardClick = () => {
    router.push(`/shop/${makeShopSlug(name, id)}`);
  };

  const ratingPercent = Math.round(rating * 10);

  // Get banner image - prioritize custom shop banner over category banners
  let bannerImage = shopPageBanner || '/categories/grocery.jpg'; // Default fallback

  // If no custom banner, use category-based banner
  if (!shopPageBanner) {
    if (subcategories && subcategories.length > 0) {
      // Try to use the first subcategory for banner
      const subCatLower = subcategories[0].toLowerCase().trim();
      bannerImage = CATEGORY_BANNER_MAP[subCatLower] ||
                    CATEGORY_BANNER_MAP[subCatLower.replace(/ /g, '-')] ||
                    bannerImage;
    }

    // Fall back to main category if subcategory didn't yield result
    if (bannerImage === '/categories/grocery.jpg' && category) {
      const categoryLower = category.toLowerCase().trim();
      bannerImage = CATEGORY_BANNER_MAP[categoryLower] ||
                    CATEGORY_BANNER_MAP[categoryLower.replace(/ /g, '-')] ||
                    bannerImage;
    }
  }

  const showPromotion = Math.random() > 0.5;
  const mockPromotions = ['-68% some items', '-15% whole menu', '-30% some items', 'Promo some items'];
  const displayPromotion = promotion || (showPromotion ? mockPromotions[Math.floor(Math.random() * mockPromotions.length)] : null);

  return (
    <div className="cursor-pointer" onClick={handleCardClick}>
      {/* CARD - Image Banner Only */}
      <div className="relative w-full bg-gray-200 dark:bg-neutral-900 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ aspectRatio: '16 / 9', minHeight: '160px' }}>
        {/* Banner Image */}
        {!imageError ? (
          <img
            src={bannerImage}
            alt={name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-300 dark:bg-neutral-800">
            <span className="text-4xl">🏪</span>
          </div>
        )}

        {/* Promotion Badge - Top Left */}
        {displayPromotion && (
          <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
            {displayPromotion}
          </div>
        )}
      </div>

      {/* TEXT CONTENT - Below Card */}
      <div className="pt-3 px-0">
        {/* Shop Name - Larger */}
        <h3 className="font-bold text-gray-900 dark:text-white text-base line-clamp-1">
          {name}
        </h3>

        {/* Location - Secondary text */}
        <p className="text-xs text-gray-500 dark:text-neutral-300 mt-0.5 line-clamp-1">
          {location || 'Bakaara Market (Mogadishu)'}
        </p>

        {/* Rating + Stats Row */}
        <div className="flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-200 mt-2">
          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-0.5">
            ⭐ {(rating || 4.5).toFixed(1)}
          </span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600 dark:text-neutral-300">
            {productCount || 150} Products
          </span>
        </div>

        {/* Categories - if available */}
        {subcategories && subcategories.length > 0 && (
          <div className="mt-2">
            <span className="text-xs text-gray-600 dark:text-neutral-300 line-clamp-1">
              {subcategories.slice(0, 2).join(' • ')}
            </span>
          </div>
        )}

        {/* Verified Badge */}
        {isVerified && (
          <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
            ✓ Verified Seller
          </div>
        )}
      </div>
    </div>
  );
};
