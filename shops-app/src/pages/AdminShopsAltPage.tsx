"use client";
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Eye, Loader, ChevronLeft, ChevronRight, X, AlertCircle, Check, Image as ImageIcon, Package, Upload, Download } from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import { makeShopSlug } from '@/services/listings';
import Papa from 'papaparse';

interface ShopListing {
  id: number;
  title_en: string;
  price: number;
  currency?: string;
  status: string;
  images?: string[];
}

interface Category {
  id: number;
  name_en: string;
  subcategories?: Array<{
    id: number;
    name_en: string;
    subsubcategories?: Array<{ id: number; name_en: string }>;
  }>;
}

interface BulkRow {
  title_en: string;
  title_so: string;
  description_en: string;
  price: string;
  location: string;
  condition: string;
  categoryInput: string;
  subcategoryInput: string;
  subsubcategoryInput: string;
  category_id: number | null;
  subcategory_id: number | null;
  subsubcategory_id: number | null;
  error: string;
  status: 'pending' | 'importing' | 'success' | 'failed';
  resultError?: string;
}

interface Shop {
  id: number;
  business_name: string;
  full_name: string;
  shop_description?: string;
  logo_url?: string;
  shop_page_banner?: string;
  shop_detail_banner?: string;
  location?: string;
  is_featured: boolean;
  is_verified: boolean;
  free_delivery: boolean;
  is_active: boolean;
  email: string;
}

