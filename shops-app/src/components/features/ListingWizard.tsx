"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { ListingStep3Images } from './listing-wizard/Step3Images';
import { ListingStep4Review } from './listing-wizard/Step4Review';
import { listingsService } from '../../services/listings';
import { useRouter } from 'next/navigation';
import { trackEvent } from '../../lib/analytics';

export interface ListingFormData {
  shop_id?: number;
  category_id: number;
  subcategory_id?: number;
  subsubcategory_id?: number;
  title: string;
  description: string;
  location?: string;
  condition: 'new' | 'like_new' | 'good' | 'fair';
  images: Array<{ url: string; filename: string }>;
  videos?: string[];
  attributes?: Record<string, any>;
  price: number;
  compare_at_price?: number;
  negotiable: boolean;
  price_type: 'fixed' | 'negotiable' | 'contact';
  tags?: string[];
  brand?: string;
  stock_quantity?: number;
  sku?: string;
}

interface CategoryData {
  id: number;
  name: string;
  name_en?: string;
  slug?: string;
}

interface SubcategoryData extends CategoryData {
  category_id: number;
}

interface SubsubcategoryData extends SubcategoryData {
  subcategory_id: number;
}

const STEPS = [
  { id: 1, number: '01', title: 'Category' },
  { id: 2, number: '02', title: 'Details' },
  { id: 3, number: '03', title: 'Media & Pricing' },
  { id: 4, number: '04', title: 'Review' },
];

// Mock categories - replace with API call
const CATEGORIES = [
  { id: 1, name: 'Commercial Equipment' },
  { id: 2, name: 'Electronics' },
  { id: 3, name: 'Land & Farms' },
  { id: 4, name: 'Repair & Construction' },
  { id: 5, name: 'Leisure & Sports' },
  { id: 6, name: 'Clothing & Shoes' },
  { id: 7, name: 'Household Items' },
  { id: 8, name: 'Vehicles' },
  { id: 9, name: 'Livestock' },
  { id: 10, name: 'Property' },
  { id: 11, name: 'Services' },
  { id: 12, name: 'Food & Groceries' },
  { id: 13, name: 'Agriculture & Food' },
  { id: 14, name: 'Beauty & Personal Care' },
  { id: 15, name: 'Phones' },
  { id: 16, name: 'Jobs' },
  { id: 17, name: 'Babies & Kids' },
];

// Category-specific brands as fallback
const BRANDS_BY_CATEGORY: Record<number, string[]> = {
  1: ['Caterpillar', 'JCB', 'Komatsu', 'Volvo', 'Hyundai', 'Doosan'],
  2: ['Apple', 'Samsung', 'LG', 'Sony', 'Dell', 'HP', 'Lenovo', 'ASUS', 'Canon', 'Nikon'],
  3: ['Farmland Pro', 'Agriculture Plus', 'Local Farms', 'Agro Solutions'],
  4: ['Bosch', 'Makita', 'DeWalt', 'Stanley', 'Hilti', 'Metabo'],
  5: ['Nike', 'Adidas', 'Puma', 'Decathlon', 'Reebok', 'Asics'],
  6: ['Zara', 'H&M', 'Forever 21', 'ASOS', 'Shein', 'Mango'],
  7: ['IKEA', 'Furniture Plus', 'Home Decor Ltd', 'Interiors Pro'],
  8: ['Toyota', 'Honda', 'Nissan', 'Mazda', 'Hyundai', 'Kia', 'Mitsubishi'],
  9: ['Local Farms', 'Agro Exports', 'Livestock Plus', 'Pastoral'],
  10: ['Real Estate Ltd', 'Property Plus', 'Land Development'],
  11: ['Service Providers', 'Professional Services', 'Local Services'],
  12: ['Nestlé', 'Cadbury', 'Coca-Cola', 'Pepsi', 'Kimbo', 'Ushindi'],
  13: ['Agronomics', 'Farm Produce', 'Food Exports', 'Agriculture Hub'],
  14: ['Cerave', 'Neutrogena', 'Dove', 'Olay', 'Nivea', 'Vaseline'],
  15: ['Apple', 'Samsung', 'Tecno', 'Infinix', 'Itel', 'Xiaomi', 'Huawei'],
  16: ['Job Portal', 'Employment Agency', 'Professional Services'],
  17: ['Pampers', 'Huggies', 'Chicco', 'Mothercare', 'Baby Plus'],
};

