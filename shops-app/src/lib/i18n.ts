import { useLanguageStore, type Language } from '../store/useLanguage';
// Full interface dictionary (English → Somali). The hand-written STRINGS
// below take precedence; this covers every other UI string in the app.
import SO_DICTIONARY from '../locales/so.json';

/**
 * Static chrome strings dictionary with full Somali and English pairs.
 * When bilingual mode is selected, translate() renders both languages
 * (e.g. "Guriga / Home" or "Badeecadaha Gaarka ah (Featured Products)").
 */
const STRINGS: Record<string, { en: string; so: string }> = {
    // Navigation & Primary Chrome
    'Home': { en: 'Home', so: 'Guriga' },
    'Explore': { en: 'Explore', so: 'Sahmin' },
    'Sell': { en: 'Sell', so: 'Iibi' },
    'Orders': { en: 'Orders', so: 'Dalabyada' },
    'Profile': { en: 'Profile', so: 'Xisaabta' },
    'Grocery': { en: 'Grocery', so: 'Raashinka & Khudaarta' },
    'Deals': { en: 'Deals', so: 'Qiimo Dhimis' },
    'Search Suqafuran': { en: 'Search Suqafuran', so: 'Ka Raadi Suqafuran' },
    'Search products, shops, services...': { en: 'Search products, shops, services...', so: 'Raadi badeecado, dukaamo, adeegyo...' },
    'Search products, shops, services…': { en: 'Search products, shops, services…', so: 'Raadi badeecado, dukaamo, adeegyo…' },
    'Search listings in Somalia…': { en: 'Search listings in Somalia…', so: 'Ka raadi badeecado Soomaaliya…' },
    'Select Location': { en: 'Select Location', so: 'Dooro Goobta' },
    'Location': { en: 'Location', so: 'Goobta' },
    'Sign In': { en: 'Sign In', so: 'Soo Gal' },
    'Sign Up': { en: 'Sign Up', so: 'Is Diiwaangeli' },
    'Sign Out': { en: 'Sign Out', so: 'Ka Bax' },
    'Delivery': { en: 'Delivery', so: 'Gaarsiin' },
    'Pickup': { en: 'Pickup', so: 'Qaadasho' },
    'Favorites': { en: 'Favorites', so: 'La Jeclaaday' },
    'Following': { en: 'Following', so: 'La Raacaayo' },
    'Cart': { en: 'Cart', so: 'Dambiisha' },
    'Chat': { en: 'Chat', so: 'Farriimaha' },
    'Messages': { en: 'Messages', so: 'Farriimaha' },
    'Notifications': { en: 'Notifications', so: 'Ogeysiisyada' },
    'Settings': { en: 'Settings', so: 'Habaynta' },

    // Homepage Sections & Marketplace Carousels
    'Featured Products': { en: 'Featured Products', so: 'Badeecadaha Gaarka ah' },
    'Today\'s Deals': { en: 'Today\'s Deals', so: 'Qiimo Dhimista Maanta' },
    'Popular Shops': { en: 'Popular Shops', so: 'Dukaamaha Caanka ah' },
    'Shop by Category': { en: 'Shop by Category', so: 'Ku Dukaameyso Qaybaha' },
    'View All': { en: 'View All', so: 'Arag Dhammaan' },
    'View All Shops': { en: 'View All Shops', so: 'Arag Dhammaan Dukaamaha' },
    'Trending in Somalia': { en: 'Trending in Somalia', so: 'Ugu Caansan Soomaaliya' },
    'Recent Searches': { en: 'Recent Searches', so: 'Kuwii Dhowaa' },

    // Actions & Buttons
    'Add to cart': { en: 'Add to cart', so: 'Ku dar dambiisha' },
    'Added to cart!': { en: 'Added to cart!', so: 'Dambiisha ayaa lagu daray!' },
    'Buy Now': { en: 'Buy Now', so: 'Iibso Hadda' },
    'Contact Seller': { en: 'Contact Seller', so: 'La Xiriir Iibiyaha' },
    'Call Seller': { en: 'Call Seller', so: 'Wac Iibiyaha' },
    'WhatsApp': { en: 'WhatsApp', so: 'WhatsApp' },
    'Verified': { en: 'Verified', so: 'La Xaqiijiyay' },
    'Seller': { en: 'Seller', so: 'Iibiye' },
    'Verified Seller': { en: 'Verified Seller', so: 'Iibiye La Xaqiijiyay' },
    'Direct from seller': { en: 'Direct from seller', so: 'Toos uga iibso iibiyaha' },
    'Sold': { en: 'Sold', so: 'Waa la Iibiyay' },
    'In Stock': { en: 'In Stock', so: 'Wuu Yaallaa' },
    'Out of Stock': { en: 'Out of Stock', so: 'Wuu Dhamaaday' },
    'Share': { en: 'Share', so: 'La Wadaag' },
    'Search': { en: 'Search', so: 'Raadi' },

    // Filter Drawer
    'Filters': { en: 'Filters', so: 'Shaandhaynta' },
    'Sort By': { en: 'Sort By', so: 'U Kala Saar' },
    'Newest First': { en: 'Newest First', so: 'Kuwii Ugu Dambeeyay' },
    'Price: Low → High': { en: 'Price: Low → High', so: 'Qiimaha: Hoose → Sare' },
    'Price: High → Low': { en: 'Price: High → Low', so: 'Qiimaha: Sare → Hoose' },
    'Most Popular': { en: 'Most Popular', so: 'Ugu Caansan' },
    'Price Range': { en: 'Price Range', so: 'Xadka Qiimaha' },
    'Price Range (USD)': { en: 'Price Range (USD)', so: 'Xadka Qiimaha (USD)' },
    'Condition': { en: 'Condition', so: 'Xaaladda' },
    'New': { en: 'New', so: 'Cusub' },
    'Used': { en: 'Used', so: 'La Isticmaalay' },
    'Refurbished': { en: 'Refurbished', so: 'La Cusboonaysiiyay' },
    'All Somalia': { en: 'All Somalia', so: 'Dhammaan Soomaaliya' },
    'Verified Sellers Only': { en: 'Verified Sellers Only', so: 'Iibiyeyaasha La Xaqiijiyay Kaliya' },
    'Only show items from KYC-verified merchants': {
        en: 'Only show items from KYC-verified merchants',
        so: 'Kaliya tus badeecadaha ganacsatada la xaqiijiyay'
    },
    'Reset': { en: 'Reset', so: 'Dib u Celi' },
    'Apply Filters': { en: 'Apply Filters', so: 'Codso Shaandhada' },

    // Location & Marketing
    'Use Current Location': { en: 'Use Current Location', so: 'Isticmaal Goobta Hadda' },
    'Detecting Location...': { en: 'Detecting Location...', so: 'Waa la baarayaa Goobta...' },
    'Search any city, town, or address': { en: 'Search any city, town, or address', so: 'Raadi magaalo, tuulo, ama cinwaan' },
    'Buy, Sell & Trade Securely in Somalia': { en: 'Buy, Sell & Trade Securely in Somalia', so: 'Ku Iibi, Ku Iibso & Ku Ganacso Si Ammaan Ah Soomaaliya' },
    'Enter your city or neighborhood...': { en: 'Enter your city or neighborhood...', so: 'Geli magaaladaada ama deegaankaaga...' },
    'Sign in for saved addresses': { en: 'Sign in for saved addresses', so: 'U gal cinwaanada la keydiyay' },
    'Start Selling & Earn': { en: 'Start Selling & Earn', so: 'Bilow Iibinta & Faa\'iido' },
    'Have items to sell? Post ads for free in minutes and reach thousands nearby.': { en: 'Have items to sell? Post ads for free in minutes and reach thousands nearby.', so: 'Ma haysaa badeecad aad iibiso? Ku dar xayeysiis bilaash ah dhowr daqiiqo gudahood.' },
    'Grow Your Business': { en: 'Grow Your Business', so: 'Kordhi Ganacsigaaga' },
    'Create a digital storefront, manage products, track orders, and build trust.': { en: 'Create a digital storefront, manage products, track orders, and build trust.', so: 'Abuur dukaan dijital ah, maaree alaabta, la soco dalabaadka, kuna dhis kalsooni.' },
    'Get the Mobile App': { en: 'Get the Mobile App', so: 'Hel App-ka Mobilka' },
    'Enjoy live chat alerts, precise location matching, and offline sync.': { en: 'Enjoy live chat alerts, precise location matching, and offline sync.', so: 'Ku raaxayso ogeysiisyada tooska ah, helitaanka goobta, iyo wada-shaqaynta offline-ka.' },
    'Become a Seller': { en: 'Become a Seller', so: 'Noqo Iibiye' },
    'Grow Store': { en: 'Grow Store', so: 'Kordhi Dukaanka' },
    'Download App': { en: 'Download App', so: 'Dajiso App-ka' },
    'Get more from your neighborhood': { en: 'Get more from your neighborhood', so: 'Ka hel wax badan agagaarkaaga' },
    'Top Cities': { en: 'Top Cities', so: 'Magaalooyinka Ugu Waaweyn' },
    'Top Categories': { en: 'Top Categories', so: 'Qaybaha Ugu Caansan' },
    'Top Storefronts': { en: 'Top Storefronts', so: 'Dukaamaha Ugu Wanaagsan' },
};

