/**
 * Category slug → sticker image path (for pills)
 * Maps canonical categories to their Flaticon sticker images
 */
export const CATEGORY_IMAGE_MAP: Record<string, string> = {
    'food-groceries':        '/icons/fruits.png',
    'agriculture-food':      '/icons/farm.png',
    'beauty-personal-care':  '/icons/makeup.png',
    'leisure-sports':        '/icons/soccer-ball.png',
    'clothing-shoes':        '/icons/street-market.png',
    electronics:             '/icons/keyboard.png',
    phones:                  '/icons/mobile-app.png',
    'babies-kids':           '/icons/baby.png',
    vehicles:                '/icons/classic-car.png',
    'household-items':       '/icons/shelves.png',
    'land-farms':            '/icons/farm.png',
    livestock:               '/icons/cow.png',
    property:                '/icons/for-rent.png',
    'repair-construction':   '/icons/repair.png',
    jobs:                    '/icons/job-search.png',
    services:                '/icons/24-hours-support.png',
    'commercial-equipment':  '/icons/container.png',
    all:                     '/icons/fruits.png',
    deals:                   '/icons/fruits.png',
};

/**
 * Category slug → banner image path (for hero sections)
 * Large promotional banners for category pages
 */
/**
 * Category slug → banner image path (for hero sections)
 * Large promotional banners for category pages
 */
export const CATEGORY_BANNER_MAP: Record<string, string> = {
    'food-groceries':       '/categories/grocery.jpg',
    'agriculture-food':     '/categories/grocery.jpg',
    'beauty-personal-care': '/categories/skincare.png',
    'leisure-sports':       '/categories/sport.jpg',
    'clothing-shoes':       '/categories/shoes.png',
    electronics:            '/categories/electronics.png',
    phones:                 '/categories/phones.png',
    'babies-kids':          '/categories/baby.png',
    vehicles:               '/categories/car.png',
    'household-items':      '/categories/house.png',
    'land-farms':           '/categories/livestock.png',
    livestock:              '/categories/livestock.png',
    property:               '/categories/house.png',
    'repair-construction':  '/categories/services.png',
    jobs:                   '/categories/services.png',
    services:               '/categories/services.png',
    'commercial-equipment': '/categories/electronics.png',
};

/**
 * Promotional banner images for homepage
 */
export const PROMO_BANNERS = {
    grocery: '/categories/Bag Promotion.png',
    skincare: '/categories/Skincare Promotion.png',
};

export function getCategoryImage(slug: string): string {
    const lower = slug.toLowerCase().replace(/\s+/g, '-');
    return CATEGORY_IMAGE_MAP[lower] || '/icons/fruits.png';
}

export function getCategoryBanner(slug: string): string {
    const lower = slug.toLowerCase().replace(/\s+/g, '-');
    return CATEGORY_BANNER_MAP[lower] || '/categories/grocery.jpg';
}
