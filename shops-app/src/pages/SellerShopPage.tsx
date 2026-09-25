"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Save, Loader, Upload, X, MapPin, Clock, Tag, ChevronDown, Crosshair, FileText, Palette, ShoppingCart, Package, Eye, TrendingUp, ArrowRight } from 'lucide-react';
import api from '@/services/api';
import { imageService } from '@/services/imageService';
import { loadGoogleMapsScript } from '@/lib/googleMaps';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface ShopData {
  name: string;
  description: string;
  phone: string;
  email: string;
  logo_url?: string;
  banner_url?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  operating_hours?: OperatingHours[];
  categories?: number[];
  return_policy?: string;
  delivery_policy?: string;
}

interface OperatingHours {
  day: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHOP_CATEGORIES = [
  { id: 1, name: 'Electronics' },
  { id: 2, name: 'Fashion' },
  { id: 3, name: 'Food & Beverage' },
  { id: 4, name: 'Home & Garden' },
  { id: 5, name: 'Health & Beauty' },
  { id: 6, name: 'Sports & Outdoors' },
  { id: 7, name: 'Toys & Games' },
  { id: 8, name: 'Books' },
  { id: 9, name: 'Furniture' },
  { id: 10, name: 'Automotive' },
];

export default function ShopPage() {
  const [shopData, setShopData] = useState<ShopData>({
    name: '',
    description: '',
    phone: '',
    email: '',
    logo_url: '',
    banner_url: '',
    address: '',
    latitude: 0,
    longitude: 0,
    city: '',
    operating_hours: DAYS_OF_WEEK.map(day => ({
      day,
      open_time: '09:00',
      close_time: '18:00',
      is_closed: false,
    })),
    categories: [],
    return_policy: '',
    delivery_policy: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [shopStats, setShopStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadShopData();
    loadShopStats();
  }, []);

  const loadShopStats = async () => {
    try {
      const [statsRes, productsRes, ordersRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => null),
        api.get('/listings/me?limit=100').catch(() => null),
        api.get('/orders?limit=50').catch(() => null),
      ]);

      if (statsRes?.data) {
        const products = Array.isArray(productsRes?.data) ? productsRes.data : [];
        const orders = Array.isArray(ordersRes?.data) ? ordersRes.data : [];

        setShopStats({
          total_products: products.length,
          total_views: statsRes.data.views || 0,
          total_orders: orders.length,
          low_stock_products: products.filter((p: any) => (p.quantity || p.stock || 0) > 0 && (p.quantity || p.stock || 0) <= 20).length,
          out_of_stock: products.filter((p: any) => (p.quantity || p.stock || 0) === 0).length,
          revenue: orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
        });
      }
    } catch (error) {
      console.error('Error loading shop stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // Initialize Google Map
  useEffect(() => {
    if (activeTab !== 'location' || !mapRef.current) return;

    const initMap = async () => {
      await loadGoogleMapsScript();
      if (!mapRef.current) return;

      const defaultCenter = {
        lat: shopData.latitude || -1.2921,
        lng: shopData.longitude || 36.8219,
      };

      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: defaultCenter,
        mapTypeControl: true,
        fullscreenControl: true,
        zoomControl: true,
      });

      // Add or update marker
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }

      markerRef.current = new window.google.maps.Marker({
        position: defaultCenter,
        map: mapInstance.current,
        title: 'Shop Location',
        draggable: true,
      });

      // Update location when marker is dragged
      markerRef.current.addListener('dragend', () => {
        const pos = markerRef.current?.getPosition();
        if (pos) {
          setShopData({
            ...shopData,
            latitude: pos.lat(),
            longitude: pos.lng(),
          });
        }
      });

      // Update location when map is clicked
      mapInstance.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();
          setShopData({
            ...shopData,
            latitude: lat,
            longitude: lng,
          });
          markerRef.current?.setPosition(e.latLng);
        }
      });