/**
 * Standard translation helper.
 * If language is 'bilingual', renders "Somali / English".
 * If language is 'so', renders Somali (with English fallback).
 * If language is 'en', renders English.
 */
const SO_MAP: Record<string, string> = SO_DICTIONARY as Record<string, string>;

/** Somali for an English UI string, or null when there's no entry. */
export function lookupSomali(en: string): string | null {
    return STRINGS[en]?.so || SO_MAP[en] || null;
}

export function translate(key: string, language: Language): string {
    const entry = STRINGS[key] ?? (SO_MAP[key] ? { en: key, so: SO_MAP[key] } : undefined);
    if (!entry) return key;

    if (language === 'bilingual') {
        if (entry.so && entry.en && entry.so.toLowerCase() !== entry.en.toLowerCase()) {
            return `${entry.so} / ${entry.en}`;
        }
        return entry.so || entry.en;
    }

    if (language === 'so') {
        return entry.so || entry.en;
    }

    return entry.en || entry.so || key;
}

/** Hook form — re-renders automatically when the language preference changes. */
export function useT() {
    const language = useLanguageStore((s) => s.language);
    return (key: string) => translate(key, language);
}

/**
 * Localizes domain records that carry parallel `_en`/`_so` fields
 * (listing titles, categories, shop details).
 * In bilingual mode, outputs "Soomaali (English)" when both exist.
 * In Somali mode, prefers Somali with English fallback.
 */
export function useLocalizedField() {
    const language = useLanguageStore((s) => s.language);
    return (en: string, so?: string | null) => {
        const cleanSo = so?.trim();
        const cleanEn = en?.trim();

        if (language === 'bilingual') {
            if (cleanSo && cleanEn && cleanSo.toLowerCase() !== cleanEn.toLowerCase()) {
                return `${cleanSo} (${cleanEn})`;
            }
            return cleanSo || cleanEn || '';
        }

        if (language === 'so') {
            return cleanSo || cleanEn || '';
        }

        return cleanEn || cleanSo || '';
    };
}
