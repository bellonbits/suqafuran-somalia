"use client";

import React, { useState, useEffect } from 'react';
import {
  Search, Loader2, Edit2, X, Check, AlertCircle, Store,
  ShoppingBag, TrendingUp, Users, Activity, ShieldCheck,
  ExternalLink, RefreshCw, ImageIcon, CheckCircle2, XCircle, Package
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import api from '@/services/api';

interface Shop {
  id: number;
  business_name: string;
  full_name: string;
  shop_description?: string;
  logo_url?: string;
  shop_page_banner?: string;
  shop_detail_banner?: string;
  location?: string;
  is_active: boolean;
  email: string;
}

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

const agentNavItems = [
  { label: 'Agent Dashboard', icon: <Activity className="w-5 h-5" />, href: '/agent-dashboard' },
  { label: 'Agent Shops', icon: <Store className="w-5 h-5" />, href: '/agent-shops' },
  { label: 'Agent Listings', icon: <ShoppingBag className="w-5 h-5" />, href: '/agent-listings' },
  { label: 'Agent Earnings', icon: <TrendingUp className="w-5 h-5" />, href: '/agent-earnings' },
  { label: 'Agent Analytics', icon: <Users className="w-5 h-5" />, href: '/agent-analytics' },
];

export default function AgentShopsPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [form, setForm] = useState({ business_name: '', shop_description: '', logo_url: '', location: '' });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  useEffect(() => { loadShops(); }, []);

  const loadShops = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.get('/admin/shops', { params: { skip: 0, limit: 500 } });
      setShops(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load shops:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredShops = [...shops]
    .sort((a, b) => a.business_name.localeCompare(b.business_name))
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return s.business_name?.toLowerCase().includes(q) ||
             s.full_name?.toLowerCase().includes(q) ||
             s.email?.toLowerCase().includes(q);
    });

  const openEdit = (shop: Shop) => {
    setEditingShop(shop);
    setForm({ business_name: shop.business_name || '', shop_description: shop.shop_description || '', logo_url: shop.logo_url || '', location: shop.location || '' });
    setError(''); setSuccess('');
    setShowAddItem(false);
    setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
    setNewItemImages([]);
    setNewItemError('');
    loadShopListings(shop.id);
    if (categories.length === 0) {
      api.get('/listings/categories').then((res) => {
        setCategories(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
  };

  const closeEdit = () => {
    setEditingShop(null);
    setShopListings([]);
    setShowAddItem(false);
    setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
    setNewItemImages([]);
    setNewItemError('');
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

  const handleImageUpload = async (file: File) => {
    setUploading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('high_quality', 'true');
      const res = await api.post('/listings/upload', fd);
      setForm(f => ({ ...f, logo_url: res.data.url }));
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Image upload failed');
    } finally { setUploading(false); }
  };

  const handleNewItemImagesUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setNewItemUploading(true);
    setNewItemError('');
    try {
      const fd = new FormData();
      fileArray.forEach((file) => fd.append('files', file, file.name));
      const res = await api.post('/listings/upload-multiple', fd);
      const urls = (res.data || []).map((item: any) => item.url);
      setNewItemImages((imgs) => [...imgs, ...urls]);
    } catch (err: any) {
      setNewItemError(err.response?.data?.detail || 'Image upload failed');
    } finally {
      setNewItemUploading(false);
    }
  };

  const handleCreateItem = async () => {
    if (!editingShop) return;
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
        { params: { owner_id: editingShop.id } }
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

  const handleSave = async () => {
    if (!editingShop) return;
    if (!form.business_name.trim()) { setError('Shop name cannot be empty'); return; }
    setSaving(true); setError('');
    try {
      await api.put(`/admin/shops/${editingShop.id}`, form);
      setSuccess('Shop updated successfully!');
      loadShops(true);
      setTimeout(() => { setEditingShop(null); setSuccess(''); }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save changes');
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <DashboardLayout title="Agent Shops" navItems={agentNavItems} userRole="agent">
        <div className="flex flex-col items-center justify-center h-96 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
          <p className="text-sm font-semibold text-slate-400">Loading Shops Directory…</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Agent Shops" navItems={agentNavItems} userRole="agent">
      <div className="space-y-6 pb-12">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Shops Directory</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Browse and manage all registered seller shops</p>
          </div>
          <button
            onClick={() => loadShops(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold shadow-sm hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-sky-500' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Shops', value: shops.length, color: 'bg-sky-50 dark:bg-sky-950/40 text-sky-600' },
            { label: 'Active Shops', value: shops.filter(s => s.is_active).length, color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' },
            { label: 'Inactive Shops', value: shops.filter(s => !s.is_active).length, color: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{s.value}</h2>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-2 inline-block ${s.color}`}>Live Count</span>
            </div>
          ))}
        </div>

        {/* Search + Table */}
        <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by shop name, owner, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <span className="text-xs font-bold text-slate-400">{filteredShops.length} shops found</span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/60 dark:bg-neutral-900/40 border-b border-slate-100 dark:border-neutral-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Shop</th>
                  <th className="py-3.5 px-5">Owner</th>
                  <th className="py-3.5 px-5">Email</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                {filteredShops.length > 0 ? filteredShops.map(shop => (
                  <tr key={shop.id} className="hover:bg-slate-50/80 dark:hover:bg-neutral-900/30 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        {shop.logo_url ? (
                          <img src={shop.logo_url} alt={shop.business_name} className="w-9 h-9 rounded-xl object-cover border border-slate-100 flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                            {shop.business_name?.charAt(0) || 'S'}
                          </div>
                        )}
                        <span className="font-bold text-slate-900 dark:text-white">{shop.business_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-5 font-medium text-slate-600 dark:text-neutral-200">{shop.full_name}</td>
                    <td className="py-4 px-5 text-slate-400">{shop.email}</td>
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${shop.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {shop.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-right">
                      <button onClick={() => openEdit(shop)} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-900 text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-400 font-medium">No shops found matching your search</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-neutral-800">
            {filteredShops.map(shop => (
              <div key={shop.id} className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt={shop.business_name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {shop.business_name?.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{shop.business_name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{shop.email}</p>
                  </div>
                </div>
                <button onClick={() => openEdit(shop)} className="p-2 rounded-xl bg-slate-50 text-slate-500 flex-shrink-0">
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingShop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && closeEdit()}>
          <div className="bg-white dark:bg-neutral-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-neutral-800 w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Edit Shop</h3>
              <button onClick={closeEdit} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold"><AlertCircle className="w-4 h-4" />{error}</div>}
            {success && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-bold"><CheckCircle2 className="w-4 h-4" />{success}</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Shop Name</label>
                <input
                  value={form.business_name}
                  onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Description</label>
                <textarea
                  value={form.shop_description}
                  onChange={(e) => setForm(f => ({ ...f, shop_description: e.target.value }))}
                  rows={3}
                  className="w-full bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Bakaara, Mogadishu"
                  className="w-full bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">Logo</label>
                <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} className="hidden" id="logo-upload" />
                <label htmlFor="logo-upload" className="flex items-center gap-2 cursor-pointer px-3.5 py-2.5 bg-slate-50 dark:bg-neutral-900 border border-dashed border-slate-300 dark:border-neutral-800 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors">
                  <ImageIcon className="w-4 h-4" /> {uploading ? 'Uploading…' : 'Upload Logo Image'}
                </label>
                {form.logo_url && <img src={form.logo_url} className="w-16 h-16 rounded-xl mt-2 object-cover border" alt="Logo preview" />}
              </div>
            </div>

            {/* Items in this shop */}
            <div className="border-t border-slate-100 dark:border-neutral-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase">
                  <Package className="w-3.5 h-3.5" />
                  Items {shopListings.length > 0 && `(${shopListings.length})`}
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddItem((v) => !v)}
                  className="text-xs font-extrabold text-sky-600 hover:text-sky-700"
                >
                  {showAddItem ? 'Cancel' : '+ Add Item'}
                </button>
              </div>

              {showAddItem && (
                <div className="mb-4 p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/60 space-y-3">
                  <input
                    type="text"
                    placeholder="Item title"
                    value={newItem.title_en}
                    onChange={(e) => setNewItem((f) => ({ ...f, title_en: e.target.value }))}
                    disabled={newItemSaving}
                    className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                  />
                  <textarea
                    placeholder="Description"
                    value={newItem.description_en}
                    onChange={(e) => setNewItem((f) => ({ ...f, description_en: e.target.value }))}
                    rows={2}
                    disabled={newItemSaving}
                    className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50 resize-none"
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="number"
                      placeholder="Price"
                      value={newItem.price}
                      onChange={(e) => setNewItem((f) => ({ ...f, price: e.target.value }))}
                      disabled={newItemSaving}
                      className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                    />
                    <select
                      value={newItem.condition}
                      onChange={(e) => setNewItem((f) => ({ ...f, condition: e.target.value }))}
                      disabled={newItemSaving}
                      className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                    >
                      <option value="New">New</option>
                      <option value="Used">Used</option>
                      <option value="Refurbished">Refurbished</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      placeholder="Location"
                      value={newItem.location}
                      onChange={(e) => setNewItem((f) => ({ ...f, location: e.target.value }))}
                      disabled={newItemSaving}
                      className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
                    />
                    <select
                      value={newItem.category_id}
                      onChange={(e) => setNewItem((f) => ({ ...f, category_id: e.target.value, subcategory_id: '', subsubcategory_id: '' }))}
                      disabled={newItemSaving}
                      className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
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
                      <div className="grid grid-cols-2 gap-2.5">
                        <select
                          value={newItem.subcategory_id}
                          onChange={(e) => setNewItem((f) => ({ ...f, subcategory_id: e.target.value, subsubcategory_id: '' }))}
                          disabled={newItemSaving}
                          className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
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
                            className="w-full bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
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
                        <img src={url} alt="" className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-neutral-800" />
                        <button
                          type="button"
                          onClick={() => setNewItemImages((imgs) => imgs.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <label className="cursor-pointer">
                      <div className="w-14 h-14 rounded-xl border border-dashed border-slate-300 dark:border-neutral-800 flex items-center justify-center text-[9px] text-center leading-tight px-1 text-slate-500 hover:border-sky-400 hover:text-sky-600">
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
                    <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {newItemError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateItem}
                    disabled={newItemSaving || newItemUploading}
                    className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-sky-500/20 transition-all"
                  >
                    {newItemSaving ? 'Adding...' : 'Add to Shop'}
                  </button>
                </div>
              )}

              {shopListingsLoading ? (
                <div className="flex items-center gap-2 text-xs font-bold text-slate-400 py-3">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Loading items...
                </div>
              ) : shopListings.length === 0 ? (
                <p className="text-xs font-medium text-slate-400 py-2">No items yet.</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {shopListings.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl border border-slate-100 dark:border-neutral-800">
                      {item.images?.[0] ? (
                        <img src={item.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{item.title_en}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{item.currency || 'KES'} {item.price?.toLocaleString?.() ?? item.price}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        item.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                        item.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={closeEdit} className="flex-1 py-2.5 bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-sky-500/20 transition-all">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