      // Initialize Google Places Autocomplete
      if (addressInputRef.current && !autocompleteRef.current) {
        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            componentRestrictions: { country: 'ke' },
            fields: ['formatted_address', 'geometry.location', 'name'],
          }
        );

        autocompleteRef.current.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (place?.geometry?.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            setShopData({
              ...shopData,
              address: place.formatted_address || '',
              latitude: lat,
              longitude: lng,
            });
            mapInstance.current?.setCenter({ lat, lng });
            markerRef.current?.setPosition({ lat, lng });
          }
        });
      }
    };

    initMap();
  }, [activeTab]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadShopData = async () => {
    try {
      const res = await api.get('/seller/profile').catch((err) => {
        console.error('Error loading shop data:', err);
        if (err.response?.status === 500) {
          setProfileError('Shop profile service is temporarily unavailable. You can still view your inventory and orders.');
        }
        return null;
      });

      if (res?.data) {
        setShopData({
          name: res.data.shop_name || '',
          description: res.data.description || '',
          phone: res.data.phone || '',
          email: res.data.email || '',
          logo_url: res.data.logo_url || '',
          banner_url: res.data.banner_url || '',
          address: res.data.address || '',
          latitude: res.data.latitude || 0,
          longitude: res.data.longitude || 0,
          city: res.data.city || '',
          operating_hours: res.data.operating_hours || DAYS_OF_WEEK.map(day => ({
            day,
            open_time: '09:00',
            close_time: '18:00',
            is_closed: false,
          })),
          categories: res.data.categories || [],
          return_policy: res.data.return_policy || '',
          delivery_policy: res.data.delivery_policy || '',
        });

        if (res.data.logo_url) setLogoPreview(res.data.logo_url);
        if (res.data.banner_url) setBannerPreview(res.data.banner_url);
        setSelectedCategories(res.data.categories || []);
        setProfileError(null);
      }
    } catch (error) {
      console.error('Error loading shop data:', error);
      setProfileError('Failed to load shop profile. Check back later.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: 'Logo must be less than 2MB', type: 'error' });
      return;
    }

    setLogoUploading(true);
    try {
      const result = await imageService.uploadImage(file);
      setLogoPreview(result.url);
      setShopData({ ...shopData, logo_url: result.url });
      setToast({ message: 'Logo uploaded successfully', type: 'success' });
    } catch (error) {
      console.error('Logo upload error:', error);
      setToast({ message: 'Failed to upload logo', type: 'error' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setToast({ message: 'Banner must be less than 5MB', type: 'error' });
      return;
    }

    setBannerUploading(true);
    try {
      const result = await imageService.uploadImage(file);
      setBannerPreview(result.url);
      setShopData({ ...shopData, banner_url: result.url });
      setToast({ message: 'Banner uploaded successfully', type: 'success' });
    } catch (error) {
      console.error('Banner upload error:', error);
      setToast({ message: 'Failed to upload banner', type: 'error' });
    } finally {
      setBannerUploading(false);
    }
  };

  const handleOperatingHoursChange = (dayIndex: number, field: string, value: string | boolean) => {
    const newHours = [...shopData.operating_hours!];
    newHours[dayIndex] = {
      ...newHours[dayIndex],
      [field]: value,
    };
    setShopData({ ...shopData, operating_hours: newHours });
  };

  const setHoursForMultipleDays = (days: number[], openTime: string, closeTime: string) => {
    const newHours = [...shopData.operating_hours!];
    days.forEach(dayIndex => {
      newHours[dayIndex] = {
        ...newHours[dayIndex],
        open_time: openTime,
        close_time: closeTime,
        is_closed: false,
      };
    });
    setShopData({ ...shopData, operating_hours: newHours });
  };

  const toggleCategory = (categoryId: number) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter(id => id !== categoryId)
      : [...selectedCategories, categoryId];
    setSelectedCategories(newCategories);
    setShopData({ ...shopData, categories: newCategories });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setShopData({
          ...shopData,
          latitude: lat,
          longitude: lng,
        });
        if (mapInstance.current) {
          mapInstance.current.setCenter({ lat, lng });
          markerRef.current?.setPosition({ lat, lng });
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to get your current location. Please allow location access.');
      }
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/seller/profile', {
        shop_name: shopData.name,
        description: shopData.description,
        phone: shopData.phone,
        email: shopData.email,
        logo_url: shopData.logo_url,
        banner_url: shopData.banner_url,
        address: shopData.address,
        latitude: shopData.latitude,
        longitude: shopData.longitude,
        city: shopData.city,
        operating_hours: shopData.operating_hours,
        categories: selectedCategories,
        return_policy: shopData.return_policy,
        delivery_policy: shopData.delivery_policy,
      });
      setToast({ message: 'Shop information updated successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving shop data:', error);
      setToast({ message: 'Failed to save shop information', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading shop information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Shop Management</h1>
        <p className="text-gray-600 dark:text-neutral-300">Manage your shop information, branding, policies, inventory, and orders</p>
      </div>

      {profileError && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 text-yellow-700 dark:text-yellow-400">
          {profileError}
        </div>
      )}

      {/* Quick Stats */}
      {!statsLoading && shopStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Link href="/seller-dashboard" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-orange-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Products</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{shopStats.total_products}</p>
          </Link>
          <Link href="/seller-dashboard/analytics" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-orange-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Views</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{(shopStats.total_views || 0).toLocaleString()}</p>
          </Link>
          <Link href="/seller-dashboard/orders" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-orange-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{shopStats.total_orders}</p>
          </Link>
          <Link href="/seller-dashboard/inventory" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-yellow-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-600">{shopStats.low_stock_products}</p>
          </Link>
          <Link href="/seller-dashboard/inventory" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-red-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Out of Stock</p>
            <p className="text-2xl font-bold text-red-600">{shopStats.out_of_stock}</p>
          </Link>
          <Link href="/seller-dashboard" className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800 hover:border-green-500 transition-colors">
            <p className="text-gray-600 dark:text-neutral-300 text-xs font-semibold">Revenue</p>
            <p className="text-2xl font-bold text-green-600">KSh {(shopStats.revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </Link>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/seller-dashboard/products" className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg p-4 border border-blue-200 dark:border-blue-800 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Manage Products</p>
              <p className="text-xs text-blue-700 dark:text-blue-400">Add, edit, or delete products</p>
            </div>
            <Package className="w-5 h-5 text-blue-600" />
          </div>
        </Link>
        <Link href="/seller-dashboard/inventory" className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-800 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">Update Inventory</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">Manage stock levels</p>
            </div>
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
        </Link>
        <Link href="/seller-dashboard/orders" className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-lg p-4 border border-green-200 dark:border-green-800 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-green-900 dark:text-green-300 mb-1">View Orders</p>
              <p className="text-xs text-green-700 dark:text-green-400">Track customer orders</p>
            </div>
            <ShoppingCart className="w-5 h-5 text-green-600" />
          </div>
        </Link>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-lg text-white font-medium ${
              toast.type === 'success' ? 'bg-[#02CCFE]' : 'bg-red-500'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-neutral-800 overflow-x-auto max-w-6xl">
        {[
          { id: 'basic', label: 'Basic Info' },
          { id: 'branding', label: 'Branding' },
          { id: 'location', label: 'Location' },
          { id: 'hours', label: 'Hours' },
          { id: 'categories', label: 'Categories' },
          { id: 'policies', label: 'Policies' },
        ].map(tab => {
          const getTabIcon = (id: string) => {
            switch(id) {
              case 'basic': return <FileText className='w-4 h-4' />;
              case 'branding': return <Palette className='w-4 h-4' />;
              case 'location': return <MapPin className='w-4 h-4' />;
              case 'hours': return <Clock className='w-4 h-4' />;
              case 'categories': return <Tag className='w-4 h-4' />;
              case 'policies': return <FileText className='w-4 h-4' />;
              default: return null;
            }
          };

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400'
                  : 'text-gray-600 dark:text-neutral-300 border-transparent hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {getTabIcon(tab.id)} {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 p-6 max-w-6xl">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Basic Information</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Shop Name</label>
              <input
                type="text"
                value={shopData.name}
                onChange={(e) => setShopData({...shopData, name: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Description</label>
              <textarea
                value={shopData.description}
                onChange={(e) => setShopData({...shopData, description: e.target.value})}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">{shopData.description.length}/500</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Phone</label>
                <input
                  type="tel"
                  value={shopData.phone}
                  onChange={(e) => setShopData({...shopData, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Email</label>
                <input
                  type="email"
                  value={shopData.email}
                  onChange={(e) => setShopData({...shopData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Shop Branding</h2>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Shop Logo</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-lg p-6 cursor-pointer hover:border-orange-500 transition-colors">
                    <div className="text-center">
                      {logoUploading ? (
                        <>
                          <Loader className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 dark:text-neutral-300">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-700 dark:text-neutral-200">Click to upload</p>
                          <p className="text-xs text-gray-500">Max 2MB</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                {logoPreview && (
                  <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800">
                    <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setLogoPreview(null);
                        setShopData({ ...shopData, logo_url: '' });
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Banner Upload */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Shop Banner</label>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-neutral-800 rounded-lg p-6 cursor-pointer hover:border-orange-500 transition-colors">
                    <div className="text-center">
                      {bannerUploading ? (
                        <>
                          <Loader className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-600 dark:text-neutral-300">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-gray-700 dark:text-neutral-200">Click to upload</p>
                          <p className="text-xs text-gray-500">Max 5MB, 1920x400px recommended</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBannerUpload}
                      disabled={bannerUploading}
                      className="hidden"
                    />
                  </label>
                </div>
                {bannerPreview && (
                  <div className="relative w-48 h-32 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800">
                    <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => {
                        setBannerPreview(null);
                        setShopData({ ...shopData, banner_url: '' });
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Shop Location</h2>
            
            {/* Google Map */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-900 dark:text-white">Select Location on Map</label>
              <div 
                ref={mapRef} 
                className="w-full h-96 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden"
              />
              <button
                onClick={getCurrentLocation}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
              >
                <Crosshair className="w-4 h-4" />
                Use Current Location
              </button>
            </div>

            {/* Address with Autocomplete */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Address</label>
              <input
                ref={addressInputRef}
                type="text"
                value={shopData.address}
                onChange={(e) => setShopData({...shopData, address: e.target.value})}
                placeholder="Type address or location name (Somalia)"
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-neutral-300 mt-1">Autocomplete suggestions will appear as you type</p>
            </div>

            {/* City and Coordinates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">City/Area</label>
                <input
                  type="text"
                  value={shopData.city}
                  onChange={(e) => setShopData({...shopData, city: e.target.value})}
                  placeholder="e.g., Nairobi, Kiambu"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={shopData.latitude}
                  onChange={(e) => setShopData({...shopData, latitude: parseFloat(e.target.value)})}
                  placeholder="Click on map or enter manually"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={shopData.longitude}
                  onChange={(e) => setShopData({...shopData, longitude: parseFloat(e.target.value)})}
                  placeholder="Click on map or enter manually"
                  className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                How to set location:
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-2">
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-500 font-bold mt-0.5">1.</span>
                  <span>Type address in the field above for autocomplete suggestions</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-500 font-bold mt-0.5">2.</span>
                  <span>Click on the map to set your shop location</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-500 font-bold mt-0.5">3.</span>
                  <span>Drag the marker to adjust the position precisely</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-500 font-bold mt-0.5">4.</span>
                  <span>Tap "Use Current Location" to auto-fill with your position</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Operating Hours Tab */}
        {activeTab === 'hours' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Operating Hours</h2>
            <div className="space-y-3">
              {shopData.operating_hours?.map((hours, idx) => (
                <div key={hours.day} className="flex gap-3 items-center">
                  <div className="w-24">
                    <label className="text-sm font-medium text-gray-700 dark:text-neutral-200">{hours.day}</label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={hours.is_closed}
                      onChange={(e) => handleOperatingHoursChange(idx, 'is_closed', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-600 dark:text-neutral-300">Closed</span>
                  </label>
                  {!hours.is_closed && (
                    <div className="flex gap-2 ml-auto">
                      <input
                        type="time"
                        value={hours.open_time}
                        onChange={(e) => handleOperatingHoursChange(idx, 'open_time', e.target.value)}
                        className="px-3 py-1 border border-gray-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-950 text-gray-900 dark:text-white text-sm"
                      />
                      <span className="text-gray-500">-</span>
                      <input
                        type="time"
                        value={hours.close_time}
                        onChange={(e) => handleOperatingHoursChange(idx, 'close_time', e.target.value)}
                        className="px-3 py-1 border border-gray-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-950 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-6 p-4 bg-gray-50 dark:bg-neutral-900/50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-neutral-200 mb-3">Quick Set</p>
              <button
                onClick={() => setHoursForMultipleDays([1, 2, 3, 4, 5], '09:00', '18:00')}
                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
              >
                Weekdays 9AM-6PM
              </button>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Shop Categories</h2>
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white text-left flex justify-between items-center"
              >
                Select categories
                <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showCategoryDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-lg z-10">
                  {SHOP_CATEGORIES.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-neutral-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-neutral-200">{cat.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {selectedCategories.map(catId => {
                const cat = SHOP_CATEGORIES.find(c => c.id === catId);
                return (
                  <div key={catId} className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-sm">
                    {cat?.name}
                    <button
                      onClick={() => toggleCategory(catId)}
                      className="hover:text-orange-900 dark:hover:text-orange-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Shop Policies</h2>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Return Policy</label>
              <textarea
                value={shopData.return_policy}
                onChange={(e) => setShopData({...shopData, return_policy: e.target.value})}
                maxLength={1000}
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                rows={5}
                placeholder="Describe your return policy..."
              />
              <p className="text-xs text-gray-500 mt-1">{shopData.return_policy.length}/1000</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">Delivery Policy</label>
              <textarea
                value={shopData.delivery_policy}
                onChange={(e) => setShopData({...shopData, delivery_policy: e.target.value})}
                maxLength={1000}
                className="w-full px-4 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-950 text-gray-900 dark:text-white"
                rows={5}
                placeholder="Describe your delivery policy..."
              />
              <p className="text-xs text-gray-500 mt-1">{shopData.delivery_policy.length}/1000</p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white font-semibold px-8 py-3 rounded-lg flex items-center gap-2 transition-colors"
        >
          {saving ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