// Default subcategories for all categories (fallback when API fails)
const SUBCATEGORIES_BY_CATEGORY: Record<number, Array<{ id: number; name: string }>> = {
  1: [
    { id: 101, name: 'Construction Equipment' },
    { id: 102, name: 'Industrial Machines' },
    { id: 103, name: 'Generators' },
    { id: 104, name: 'Restaurant Equipment' },
  ],
  2: [
    { id: 201, name: 'TVs' },
    { id: 202, name: 'Laptops' },
    { id: 203, name: 'Gaming' },
    { id: 204, name: 'Cameras' },
    { id: 205, name: 'Audio Systems' },
    { id: 206, name: 'Accessories' },
  ],
  3: [
    { id: 301, name: 'Agricultural Land' },
    { id: 302, name: 'Farmland' },
  ],
  4: [
    { id: 401, name: 'Tools & Equipment' },
    { id: 402, name: 'Repair Services' },
  ],
  5: [
    { id: 501, name: 'Sports Equipment' },
    { id: 502, name: 'Outdoor Gear' },
  ],
  6: [
    { id: 601, name: 'Men\'s Clothing' },
    { id: 602, name: 'Women\'s Clothing' },
    { id: 603, name: 'Shoes' },
  ],
  7: [
    { id: 701, name: 'Furniture' },
    { id: 702, name: 'Home Decor' },
    { id: 703, name: 'Kitchenware' },
  ],
  8: [
    { id: 801, name: 'Cars' },
    { id: 802, name: 'Motorcycles' },
    { id: 803, name: 'Vehicles Parts' },
  ],
  9: [
    { id: 901, name: 'Livestock' },
    { id: 902, name: 'Farm Animals' },
  ],
  10: [
    { id: 1001, name: 'Houses' },
    { id: 1002, name: 'Apartments' },
    { id: 1003, name: 'Land' },
  ],
  11: [
    { id: 1101, name: 'Professional Services' },
    { id: 1102, name: 'Personal Services' },
  ],
  12: [
    { id: 1201, name: 'Groceries' },
    { id: 1202, name: 'Food & Beverages' },
  ],
  13: [
    { id: 1301, name: 'Crops' },
    { id: 1302, name: 'Farm Produce' },
  ],
  14: [
    { id: 1401, name: 'Skincare' },
    { id: 1402, name: 'Haircare' },
    { id: 1403, name: 'Makeup' },
    { id: 1404, name: 'Fragrances' },
  ],
  15: [
    { id: 1501, name: 'Smartphones' },
    { id: 1502, name: 'Feature Phones' },
    { id: 1503, name: 'Tablets' },
    { id: 1504, name: 'Accessories' },
  ],
  16: [
    { id: 1601, name: 'Job Listings' },
  ],
  17: [
    { id: 1701, name: 'Baby Clothing' },
    { id: 1702, name: 'Toys' },
    { id: 1703, name: 'Baby Gear' },
  ],
};

// Location suggestions for Somalia
const SOMALIA_LOCATIONS = [
  'Bakaara Market, Mogadishu',
  'Hamar Weyne, Mogadishu',
  'Suuq Bacaad, Mogadishu',
  'KM4, Hodan, Mogadishu',
  'Madina, Wadajir, Mogadishu',
  'Waberi, Mogadishu',
  'Waaheen Market, Hargeisa',
  'Gobanimo, Hargeisa',
  'Suuqa Weyn, Bosaso',
  'Bander Qassim, Bosaso',
  'Suuqa Bartamaha, Garowe',
  'Suuqa Calanley, Kismayo',
  'Suuqa Isha, Baidoa',
  'Israac, Galkayo',
];