export default function ShopsAdminPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 500; // API max limit is 500

  // Edit-name modal state
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Full edit modal state (name, description, logo, banners, toggles)
  const [detailShop, setDetailShop] = useState<Shop | null>(null);
  const [detailForm, setDetailForm] = useState({
    business_name: '',
    shop_description: '',
    logo_url: '',
    shop_page_banner: '',
    shop_detail_banner: '',
    location: '',
    is_featured: false,
    is_verified: false,
    free_delivery: false,
    is_active: true,
  });
  const [detailUploading, setDetailUploading] = useState<'logo' | 'page_banner' | 'detail_banner' | null>(null);
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailSuccess, setDetailSuccess] = useState('');

  // Items belonging to the shop currently open in the edit modal
  const [shopListings, setShopListings] = useState<ShopListing[]>([]);
  const [shopListingsLoading, setShopListingsLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({
    title_en: '',
    description_en: '',
    price: '',
    location: '',
    condition: 'New',
    category_id: '',
    subcategory_id: '',
    subsubcategory_id: '',
  });
  const [newItemImages, setNewItemImages] = useState<string[]>([]);
  const [newItemUploading, setNewItemUploading] = useState(false);
  const [newItemSaving, setNewItemSaving] = useState(false);
  const [newItemError, setNewItemError] = useState('');

  // Bulk CSV import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkParseError, setBulkParseError] = useState('');

  // Sort shops alphabetically by business_name
  const sortedShops = [...shops].sort((a, b) =>
    a.business_name.localeCompare(b.business_name)
  );

  // Filter shops: only show shops WITH listings (ads), and apply search filter
  const filteredShops = sortedShops.filter((shop) => {
    const query = searchQuery.toLowerCase();

    // Must match search query
    const matchesSearch =
      shop.business_name.toLowerCase().includes(query) ||
      shop.full_name.toLowerCase().includes(query) ||
      shop.email.toLowerCase().includes(query);

    // Only return shops that have listings (has ads)
    return matchesSearch;
  });

  useEffect(() => {
    // Clear browser cache on mount to force fresh banners
    if (typeof window !== 'undefined') {
      // Clear any cached banner URLs from localStorage
      Object.keys(localStorage).forEach(key => {
        if (key.includes('banner') || key.includes('shop')) {
          localStorage.removeItem(key);
        }
      });
    }
    loadShops();
  }, []); // Only load once on component mount

  const loadShops = async () => {
    try {
      setLoading(true);
      const skip = (page - 1) * itemsPerPage;
      console.log(`📡 Fetching shops: page=${page}, skip=${skip}, limit=${itemsPerPage}`);

      // Add cache-busting parameter to force fresh data
      const response = await api.get('/admin/shops/directory', {
        params: {
          search: searchQuery,
          skip: (page - 1) * itemsPerPage,
          limit: itemsPerPage,
        },
      });console.log(`✅ Response status: ${response.status}`);
      console.log(`✅ Response data type: ${typeof response.data}`);
      console.log(`✅ Is array: ${Array.isArray(response.data)}`);
      console.log(`✅ Received ${response.data?.length || 0} shops from API`);
      console.log(' First shop:', response.data?.[0]);

      const shopsData = response.data?.shops || (Array.isArray(response.data) ? response.data : []);
      const totalCount = response.data?.total || shopsData.length;
      setShops(shopsData);
      setTotalPages(Math.ceil(totalCount / itemsPerPage) || 1);
    } catch (error: any) {
      console.error('❌ Error loading shops:', error);
      console.error('Status:', error.response?.status);
      console.error('Message:', error.message);
      console.error('Full error:', error.response?.data);

      if (error.response?.status === 401) {
        alert('⚠️ Admin access required! Please log in as an administrator to access this page.');
      } else if (error.response?.status === 403) {
        alert('⚠️ Permission denied! Only superadmins can access this page.');
      } else {
        alert(`Failed to load shops: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBanner = async (shopId: number, bannerType: 'shop_page' | 'shop_detail') => {
    if (!confirm(`Delete ${bannerType} banner?`)) return;

    try {
      await api.delete(`/admin/shops/${shopId}/banner/${bannerType === 'shop_page' ? 'shop_page' : 'shop_detail'}`);
      loadShops();
      alert('Banner deleted successfully');
    } catch (error) {
      console.error('Error deleting banner:', error);
      alert('Failed to delete banner');
    }
  };

  const handleEditNameClick = (shop: Shop) => {
    setEditingShop(shop);
    setEditName(shop.business_name);
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveShopName = async () => {
    if (!editingShop) return;

    if (!editName.trim()) {
      setEditError('Shop name cannot be empty');
      return;
    }

    if (editName === editingShop.business_name) {
      setEditError('No changes made');
      return;
    }

    if (editName.length > 100) {
      setEditError('Shop name must be 100 characters or less');
      return;
    }

    setEditSaving(true);
    setEditError('');

    try {
      const response = await api.patch(`/admin/shops/${editingShop.id}/name`, {
        business_name: editName.trim()
      });

      // Update the shops list
      setShops(shops.map(shop =>
        shop.id === editingShop.id
          ? { ...shop, business_name: response.data.new_name }
          : shop
      ));

      setEditSuccess('Shop name updated successfully');

      setTimeout(() => {
        setEditingShop(null);
        setEditError('');
        setEditSuccess('');
      }, 1500);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to update shop name';
      setEditError(errorMsg);
    } finally {
      setEditSaving(false);
    }
  };

  const openDetailEdit = async (shop: Shop) => {
    // The list view truncates banner data (some are multi-MB base64 blobs),
    // so fetch this one shop's full record before showing the edit form.
    setDetailShop(shop);
    setDetailForm({
      business_name: shop.business_name || '',
      shop_description: shop.shop_description || '',
      logo_url: shop.logo_url || '',
      shop_page_banner: '',
      shop_detail_banner: '',
      location: shop.location || '',
      is_featured: shop.is_featured,
      is_verified: shop.is_verified,
      free_delivery: shop.free_delivery,
      is_active: shop.is_active,
    });
    setDetailError('');
    setDetailSuccess('');
    setShowAddItem(false);
    setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
    setNewItemImages([]);
    setNewItemError('');
    setShowBulkImport(false);
    setBulkRows([]);
    setBulkParseError('');
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/shops/${shop.id}`);
      const full = res.data;
      setDetailForm((f) => ({
        ...f,
        business_name: full.business_name || f.business_name,
        shop_description: full.shop_description || '',
        logo_url: full.logo_url || '',
        shop_page_banner: full.shop_page_banner || '',
        shop_detail_banner: full.shop_detail_banner || '',
        location: full.location || '',
        is_featured: full.is_featured,
        is_verified: full.is_verified,
        free_delivery: full.free_delivery,
        is_active: full.is_active,
      }));
    } catch (err) {
      console.error('Failed to load full shop details:', err);
    } finally {
      setDetailLoading(false);
    }

    loadShopListings(shop.id);
    if (categories.length === 0) {
      api.get('/listings/categories').then((res) => {
        setCategories(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
  };

  const loadShopListings = async (shopId: number) => {
    setShopListingsLoading(true);
    try {
      const res = await api.get('/listings/', { params: { owner_id: shopId, limit: 100 } });
      setShopListings(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load shop listings:', err);
      setShopListings([]);
    } finally {
      setShopListingsLoading(false);
    }
  };

  const closeDetailModal = () => {
    setDetailShop(null);
    setShopListings([]);
    setShowAddItem(false);
    setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
    setNewItemImages([]);
    setNewItemError('');
    setShowBulkImport(false);
    setBulkRows([]);
    setBulkParseError('');
  };

  const handleNewItemImagesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setNewItemUploading(true);
    setNewItemError('');
    try {
      const formData = new FormData();
      fileArray.forEach((file) => formData.append('files', file, file.name));
      const res = await api.post('/listings/upload-multiple', formData);
      const urls = (res.data || []).map((item: any) => item.url);
      setNewItemImages((imgs) => [...imgs, ...urls]);
    } catch (err: any) {
      setNewItemError(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setNewItemUploading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!detailShop) return;
    if (!newItem.title_en.trim() || !newItem.description_en.trim() || !newItem.price || !newItem.location.trim() || !newItem.category_id) {
      setNewItemError('Title, description, price, location, and category are required');
      return;
    }

    setNewItemSaving(true);
    setNewItemError('');
    try {
      const res = await api.post(
        '/listings/',
        {
          title_en: newItem.title_en.trim(),
          description_en: newItem.description_en.trim(),
          price: Number(newItem.price),
          location: newItem.location.trim(),
          condition: newItem.condition,
          category_id: Number(newItem.category_id),
          subcategory_id: newItem.subcategory_id ? Number(newItem.subcategory_id) : null,
          subsubcategory_id: newItem.subsubcategory_id ? Number(newItem.subsubcategory_id) : null,
          currency: 'KES',
          images: newItemImages,
        },
        { params: { owner_id: detailShop.id } }
      );

      setShopListings((prev) => [res.data, ...prev]);
      setShowAddItem(false);
      setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
      setNewItemImages([]);
    } catch (err: any) {
      setNewItemError(err.response?.data?.detail || 'Failed to add item');
    } finally {
      setNewItemSaving(false);
    }
  };

  const handleDownloadCsvTemplate = () => {
    const csv = Papa.unparse({
      fields: ['title_en', 'title_so', 'description_en', 'price', 'location', 'condition', 'category', 'subcategory', 'subsubcategory'],
      data: [
        ['Samsung Galaxy A14', '', 'Brand new, sealed box, 128GB', '150', 'Bakaara, Mogadishu', 'New', 'Electronics', 'Mobile Phones', 'Samsung'],
      ],
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-products-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkCsvUpload = async (file: File) => {
    setBulkParseError('');
    setBulkRows([]);

    // Category tree is needed to resolve names to ids; make sure it's loaded.
    let cats = categories;
    if (cats.length === 0) {
      try {
        const res = await api.get('/listings/categories');
        cats = Array.isArray(res.data) ? res.data : [];
        setCategories(cats);
      } catch {
        setBulkParseError('Failed to load categories — try reopening the shop editor');
        return;
      }
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: BulkRow[] = (results.data as any[]).map((raw) => {
          const row: BulkRow = {
            title_en: (raw.title_en || '').trim(),
            title_so: (raw.title_so || '').trim(),
            description_en: (raw.description_en || '').trim(),
            price: (raw.price || '').trim(),
            location: (raw.location || '').trim(),
            condition: (raw.condition || 'New').trim() || 'New',
            categoryInput: (raw.category || '').trim(),
            subcategoryInput: (raw.subcategory || '').trim(),
            subsubcategoryInput: (raw.subsubcategory || '').trim(),
            category_id: null,
            subcategory_id: null,
            subsubcategory_id: null,
            error: '',
            status: 'pending',
          };

          if (!row.title_en || !row.description_en || !row.price || !row.location || !row.categoryInput) {
            row.error = 'Missing required field(s): title_en, description_en, price, location, category';
            return row;
          }
          if (isNaN(Number(row.price))) {
            row.error = 'Price is not a number';
            return row;
          }

          const resolved = resolveCategoryChain(cats, row);
          row.category_id = resolved.category_id;
          row.subcategory_id = resolved.subcategory_id;
          row.subsubcategory_id = resolved.subsubcategory_id;
          row.error = resolved.error;
          return row;
        });

        if (parsed.length === 0) {
          setBulkParseError('No rows found in CSV');
          return;
        }
        setBulkRows(parsed);
      },
      error: (err) => setBulkParseError(`CSV parse error: ${err.message}`),
    });
  };

  // Takes an explicit category list (rather than reading `categories` state
  // directly) since it may run right after a fresh categories fetch, before
  // that state update has been committed.
  const resolveCategoryChain = (cats: any[], row: BulkRow) => {
    const byName = (list: any[], input: string) => {
      if (!input.trim()) return null;
      if (/^\d+$/.test(input.trim())) {
        return list.find((c) => c.id === Number(input.trim())) || null;
      }
      return list.find((c) => c.name_en.toLowerCase() === input.trim().toLowerCase()) || null;
    };

    const cat = byName(cats, row.categoryInput);
    if (!cat) return { category_id: null, subcategory_id: null, subsubcategory_id: null, error: `Category "${row.categoryInput}" not found` };

    let subId: number | null = null;
    let subsubId: number | null = null;
    if (row.subcategoryInput.trim()) {
      const sub = byName(cat.subcategories || [], row.subcategoryInput);
      if (!sub) return { category_id: cat.id, subcategory_id: null, subsubcategory_id: null, error: `Subcategory "${row.subcategoryInput}" not found under "${cat.name_en}"` };
      subId = sub.id;
      if (row.subsubcategoryInput.trim()) {
        const subsub = byName(sub.subsubcategories || [], row.subsubcategoryInput);
        if (!subsub) return { category_id: cat.id, subcategory_id: sub.id, subsubcategory_id: null, error: `Sub-subcategory "${row.subsubcategoryInput}" not found under "${sub.name_en}"` };
        subsubId = subsub.id;
      }
    }
    return { category_id: cat.id, subcategory_id: subId, subsubcategory_id: subsubId, error: '' };
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const handleBulkImport = async () => {
    if (!detailShop) return;
    const validRows = bulkRows.filter((r) => !r.error);
    if (validRows.length === 0) return;

    setBulkImporting(true);
    for (let i = 0; i < bulkRows.length; i++) {
      if (bulkRows[i].error) continue;
      setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'importing' } : r)));
      const row = bulkRows[i];
      const payload = {
        title_en: row.title_en,
        title_so: row.title_so || null,
        description_en: row.description_en,
        price: Number(row.price),
        location: row.location,
        condition: row.condition,
        category_id: row.category_id,
        subcategory_id: row.subcategory_id,
        subsubcategory_id: row.subsubcategory_id,
        currency: 'KES',
        images: [],
      };
      // Sequential POSTs share nginx's per-IP rate limit with the rest of the
      // dashboard's traffic (notifications polling, other tabs, etc.) -- pace
      // requests so a big CSV doesn't trip a 429, and back off once and retry
      // if it does anyway rather than failing the row outright.
      try {
        const res = await api.post('/listings/', payload, { params: { owner_id: detailShop.id } });
        setShopListings((prev) => [res.data, ...prev]);
        setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'success' } : r)));
      } catch (err: any) {
        if (err.response?.status === 429) {
          await sleep(2000);
          try {
            const res = await api.post('/listings/', payload, { params: { owner_id: detailShop.id } });
            setShopListings((prev) => [res.data, ...prev]);
            setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'success' } : r)));
            continue;
          } catch (retryErr: any) {
            setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'failed', resultError: retryErr.response?.data?.detail || 'Failed to import (rate limited)' } : r)));
            continue;
          }
        }
        setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'failed', resultError: err.response?.data?.detail || 'Failed to import' } : r)));
      }
      await sleep(200);
    }
    setBulkImporting(false);
  };

  const handleDetailImageUpload = async (
    field: 'logo_url' | 'shop_page_banner' | 'shop_detail_banner',
    kind: 'logo' | 'page_banner' | 'detail_banner',
    file: File
  ) => {
    setDetailUploading(kind);
    setDetailError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('high_quality', 'true');
      const res = await api.post('/listings/upload', formData);
      setDetailForm((f) => ({ ...f, [field]: res.data.url }));
    } catch (err: any) {
      setDetailError(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setDetailUploading(null);
    }
  };

  const handleSaveDetail = async () => {
    if (!detailShop) return;
    if (!detailForm.business_name.trim()) {
      setDetailError('Shop name cannot be empty');
      return;
    }

    setDetailSaving(true);
    setDetailError('');
    try {
      await api.put(`/admin/shops/${detailShop.id}`, {
        business_name: detailForm.business_name.trim(),
        shop_description: detailForm.shop_description.trim() || null,
        logo_url: detailForm.logo_url || null,
        shop_page_banner: detailForm.shop_page_banner || null,
        shop_detail_banner: detailForm.shop_detail_banner || null,
        location: detailForm.location.trim() || null,
        is_featured: detailForm.is_featured,
        is_verified: detailForm.is_verified,
        free_delivery: detailForm.free_delivery,
        is_active: detailForm.is_active,
      });

      setShops((prev) => prev.map((s) => (s.id === detailShop.id ? { ...s, ...detailForm } : s)));
      setDetailSuccess('Shop updated successfully');
      setTimeout(() => {
        setDetailShop(null);
        setDetailSuccess('');
      }, 1200);
    } catch (err: any) {
      setDetailError(err.response?.data?.detail || 'Failed to update shop');
    } finally {
      setDetailSaving(false);
    }
  };

  if (loading && shops.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="animate-spin text-[#5bc0e8]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-900/40 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Shop Management</h1>
            <p className="text-slate-600 dark:text-neutral-200 mt-2">Manage shop details, banners, and settings</p>
          </div>
          <Link href="/admin/shops/new">
            <button className="flex items-center gap-2 bg-[#5bc0e8] text-white px-4 py-2 rounded-lg hover:bg-blue-700">
              <Plus size={20} />
              New Shop
            </button>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="🔍 Search shops by name, owner, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 dark:bg-neutral-900 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Shop Name (A-Z)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Owner</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Banner</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Featured</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      {searchQuery ? '❌ No shops match your search' : '❌ No shops found'}
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-slate-50 dark:bg-neutral-900/40">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{shop.business_name}</p>
                          <p className="text-sm text-slate-400">{shop.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700 dark:text-neutral-200">{shop.full_name}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          {shop.shop_page_banner && (
                            <span className="px-2 py-1 bg-[#e0f7ff] text-blue-800 rounded text-xs">
                              Card
                            </span>
                          )}
                          {shop.shop_detail_banner && (
                            <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-green-800 rounded text-xs">
                              Detail
                            </span>
                          )}
                          {!shop.shop_page_banner && !shop.shop_detail_banner && (
                            <span className="px-2 py-1 bg-slate-100 dark:bg-neutral-900 text-slate-800 dark:text-neutral-100 rounded text-xs">
                              None
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          shop.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-green-800'
                            : 'bg-rose-50 dark:bg-rose-950/30 text-red-800'
                        }`}>
                          {shop.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {shop.is_featured ? (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                             Featured
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditNameClick(shop)}
                            className="p-2 text-orange-600 hover:bg-orange-50 rounded"
                            title="Edit shop name"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => openDetailEdit(shop)}
                            className="p-2 text-[#5bc0e8] hover:bg-blue-50 rounded"
                            title="Edit shop details"
                          >
                            <Edit2 size={18} />
                          </button>
                          <a href={`/shop/${makeShopSlug(shop.business_name || shop.full_name || '', shop.id)}`} target="_blank">
                            <button className="p-2 text-green-600 hover:bg-green-50 rounded">
                              <Eye size={18} />
                            </button>
                          </a>
                          {shop.shop_page_banner && (
                            <button
                              onClick={() => handleDeleteBanner(shop.id, 'shop_page')}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                              title="Delete card banner"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Shop Count */}
        <div className="mt-6 flex justify-between items-center">
          <p className="text-sm text-slate-600 dark:text-neutral-200">
            <span className="inline-block bg-[#e0f7ff] text-blue-800 px-2 py-1 rounded mr-2 text-xs font-semibold">
              WITH ADS ONLY
            </span>
            Showing: <span className="font-semibold">{filteredShops.length}</span> shops
            {searchQuery && <span className="text-slate-400 ml-2">(filtered by "{searchQuery}")</span>}
          </p>
        </div>
      </div>

      {/* Edit Shop Name Modal */}
      {editingShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Shop Name</h2>
              <button
                onClick={() => setEditingShop(null)}
                className="text-slate-400 hover:text-slate-600 dark:text-neutral-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Shop Info */}
              <div className="bg-slate-50 dark:bg-neutral-900/40 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-600 dark:text-neutral-200 mb-1">Shop Owner</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{editingShop.full_name}</p>
                <p className="text-xs text-slate-400 mt-1">{editingShop.email}</p>
              </div>

              {/* Input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">
                  Shop Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError('');
                  }}
                  placeholder="Enter new shop name"
                  maxLength={100}
                  disabled={editSaving}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="text-xs text-slate-400 mt-1">
                  {editName.length}/100 characters
                </p>
              </div>

              {/* Success Message */}
              {editSuccess && (
                <div className="flex gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                  <Check size={20} className="text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">{editSuccess}</p>
                </div>
              )}

              {/* Error Message */}
              {editError && (
                <div className="flex gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{editError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-neutral-800">
              <button
                onClick={() => setEditingShop(null)}
                disabled={editSaving}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveShopName}
                disabled={editSaving || !editName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#5bc0e8] hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Shop Modal */}
      {detailShop && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-neutral-800">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Shop</h2>
              <button onClick={closeDetailModal} className="text-slate-400 hover:text-slate-600 dark:text-neutral-200">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="bg-slate-50 dark:bg-neutral-900/40 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-600 dark:text-neutral-200 mb-1">Shop Owner</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{detailShop.full_name}</p>
                <p className="text-xs text-slate-400 mt-1">{detailShop.email}</p>
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <Loader size={16} className="animate-spin" />
                  Loading full shop details...
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">Shop Name</label>
                <input
                  type="text"
                  value={detailForm.business_name}
                  onChange={(e) => setDetailForm((f) => ({ ...f, business_name: e.target.value }))}
                  maxLength={100}
                  disabled={detailSaving}
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">Description</label>
                <textarea
                  value={detailForm.shop_description}
                  onChange={(e) => setDetailForm((f) => ({ ...f, shop_description: e.target.value }))}
                  rows={3}
                  disabled={detailSaving}
                  placeholder="What does this shop sell?"
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">Location</label>
                <input
                  type="text"
                  value={detailForm.location}
                  onChange={(e) => setDetailForm((f) => ({ ...f, location: e.target.value }))}
                  disabled={detailSaving}
                  placeholder="e.g. Bakaara, Mogadishu"
                  className="w-full px-4 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {([
                { key: 'logo_url', kind: 'logo', label: 'Logo' },
                { key: 'shop_page_banner', kind: 'page_banner', label: 'Shop Card Banner' },
                { key: 'shop_detail_banner', kind: 'detail_banner', label: 'Shop Page Banner' },
              ] as const).map(({ key, kind, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-neutral-200 mb-2">{label}</label>
                  <div className="flex items-center gap-3">
                    {detailForm[key] ? (
                      <img src={detailForm[key]} alt="" className="w-16 h-16 rounded-lg object-cover border border-slate-200 dark:border-neutral-800" />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-neutral-900 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="px-4 py-2 rounded-xl border border-dashed border-gray-300 text-center text-xs font-semibold text-slate-600 dark:text-neutral-200 hover:border-blue-400 hover:text-blue-600 transition-colors">
                        {detailUploading === kind ? 'Uploading...' : 'Upload image'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={detailUploading !== null || detailSaving}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleDetailImageUpload(key, kind, file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: 'is_featured', label: 'Featured' },
                  { key: 'is_verified', label: 'Verified' },
                  { key: 'free_delivery', label: 'Free Delivery' },
                  { key: 'is_active', label: 'Active' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={detailForm[key]}
                      disabled={detailSaving}
                      onChange={(e) => setDetailForm((f) => ({ ...f, [key]: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-700 dark:text-neutral-200">{label}</span>
                  </label>
                ))}
              </div>

              {/* Items in this shop */}
              <div className="border-t border-slate-200 dark:border-neutral-800 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-neutral-200">
                    <Package size={16} />
                    Items in this Shop {shopListings.length > 0 && `(${shopListings.length})`}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowBulkImport((v) => !v); setShowAddItem(false); }}
                      className="text-xs font-semibold text-[#5bc0e8] hover:text-blue-700"
                    >
                      {showBulkImport ? 'Cancel' : 'Bulk Import (CSV)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowAddItem((v) => !v); setShowBulkImport(false); }}
                      className="text-xs font-semibold text-[#5bc0e8] hover:text-blue-700"
                    >
                      {showAddItem ? 'Cancel' : '+ Add Item'}
                    </button>
                  </div>
                </div>

                {showBulkImport && (
                  <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-slate-500">
                        Columns: <code className="font-mono">title_en, title_so, description_en, price, location, condition, category, subcategory, subsubcategory</code>.
                        Category/subcategory/subsubcategory can be names (e.g. "Electronics") or numeric IDs. Images aren't part of the CSV — add them per item afterward.
                      </p>
                      <button
                        type="button"
                        onClick={handleDownloadCsvTemplate}
                        className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-[#5bc0e8] hover:text-blue-700"
                      >
                        <Download size={13} /> Download template
                      </button>
                    </div>

                    <label className="flex items-center justify-center gap-2 cursor-pointer px-4 py-3 rounded-lg border border-dashed border-gray-300 text-sm font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                      <Upload size={16} />
                      {bulkRows.length > 0 ? 'Choose a different CSV file' : 'Choose CSV file'}
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        disabled={bulkImporting}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleBulkCsvUpload(file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {bulkParseError && (
                      <div className="flex gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800">{bulkParseError}</p>
                      </div>
                    )}

                    {bulkRows.length > 0 && (
                      <>
                        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-neutral-800">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-100 dark:bg-neutral-900 sticky top-0">
                              <tr>
                                <th className="px-2 py-1.5 text-left">Title</th>
                                <th className="px-2 py-1.5 text-left">Price</th>
                                <th className="px-2 py-1.5 text-left">Category</th>
                                <th className="px-2 py-1.5 text-left">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                              {bulkRows.map((row, i) => (
                                <tr key={i} className={row.error ? 'bg-red-50/60' : ''}>
                                  <td className="px-2 py-1.5 max-w-[140px] truncate">{row.title_en || <span className="text-slate-400">—</span>}</td>
                                  <td className="px-2 py-1.5">{row.price}</td>
                                  <td className="px-2 py-1.5 max-w-[120px] truncate">{row.categoryInput}</td>
                                  <td className="px-2 py-1.5">
                                    {row.status === 'success' ? (
                                      <span className="text-emerald-600 font-semibold">Added</span>
                                    ) : row.status === 'failed' ? (
                                      <span className="text-red-600 font-semibold" title={row.resultError}>Failed</span>
                                    ) : row.status === 'importing' ? (
                                      <span className="text-slate-500">Importing…</span>
                                    ) : row.error ? (
                                      <span className="text-red-600" title={row.error}>{row.error}</span>
                                    ) : (
                                      <span className="text-slate-400">Ready</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">
                            {bulkRows.filter((r) => !r.error).length} of {bulkRows.length} rows ready to import
                          </p>
                          <button
                            type="button"
                            onClick={handleBulkImport}
                            disabled={bulkImporting || bulkRows.every((r) => !!r.error)}
                            className="px-4 py-2 rounded-lg bg-[#5bc0e8] hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium disabled:opacity-50"
                          >
                            {bulkImporting ? 'Importing…' : `Import ${bulkRows.filter((r) => !r.error).length} Products`}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {showAddItem && (
                  <div className="mb-4 p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/40 space-y-3">
                    <input
                      type="text"
                      placeholder="Item title"
                      value={newItem.title_en}
                      onChange={(e) => setNewItem((f) => ({ ...f, title_en: e.target.value }))}
                      disabled={newItemSaving}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <textarea
                      placeholder="Description"
                      value={newItem.description_en}
                      onChange={(e) => setNewItem((f) => ({ ...f, description_en: e.target.value }))}
                      rows={2}
                      disabled={newItemSaving}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        placeholder="Price"
                        value={newItem.price}
                        onChange={(e) => setNewItem((f) => ({ ...f, price: e.target.value }))}
                        disabled={newItemSaving}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <select
                        value={newItem.condition}
                        onChange={(e) => setNewItem((f) => ({ ...f, condition: e.target.value }))}
                        disabled={newItemSaving}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="New">New</option>
                        <option value="Used">Used</option>
                        <option value="Refurbished">Refurbished</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Location"
                        value={newItem.location}
                        onChange={(e) => setNewItem((f) => ({ ...f, location: e.target.value }))}
                        disabled={newItemSaving}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <select
                        value={newItem.category_id}
                        onChange={(e) => setNewItem((f) => ({ ...f, category_id: e.target.value, subcategory_id: '', subsubcategory_id: '' }))}
                        disabled={newItemSaving}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="">Category&hellip;</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name_en}</option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const selectedCat = categories.find((c) => String(c.id) === newItem.category_id);
                      const selectedSub = selectedCat?.subcategories?.find((s) => String(s.id) === newItem.subcategory_id);
                      if (!selectedCat?.subcategories?.length) return null;
                      return (
                        <div className="grid grid-cols-2 gap-3">
                          <select
                            value={newItem.subcategory_id}
                            onChange={(e) => setNewItem((f) => ({ ...f, subcategory_id: e.target.value, subsubcategory_id: '' }))}
                            disabled={newItemSaving}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="">Subcategory&hellip;</option>
                            {selectedCat.subcategories!.map((s) => (
                              <option key={s.id} value={s.id}>{s.name_en}</option>
                            ))}
                          </select>
                          {selectedSub?.subsubcategories && selectedSub.subsubcategories.length > 0 && (
                            <select
                              value={newItem.subsubcategory_id}
                              onChange={(e) => setNewItem((f) => ({ ...f, subsubcategory_id: e.target.value }))}
                              disabled={newItemSaving}
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                            >
                              <option value="">Sub-subcategory&hellip;</option>
                              {selectedSub.subsubcategories.map((ss) => (
                                <option key={ss.id} value={ss.id}>{ss.name_en}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })()}

                    <div
                      className="flex items-center gap-2 flex-wrap"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
                        if (files.length > 0) handleNewItemImagesUpload(files);
                      }}
                    >
                      {newItemImages.map((url, i) => (
                        <div key={i} className="relative w-14 h-14">
                          <img src={url} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-neutral-800" />
                          <button
                            type="button"
                            onClick={() => setNewItemImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <label className="cursor-pointer">
                        <div className="w-14 h-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-[9px] text-center leading-tight px-1 text-slate-500 hover:border-blue-400 hover:text-blue-600">
                          {newItemUploading ? '...' : 'Add Photos'}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={newItemUploading || newItemSaving}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleNewItemImagesUpload(e.target.files);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-[10px] text-slate-400">Select multiple files at once, or drag and drop them here.</p>

                    {newItemError && (
                      <div className="flex gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800">{newItemError}</p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateItem}
                      disabled={newItemSaving || newItemUploading}
                      className="w-full px-4 py-2 rounded-lg bg-[#5bc0e8] hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium disabled:opacity-50"
                    >
                      {newItemSaving ? 'Adding...' : 'Add to Shop'}
                    </button>
                  </div>
                )}

                {shopListingsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                    <Loader size={14} className="animate-spin" />
                    Loading items...
                  </div>
                ) : shopListings.length === 0 ? (
                  <p className="text-sm text-slate-400 py-2">No items yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {shopListings.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-slate-200 dark:border-neutral-800">
                        {item.images?.[0] ? (
                          <img src={item.images[0]} alt="" className="w-10 h-10 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-slate-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title_en}</p>
                          <p className="text-xs text-slate-400">{item.currency || 'KES'} {item.price?.toLocaleString?.() ?? item.price}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                          item.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' :
                          item.status === 'pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                          'bg-slate-100 text-slate-600 dark:bg-neutral-900 dark:text-neutral-200'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detailSuccess && (
                <div className="flex gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                  <Check size={20} className="text-green-600 shrink-0" />
                  <p className="text-sm text-green-800">{detailSuccess}</p>
                </div>
              )}
              {detailError && (
                <div className="flex gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{detailError}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-neutral-800">
              <button
                onClick={closeDetailModal}
                disabled={detailSaving}
                className="flex-1 px-4 py-2 rounded-xl border border-gray-300 text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:bg-neutral-900 disabled:opacity-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDetail}
                disabled={detailSaving || detailLoading || detailUploading !== null || !detailForm.business_name.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-[#5bc0e8] hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium disabled:opacity-50"
              >
                {detailSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
