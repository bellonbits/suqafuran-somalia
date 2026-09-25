import { Briefcase, Smartphone, Trees, Dumbbell, Wrench, ShoppingBasket, Sparkles, Shirt, Sofa, Car, PawPrint, Building2, Settings, Wheat, Baby, Warehouse, type LucideIcon } from 'lucide-react';

// Lucide icon components for the sidebar nav's category list (rendered as
// <Icon className="..." />, not an image).
const CATEGORY_LUCIDE_ICONS: Record<string, LucideIcon> = {
  'commercial-equipment':  Warehouse,
  'electronics':           Smartphone,
  'land-farms':            Trees,
  'leisure-sports':        Dumbbell,
  'repair-construction':   Wrench,
  'food-groceries':        ShoppingBasket,
  'beauty-personal-care':  Sparkles,
  'clothing-shoes':        Shirt,
  'fashion':                Shirt,
  'household-items':       Sofa,
  'vehicles':              Car,
  'livestock':             PawPrint,
  'livestock-and-pets':    PawPrint,
  'property':              Building2,
  'services':              Settings,
  'jobs':                  Briefcase,
  'agriculture-food':      Wheat,
  'agriculture-inputs':    Wheat,
  'phones':                Smartphone,
  'phones-and-tablets':    Smartphone,
  'babies-kids':           Baby,
};

export function getCategoryIcon(slug: string): LucideIcon {
  return CATEGORY_LUCIDE_ICONS[slug] || Briefcase;
}

// ─── Category Stickers Icon Mapping ──────────────────────────────────────────
// Image paths for the homepage/shop-directory category sticker row
// (circular icon + label), distinct from the sidebar's Lucide icons above.
export const CATEGORY_ICONS: Record<string, string> = {
  'food-groceries':      '/icons/fruits.png',
  'grocery':             '/icons/fruits.png',
  'agriculture-food':    '/icons/fruits.png',
  'agriculture-inputs':  '/icons/fruits.png',
  'health-beauty':       '/icons/beauty.png',
  'beauty-personal-care':'/icons/beauty.png',
  'leisure-sports':      '/icons/soccer-ball.png',
  'clothing-shoes':      '/icons/street-market.png',
  'fashion':             '/icons/street-market.png',
  'electronics':         '/icons/keyboard.png',
  'household-items':     '/icons/households.png',
  'vehicles':            '/icons/classic-car.png',
  'livestock':           '/icons/cow.png',
  'property':            '/icons/for-rent.png',
  'services':            '/icons/24-hours-support.png',
  'commercial-equipment':'/icons/container.png',
  'land-farms':          '/icons/farm.png',
  'repair-construction': '/icons/repair.png',
  'jobs':                '/icons/job-search.png',
  'mobiles':             '/icons/mobile-app.png',
  'phones':              '/icons/mobile-app.png',
  'babies-kids':         '/icons/baby.png',
};

export function getCategoryStickerIcon(slug: string): string {
  const normalized = slug.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return icon;
    }
  }
  return '/icons/street-market.png';
}