// Common brands across categories
const COMMON_BRANDS = [
  'Apple',
  'Samsung',
  'LG',
  'Sony',
  'Dell',
  'HP',
  'Lenovo',
  'ASUS',
  'Canon',
  'Nikon',
  'Nike',
  'Adidas',
  'Puma',
  'Gucci',
  'Louis Vuitton',
  'Zara',
  'H&M',
  'Forever 21',
  'Cerave',
  'Neutrogena',
  'CeraVe',
  'Olay',
  'Dove',
  'Lux',
  'Dettol',
  'Johnson & Johnson',
  'Unilever',
  'Nestlé',
  'Coca-Cola',
  'Pepsi',
  'Cadbury',
  'Mars',
  'Ferrero',
  'Kraft',
  'Heinz',
  'Danone',
  'Kimberly-Clark',
  'Procter & Gamble',
  'Colgate',
  'Oral-B',
  'Crest',
  'Gillette',
  'Schick',
  'Philips',
  'Panasonic',
  'Toshiba',
  'Siemens',
  'Bosch',
  'AEG',
  'Electrolux',
  'Whirlpool',
  'Indesit',
  'Ariston',
  'Baumatic',
  'Zanussi',
  'Beko',
  'Vestel',
  'Hotpoint',
  'Maytag',
  'GE Appliances',
  'Frigidaire',
  'KitchenAid',
  'Dyson',
  'Shark',
  'Bissell',
  'Hoover',
  'Eureka',
  'Kärcher',
  'Vileda',
  'Scotch-Brite',
  '3M',
  'WD-40',
  'Rust-Oleum',
  'Rustoleum',
  'Dulux',
  'Asian Paints',
  'Berger',
  'Nippon Paint',
  'ICI Paints',
  'Ferrari',
  'Lamborghini',
  'Porsche',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Volkswagen',
  'Ford',
  'Chevrolet',
  'GMC',
  'Tesla',
  'Toyota',
  'Honda',
  'Nissan',
  'Mazda',
  'Hyundai',
  'Kia',
  'Suzuki',
  'Datsun',
  'Renault',
  'Peugeot',
  'Citroën',
  'Fiat',
  'Alfa Romeo',
  'Lancia',
  'Jeep',
  'Dodge',
  'Ram',
  'Chevrolet',
  'Volvo',
  'Iveco',
  'Scania',
  'MAN',
  'DAF',
  'Caterpillar',
  'Komatsu',
  'JCB',
  'Kubota',
  'John Deere',
  'AGCO',
  'CNH Industrial',
  'Briggs & Stratton',
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Harley-Davidson',
  'KTM',
  'Ducati',
  'BMW Motorrad',
  'Triumph',
  'Royal Enfield',
  'Hero MotoCorp',
  'Bajaj',
  'TVS',
  'Vespa',
  'Piaggio',
  'Others'
].sort().filter((brand, index, array) => array.indexOf(brand) === index);

