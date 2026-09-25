import React, { useState, useEffect } from 'react';
import api from '@/services/api';

interface AttributeOption {
  id: number;
  value: string;
  display_name: string;
  sort_order: number;
}

interface Attribute {
  id: number;
  name: string;
  slug: string;
  field_type: 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'textarea';
  required: boolean;
  validation_regex?: string;
  min_value?: number;
  max_value?: number;
  options?: AttributeOption[];
}

interface CategoryAttribute {
  id: number;
  attribute_id: number;
  category_id: number;
  required: boolean;
  sort_order: number;
  attribute?: Attribute;
}

interface ListingAttributeFormProps {
  categoryId?: number;
  subcategoryId?: number;
  onAttributesChange: (attributes: Record<string, string | string[]>) => void;
  initialValues?: Record<string, string | string[]>;
}

const ListingAttributeForm: React.FC<ListingAttributeFormProps> = ({
  categoryId,
  subcategoryId,
  onAttributesChange,
  initialValues = {},
}) => {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [values, setValues] = useState<Record<string, string | string[]>>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!categoryId && !subcategoryId) return;

    const fetchAttributes = async () => {
      setLoading(true);
      setError('');
      try {
        let endpoint = '';
        if (subcategoryId) {
          endpoint = `/category-attributes/subcategory/${subcategoryId}`;
        } else {
          endpoint = `/category-attributes/category/${categoryId}`;
        }

        const response = await api.get(endpoint);
        const categoryAttrs: CategoryAttribute[] = response.data;

        // Fetch full attribute details
        const attrIds = categoryAttrs.map((ca) => ca.attribute_id);
        const attrResponses = await Promise.all(
          attrIds.map((id) => api.get(`/attributes/${id}`))
        );

        const attrs = attrResponses.map((r) => r.data).sort((a, b) => {
          const aIdx = categoryAttrs.findIndex((ca) => ca.attribute_id === a.id);
          const bIdx = categoryAttrs.findIndex((ca) => ca.attribute_id === b.id);
          return categoryAttrs[aIdx]?.sort_order - categoryAttrs[bIdx]?.sort_order;
        });

        setAttributes(attrs);
      } catch (err) {
        setError('Failed to load attributes');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAttributes();
  }, [categoryId, subcategoryId]);

  useEffect(() => {
    onAttributesChange(values);
  }, [values]);

  const handleChange = (
    slug: string,
    value: string | string[] | boolean
  ) => {
    const newValue = typeof value === 'boolean' ? (value ? 'true' : 'false') : value;
    setValues((prev) => ({
      ...prev,
      [slug]: newValue,
    }));
  };

  const handleMultiSelect = (slug: string, option: string, checked: boolean) => {
    setValues((prev) => {
      const current = Array.isArray(prev[slug]) ? prev[slug] : [];
      if (checked) {
        return {
          ...prev,
          [slug]: [...current, option],
        };
      } else {
        return {
          ...prev,
          [slug]: current.filter((v) => v !== option),
        };
      }
    });
  };

  if (!categoryId && !subcategoryId) {
    return null;
  }

  if (loading) {
    return <div className="text-center py-4">Loading attributes...</div>;
  }

  if (error) {
    return <div className="text-red-600 py-4">{error}</div>;
  }

  if (attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Product Details</h3>

      {attributes.map((attr) => (
        <div key={attr.id} className="space-y-2">
          <label htmlFor={attr.slug} className="block text-sm font-medium">
            {attr.name}
            {attr.required && <span className="text-red-600 ml-1">*</span>}
          </label>

          {/* Text Input */}
          {attr.field_type === 'text' && (
            <input
              id={attr.slug}
              type="text"
              value={(values[attr.slug] as string) || ''}
              onChange={(e) => handleChange(attr.slug, e.target.value)}
              placeholder={`Enter ${attr.name.toLowerCase()}`}
              required={attr.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Number Input */}
          {attr.field_type === 'number' && (
            <input
              id={attr.slug}
              type="number"
              value={(values[attr.slug] as string) || ''}
              onChange={(e) => handleChange(attr.slug, e.target.value)}
              min={attr.min_value}
              max={attr.max_value}
              placeholder={`Enter ${attr.name.toLowerCase()}`}
              required={attr.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Date Input */}
          {attr.field_type === 'date' && (
            <input
              id={attr.slug}
              type="date"
              value={(values[attr.slug] as string) || ''}
              onChange={(e) => handleChange(attr.slug, e.target.value)}
              required={attr.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Textarea */}
          {attr.field_type === 'textarea' && (
            <textarea
              id={attr.slug}
              value={(values[attr.slug] as string) || ''}
              onChange={(e) => handleChange(attr.slug, e.target.value)}
              placeholder={`Enter ${attr.name.toLowerCase()}`}
              required={attr.required}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Select Dropdown */}
          {attr.field_type === 'select' && (
            <select
              id={attr.slug}
              value={(values[attr.slug] as string) || ''}
              onChange={(e) => handleChange(attr.slug, e.target.value)}
              required={attr.required}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select {attr.name.toLowerCase()}</option>
              {attr.options?.map((opt) => (
                <option key={opt.id} value={opt.value}>
                  {opt.display_name}
                </option>
              ))}
            </select>
          )}

          {/* Multiselect Checkboxes */}
          {attr.field_type === 'multiselect' && (
            <div className="space-y-2">
              {attr.options?.map((opt) => (
                <label key={opt.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={
                      Array.isArray(values[attr.slug])
                        ? values[attr.slug].includes(opt.value)
                        : false
                    }
                    onChange={(e) =>
                      handleMultiSelect(attr.slug, opt.value, e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                  <span className="ml-2 text-sm">{opt.display_name}</span>
                </label>
              ))}
            </div>
          )}

          {/* Checkbox */}
          {attr.field_type === 'checkbox' && (
            <label className="flex items-center">
              <input
                id={attr.slug}
                type="checkbox"
                checked={(values[attr.slug] as string) === 'true'}
                onChange={(e) => handleChange(attr.slug, e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="ml-2 text-sm">{attr.name}</span>
            </label>
          )}
        </div>
      ))}
    </div>
  );
};

export default ListingAttributeForm;
