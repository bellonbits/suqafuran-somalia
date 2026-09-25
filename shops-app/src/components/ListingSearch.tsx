import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { FeaturedBadge } from '@/components/FeaturedBadge';
import { Star } from 'lucide-react';

interface FilterOption {
  value: string;
  display_name: string;
}

interface AttributeFilter {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  options: FilterOption[];
}

interface FilterConfig {
  category_id: number;
  filters: AttributeFilter[];
}

interface SearchFilters {
  q?: string;
  category_id?: number;
  subcategory_id?: number;
  min_price?: number;
  max_price?: number;
  attributes?: Record<string, string[]>;
}

interface SearchResult {
  id: number;
  title: string;
  price: number;
  category_id: number;
  subcategory_id?: number;
  location: string;
  images: string[];
  created_at: string;
  is_featured?: boolean;
}

interface ListingSearchProps {
  categoryId?: number;
  subcategoryId?: number;
  onResultsChange?: (results: SearchResult[]) => void;
}

const ListingSearch: React.FC<ListingSearchProps> = ({
  categoryId,
  subcategoryId,
  onResultsChange,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [attributeFilters, setAttributeFilters] = useState<
    Record<string, string[]>
  >({});
  const [filterConfig, setFilterConfig] = useState<FilterConfig | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [featuredOnly, setFeaturedOnly] = useState(false);

  // Load available filters for the category
  useEffect(() => {
    if (!categoryId) return;

    const fetchFilters = async () => {
      try {
        const response = await axios.get(`/api/v1/attribute-filters/${categoryId}`);
        setFilterConfig(response.data);
      } catch (err) {
        console.error('Failed to load filters:', err);
      }
    };

    fetchFilters();
  }, [categoryId]);

  // Execute search
  const handleSearch = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      if (searchQuery) params.append('q', searchQuery);
      if (categoryId) params.append('category_id', categoryId.toString());
      if (subcategoryId) params.append('subcategory_id', subcategoryId.toString());
      if (minPrice) params.append('min_price', minPrice);
      if (maxPrice) params.append('max_price', maxPrice);
      if (featuredOnly) params.append('featured_only', 'true');

      // Add attribute filters as JSON
      const hasAttributeFilters = Object.values(attributeFilters).some(
        (vals) => vals.length > 0
      );
      if (hasAttributeFilters) {
        params.append('attributes', JSON.stringify(attributeFilters));
      }

      const response = await axios.get(`/api/v1/listings/search`, { params });
      setResults(response.data);
      onResultsChange?.(response.data);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAttributeChange = (slug: string, value: string, checked: boolean) => {
    setAttributeFilters((prev) => {
      const values = prev[slug] || [];
      if (checked) {
        return {
          ...prev,
          [slug]: [...values, value],
        };
      } else {
        return {
          ...prev,
          [slug]: values.filter((v) => v !== value),
        };
      }
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setMinPrice('');
    setMaxPrice('');
    setAttributeFilters({});
    setResults([]);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        <div className="md:col-span-1">
          <div className="bg-white rounded-lg shadow p-4 space-y-6">
            <h2 className="text-lg font-semibold">Filters</h2>

            {/* Search Query */}
            <div>
              <label className="block text-sm font-medium mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Product name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Featured Only Filter */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => {
                    setFeaturedOnly(e.target.checked);
                  }}
                  className="w-4 h-4 text-orange-600 rounded border-gray-300"
                />
                <span className="text-sm font-medium">Featured Only</span>
                <Star className="w-4 h-4 text-orange-500" />
              </label>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-sm font-medium mb-2">Price Range</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>

            {/* Attribute Filters */}
            {filterConfig?.filters.map((filter) => (
              <div key={filter.id}>
                <label className="block text-sm font-medium mb-2">{filter.name}</label>

                {/* Select/Multiselect Filters */}
                {['select', 'multiselect'].includes(filter.field_type) && (
                  <div className="space-y-2">
                    {filter.options.map((option) => (
                      <label key={option.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={
                            attributeFilters[filter.slug]?.includes(option.value) || false
                          }
                          onChange={(e) =>
                            handleAttributeChange(
                              filter.slug,
                              option.value,
                              e.target.checked
                            )
                          }
                          className="rounded border-gray-300"
                        />
                        <span className="ml-2 text-sm">{option.display_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
              <button
                onClick={resetFilters}
                className="w-full bg-gray-200 text-gray-800 py-2 rounded-md hover:bg-gray-300"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="md:col-span-3">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md mb-4">
              {error}
            </div>
          )}

          {results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((listing) => (
                <div
                  key={listing.id}
                  onClick={() => router.push(`/listings/${listing.id}`)}
                  className="bg-white rounded-lg shadow hover:shadow-lg transition cursor-pointer overflow-hidden relative group"
                >
                  {/* Image */}
                  {listing.images.length > 0 && (
                    <div className="relative">
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className="w-full h-48 object-cover"
                      />
                      {/* Featured Badge */}
                      {listing.is_featured && (
                        <div className="absolute top-2 right-2">
                          <FeaturedBadge size="sm" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg truncate flex-1">{listing.title}</h3>
                      {listing.is_featured && !listing.images.length && (
                        <FeaturedBadge size="sm" />
                      )}
                    </div>
                    <p className="text-blue-600 font-bold text-lg mt-2">
                      KSh {(listing?.price || 0).toLocaleString()}
                    </p>
                    <p className="text-gray-600 text-sm mt-1">{listing.location}</p>
                    <p className="text-gray-500 text-xs mt-2">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              {loading ? 'Loading results...' : 'No results found. Try adjusting your filters.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingSearch;