export const ListingWizard: React.FC = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<ListingFormData>({
    title: '',
    description: '',
    price: 0,
    compare_at_price: undefined,
    condition: 'good',
    negotiable: false,
    category_id: 0,
    images: [],
    price_type: 'fixed',
    tags: [],
    location: '',
    brand: '',
    stock_quantity: 1,
    sku: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [categoryBrands, setCategoryBrands] = useState<string[]>([]);
  const [categorySubcategories, setCategorySubcategories] = useState<Array<{ id: number; name: string }>>([]);
  const [subcategorySubsubcategories, setSubcategorySubsubcategories] = useState<Array<{ id: number; name: string; brands?: string[] }>>([]);
  const [allCategories, setAllCategories] = useState<Array<{ id: number; name: string; name_en?: string }>>([]);
  const locationInputRef = useRef<HTMLInputElement>(null);

  // Load all categories from API on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const cats = await listingsService.getCategories();
        if (Array.isArray(cats)) {
          setAllCategories(cats);
        }
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setAllCategories(CATEGORIES);
      }
    };
    loadCategories();
  }, []);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (!formData.category_id) {
      setCategorySubcategories([]);
      setSubcategorySubsubcategories([]);
      return;
    }

    const fetchSubcategories = async () => {
      try {
        const subcats = await listingsService.getSubcategories(formData.category_id);
        if (Array.isArray(subcats) && subcats.length > 0) {
          setCategorySubcategories(subcats);
          return;
        }
      } catch (err) {
        console.error('Failed to fetch subcategories from API:', err);
      }

      // Fallback to default subcategories for this category
      const defaultSubcats = SUBCATEGORIES_BY_CATEGORY[formData.category_id] || [];
      setCategorySubcategories(defaultSubcats);
    };

    fetchSubcategories();
  }, [formData.category_id]);

  // Fetch subsubcategories when subcategory changes
  useEffect(() => {
    if (!formData.subcategory_id) {
      setSubcategorySubsubcategories([]);
      return;
    }

    const fetchSubsubcategories = async () => {
      try {
        const subsubcats = await listingsService.getSubsubcategories(formData.subcategory_id);
        if (Array.isArray(subsubcats) && subsubcats.length > 0) {
          setSubcategorySubsubcategories(subsubcats);
        } else {
          setSubcategorySubsubcategories([]);
        }
      } catch (err) {
        console.error('Failed to fetch subsubcategories from API:', err);
        setSubcategorySubsubcategories([]);
      }
    };

    fetchSubsubcategories();
  }, [formData.subcategory_id]);

  // Brand options: prefer the selected sub-subcategory's own brand list
  // (seeded per sub-subcategory on the backend), falling back to the
  // category-level defaults when the sub-subcategory has none set.
  useEffect(() => {
    if (formData.subsubcategory_id) {
      const selected = subcategorySubsubcategories.find((s) => s.id === formData.subsubcategory_id);
      if (selected?.brands && selected.brands.length > 0) {
        setCategoryBrands(selected.brands);
        return;
      }
    }

    if (!formData.category_id) {
      setCategoryBrands([]);
      return;
    }

    const defaultBrands = BRANDS_BY_CATEGORY[formData.category_id] || [];
    setCategoryBrands(defaultBrands);
  }, [formData.category_id, formData.subcategory_id, formData.subsubcategory_id, subcategorySubsubcategories]);

  const updateFormData = (data: Partial<ListingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  };

  // Handle location autocomplete
  const handleLocationChange = (value: string) => {
    updateFormData({ location: value });
    if (value.length > 1) {
      const filtered = SOMALIA_LOCATIONS.filter((loc) =>
        loc.toLowerCase().includes(value.toLowerCase())
      );
      setLocationSuggestions(filtered);
      setShowLocationSuggestions(true);
    } else {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
    }
  };

  const selectLocation = (location: string) => {
    updateFormData({ location });
    setShowLocationSuggestions(false);
  };

  const handleNext = async () => {
    setError('');

    if (currentStep === 1) {
      if (!formData.shop_id) {
        setError('Please select a shop');
        return;
      }
      if (!formData.category_id) {
        setError('Please select a category');
        return;
      }
      if (!formData.subcategory_id) {
        setError('Please select a subcategory');
        return;
      }
      if (!formData.location?.trim()) {
        setError('Please enter a location');
        return;
      }
    } else if (currentStep === 2) {
      if (!formData.title.trim()) {
        setError('Please enter a product title');
        return;
      }
      if (!formData.description.trim()) {
        setError('Please enter a product description');
        return;
      }
    } else if (currentStep === 3) {
      if (formData.images.length === 0) {
        setError('Please upload at least one image');
        return;
      }
      if (formData.price <= 0) {
        setError('Please set a valid price');
        return;
      }
    }

    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const payload = {
        title_en: formData.title,
        description_en: formData.description,
        price: formData.price,
        compare_at_price: formData.compare_at_price && formData.compare_at_price > formData.price ? formData.compare_at_price : null,
        condition: formData.condition,
        category_id: formData.category_id,
        subcategory_id: formData.subcategory_id,
        location: formData.location,
        currency: 'KES',
        images: formData.images.map((img) => img.url),
        attributes: formData.attributes || {},
      };

      const result = await listingsService.createListing(payload);
      if (result?.id) {
        trackEvent('Listing Posted', {
          listing_id: result.id,
          category_id: formData.category_id,
          price: formData.price,
        });
        router.push(`/listings/${result.id}`);
      }
    } catch (err: any) {
      const statusCode = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.message || 'Failed to create listing';

      // Redirect to verification if user is not verified (tier1+)
      if (statusCode === 403 && detail.includes('verification')) {
        router.push('/account?tab=verification');
        return;
      }

      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    console.log('Save draft:', formData);
    // Implement draft saving logic
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Shop *</label>
              <select
                value={formData.shop_id || ''}
                onChange={(e) => updateFormData({ shop_id: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              >
                <option value="">Select a shop</option>
                <option value="1">My Shop</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Main Category *</label>
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => updateFormData({ category_id: parseInt(e.target.value), subcategory_id: undefined })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                >
                  <option value="">Select category</option>
                  {(allCategories.length > 0 ? allCategories : CATEGORIES).map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name || cat.name_en}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Subcategory *</label>
                <select
                  value={formData.subcategory_id || ''}
                  onChange={(e) => updateFormData({ subcategory_id: parseInt(e.target.value), subsubcategory_id: undefined })}
                  disabled={!formData.category_id}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all disabled:opacity-50"
                >
                  <option value="">Select subcategory</option>
                  {categorySubcategories.map((subcat: any) => (
                    <option key={subcat.id} value={subcat.id}>
                      {subcat.name || subcat.name_en || 'Unnamed'}
                    </option>
                  ))}
                </select>
              </div>

              {subcategorySubsubcategories.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Sub-Subcategory</label>
                  <select
                    value={formData.subsubcategory_id || ''}
                    onChange={(e) => updateFormData({ subsubcategory_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  >
                    <option value="">Select sub-subcategory (optional)</option>
                    {subcategorySubsubcategories.map((subsubcat: any) => (
                      <option key={subsubcat.id} value={subsubcat.id}>
                        {subsubcat.name || subsubcat.name_en || 'Unnamed'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Location *</label>
              <input
                ref={locationInputRef}
                type="text"
                value={formData.location || ''}
                onChange={(e) => handleLocationChange(e.target.value)}
                onFocus={() => formData.location && setShowLocationSuggestions(true)}
                placeholder="e.g., Bakaara, Mogadishu"
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
              {showLocationSuggestions && locationSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {locationSuggestions.map((location) => (
                    <button
                      key={location}
                      onClick={() => selectLocation(location)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors text-gray-900 dark:text-white text-sm"
                    >
                      {location}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Product Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                placeholder="e.g., Cerave Moisturizing Cream"
                maxLength={100}
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">{formData.title.length}/100</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Describe your product. Be specific about condition, features, and why you're selling."
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Brand</label>
                {!isCustomBrand ? (
                  <select
                    value={formData.brand || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'Others') {
                        setIsCustomBrand(true);
                        updateFormData({ brand: '' });
                      } else {
                        updateFormData({ brand: value });
                      }
                    }}
                    disabled={categoryBrands.length === 0}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all disabled:opacity-50"
                  >
                    <option value="">
                      {categoryBrands.length === 0
                        ? 'Select category first'
                        : 'Select brand'}
                    </option>
                    {categoryBrands.map((brand) => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                    <option value="Others">Others - Custom</option>
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.brand || ''}
                      onChange={(e) => updateFormData({ brand: e.target.value })}
                      placeholder="Enter your brand"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomBrand(false);
                        updateFormData({ brand: '' });
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Back to list
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Condition *</label>
                <select
                  value={formData.condition}
                  onChange={(e) => updateFormData({ condition: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                >
                  <option value="new">New</option>
                  <option value="like_new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Tags</label>
              <input
                type="text"
                value={formData.tags?.join(', ') || ''}
                onChange={(e) => updateFormData({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
                placeholder="e.g., organic, moisturizer, skincare"
                className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Images & Videos</h3>
              <ListingStep3Images data={formData} onUpdate={updateFormData} onError={setError} />
            </div>

            <div className="border-t border-gray-200 dark:border-neutral-800 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pricing</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Price (KES) *</label>
                  <input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => updateFormData({ price: parseFloat(e.target.value) || 0 })}
                    placeholder="5000"
                    step="1"
                    min="0"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Price Type *</label>
                  <select
                    value={formData.price_type}
                    onChange={(e) => updateFormData({ price_type: e.target.value as any })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  >
                    <option value="fixed">Fixed Price</option>
                    <option value="negotiable">Negotiable</option>
                    <option value="contact">Contact Seller</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Original Price (optional)
                </label>
                <input
                  type="number"
                  value={formData.compare_at_price || ''}
                  onChange={(e) => updateFormData({ compare_at_price: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="e.g. 7000 -- shows as a discount if higher than your price"
                  step="1"
                  min="0"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
                {typeof formData.compare_at_price === 'number' && formData.compare_at_price > 0 && formData.compare_at_price <= formData.price && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    This should be higher than your price to show as a discount -- it won't be shown otherwise.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Stock Quantity</label>
                  <input
                    type="number"
                    value={formData.stock_quantity || 1}
                    onChange={(e) => updateFormData({ stock_quantity: parseInt(e.target.value) || 1 })}
                    placeholder="1"
                    min="1"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">SKU</label>
                  <input
                    type="text"
                    value={formData.sku || ''}
                    onChange={(e) => updateFormData({ sku: e.target.value })}
                    placeholder="Optional product SKU"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 4:
        return <ListingStep4Review data={formData} />;

      default:
        return null;
    }
  };

  return (
    // No min-h-screen/py-8 here -- this only ever mounts inside
    // PostAdPage.tsx, which already provides page-level padding (py-8) and
    // sits inside SellerLayout's own min-h-screen. Having both meant: two
    // stacked top paddings before any content appeared, and a forced
    // full-viewport height that left a large empty gap below the Back/Next
    // buttons since the actual form content doesn't fill 100vh.
    <div className="bg-white dark:bg-black">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-12">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <div>
              <p className="text-gray-600 dark:text-neutral-300 text-sm">Post a Listing</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600 dark:text-neutral-300">Step {currentStep} of {STEPS.length}</p>
            </div>
          </div>

          {/* Step Indicator -- brand orange for current/completed steps,
          matching the accent color used for every other primary action in
          the app (was plain black/gray, inconsistent with the rest of the
          UI). */}
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="relative z-10">
                  <div
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                      idx + 1 <= currentStep
                        ? 'bg-orange-600 text-white'
                        : 'bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-200'
                    }`}
                  >
                    {step.number}
                  </div>
                  <p
                    className={`text-xs font-semibold mt-2 text-center whitespace-nowrap ${
                      idx + 1 <= currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </p>
                </div>

                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-1 transition-all ${
                      idx + 1 < currentStep ? 'bg-orange-600' : 'bg-gray-200 dark:bg-neutral-800'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg text-sm"
          >
            {error}
          </motion.div>
        )}

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-neutral-950 rounded-lg mb-8"
        >
          <div className="mb-4 md:mb-8">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {STEPS[currentStep - 1]?.title}
            </h2>
            <p className="text-gray-600 dark:text-neutral-300 text-sm">
              {currentStep === 1 && 'Select your shop, category, and location'}
              {currentStep === 2 && 'Tell buyers about your product'}
              {currentStep === 3 && 'Add photos/videos and set your price'}
              {currentStep === 4 && 'Review your listing before publishing'}
            </p>
          </div>

          {renderStepContent()}
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between items-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-6 py-3 text-gray-700 dark:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            Back
          </button>

          <div className="flex gap-3">
            {currentStep === 4 && (
              <button
                onClick={handleSaveDraft}
                className="px-8 py-3 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-full font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
              >
                Save Draft
              </button>
            )}

            {currentStep === 4 ? (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-full font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Publishing...' : 'Publish Listing'}
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-full font-semibold transition-all"
              >
                Next
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
