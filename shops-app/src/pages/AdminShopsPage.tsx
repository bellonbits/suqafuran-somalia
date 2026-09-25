"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader, Store, Package, Search, ChevronDown, ChevronUp, Grid3x3,
  ExternalLink, MapPin, Mail, Phone, Calendar, Download, Upload, Settings,
  X, AlertCircle, ImageIcon
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import api from '@/services/api';
import Papa from 'papaparse';

const adminNavItems = ADMIN_NAV_ITEMS.map(({ icon: Icon, ...item }) => ({
  ...item,
  icon: <Icon className="w-5 h-5" />
}));

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
  );
}

const ShopsPage = () => {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedShop, setExpandedShop] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'listings' | 'active'>('listings');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Add-listing form, shown below the expanded shop's listings table
  const [categories, setCategories] = useState<any[]>([]);
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

  const resetAddItemForm = () => {
    setShowAddItem(false);
    setNewItem({ title_en: '', description_en: '', price: '', location: '', condition: 'New', category_id: '', subcategory_id: '', subsubcategory_id: '' });
    setNewItemImages([]);
    setNewItemError('');
  };

  const toggleExpanded = (shopId: number) => {
    setExpandedShop((prev) => (prev === shopId ? null : shopId));
    resetAddItemForm();
    if (categories.length === 0) {
      api.get('/listings/categories').then((res) => {
        setCategories(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
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

  const handleCreateItem = async (shop: any) => {
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
        { params: { owner_id: shop.user_id } }
      );

      setShops((prev) => prev.map((s) => (
        s.id === shop.id
          ? { ...s, listings: [res.data, ...s.listings], total_products: s.total_products + 1, active_products: s.active_products + (res.data.status === 'active' ? 1 : 0) }
          : s
      )));
      resetAddItemForm();
    } catch (err: any) {
      setNewItemError(err.response?.data?.detail || 'Failed to add item');
    } finally {
      setNewItemSaving(false);
    }
  };

  useEffect(() => { loadShops(); }, []);

  const loadShops = async () => {
    setLoading(true);
    try {
      const [verResponse, listingsResponse] = await Promise.all([
        api.get('/verifications/?limit=500'),
        api.get('/listings/?limit=5000'),
      ]);

      let shopsData = Array.isArray(verResponse.data) ? verResponse.data : [];
      let allListings = Array.isArray(listingsResponse.data) ? listingsResponse.data : [];

      const listingsByOwner = allListings.reduce((acc: any, listing: any) => {
        const ownerId = listing.owner_id;
        if (!acc[ownerId]) acc[ownerId] = [];
        acc[ownerId].push(listing);
        return acc;
      }, {});

      const results = shopsData.map(shop => {
        const listings = listingsByOwner[shop.user_id] || [];
        return {
          id: shop.id,
          shop_name: shop.user?.business_name || shop.user?.full_name || 'Unknown',
          owner_name: shop.user?.full_name || 'Unknown',
          email: shop.user?.email || '',
          phone: shop.user?.phone || '',
          verified: shop.status === 'approved',
          created_at: shop.created_at || new Date().toISOString(),
          listings,
          total_products: listings.length,
          active_products: listings.filter((l: any) => l.status === 'active').length,
          user_id: shop.user_id,
        };
      });

      setShops(results);
    } catch (error) {
      console.error('Error loading shops:', error);
      setShops([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = shops
    .filter(s =>
      s.shop_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      let av = sortBy === 'name' ? a.shop_name : sortBy === 'listings' ? a.total_products : a.active_products;
      let bv = sortBy === 'name' ? b.shop_name : sortBy === 'listings' ? b.total_products : b.active_products;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(
      filtered.map(s => ({
        id: s.id,
        shop_name: s.shop_name,
        owner_name: s.owner_name,
        email: s.email,
        phone: s.phone,
        total_products: s.total_products,
        active_products: s.active_products,
        verified: s.verified ? 'Yes' : 'No',
        joined_date: new Date(s.created_at).toLocaleDateString(),
      }))
    );

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `shops_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results: any) => {
        console.log('Imported CSV data:', results.data);
        alert(`Loaded ${results.data.length} shops for bulk update. Feature coming soon.`);
      },
      error: (error: any) => {
        console.error('CSV parse error:', error);
        alert('Error parsing CSV file');
      },
    });
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span className="ml-1 inline-flex flex-col gap-0">
      <ChevronUp className={`w-3 h-3 -mb-1 ${sortBy === col && sortDir === 'asc' ? 'text-sky-500' : 'text-gray-300'}`} />
      <ChevronDown className={`w-3 h-3 ${sortBy === col && sortDir === 'desc' ? 'text-sky-500' : 'text-gray-300'}`} />
    </span>
  );

  if (loading) {
    return (
      <DashboardLayout title="Shops Management" navItems={adminNavItems} userRole="admin">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-slate-400 text-sm">Loading shops…</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Shops Management" navItems={adminNavItems} userRole="admin">
      {/* Page header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">All Shops</h2>
            <p className="text-sm text-slate-400 mt-0.5">View all verified shops and their listings</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
            <input
              type="text"
              placeholder="Search shops, owners, email…"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onFocus={() => searchQuery && setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-neutral-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-sky-400 bg-white dark:bg-neutral-950 shadow-sm"
            />

            {/* Autocomplete Dropdown */}
            {showSuggestions && searchQuery && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 dark:border-neutral-800 rounded-xl shadow-lg z-50 max-h-64 overflow-y-auto">
                {shops
                  .filter(s =>
                    s.shop_name?.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
                    s.owner_name?.toLowerCase().startsWith(searchQuery.toLowerCase())
                  )
                  .slice(0, 10)
                  .map(shop => (
                    <button
                      key={shop.id}
                      onClick={() => {
                        setSearchQuery(shop.shop_name);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-sky-50 border-b border-slate-100 dark:border-neutral-800 last:border-b-0 transition-colors flex flex-col gap-0.5"
                    >
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{shop.shop_name}</p>
                      <p className="text-xs text-slate-400">{shop.owner_name} • {shop.total_products} products</p>
                    </button>
                  ))}
                {shops.filter(s =>
                  s.shop_name?.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
                  s.owner_name?.toLowerCase().startsWith(searchQuery.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-3 text-center text-sm text-slate-400">
                    No shops found
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Export/Import and Management buttons */}
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => router.push('/admin/shops')}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Settings size={16} />
            Edit Shops
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Download size={16} />
            Export {filtered.length} Shops to CSV
          </button>
          <label className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors shadow-sm cursor-pointer">
            <Upload size={16} />
            Import CSV for Bulk Update
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-7">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-950/30 flex items-center justify-center">
            <Store className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{filtered.length}</p>
            <p className="text-sm text-slate-400 mt-0.5">Total Shops</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{filtered.reduce((s, sh) => s + sh.total_products, 0)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Total Listings</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
            <Grid3x3 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-3xl font-black text-slate-900 dark:text-white">{filtered.reduce((s, sh) => s + sh.active_products, 0)}</p>
            <p className="text-sm text-slate-400 mt-0.5">Active Listings</p>
          </div>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="data-table-wrapper">
          <div className="py-20 text-center">
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No shops found</p>
          </div>
        </div>
      ) : (
        <div className="data-table-wrapper">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button onClick={() => toggleSort('name')} className="flex items-center hover:text-slate-700 dark:text-neutral-200 transition-colors">
                      Shop <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="hidden md:table-cell">Contact</th>
                  <th className="hidden sm:table-cell">Joined</th>
                  <th>
                    <button onClick={() => toggleSort('listings')} className="flex items-center hover:text-slate-700 dark:text-neutral-200 transition-colors">
                      Listings <SortIcon col="listings" />
                    </button>
                  </th>
                  <th>
                    <button onClick={() => toggleSort('active')} className="flex items-center hover:text-slate-700 dark:text-neutral-200 transition-colors">
                      Active <SortIcon col="active" />
                    </button>
                  </th>
                  <th>Status</th>
                  <th className="text-right">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(shop => (
                  <React.Fragment key={shop.id}>
                    <tr className={expandedShop === shop.id ? 'bg-sky-50/60' : ''}>
                      {/* Shop name */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <Store className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">{shop.shop_name}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{shop.owner_name}</p>
                          </div>
                        </div>
                      </td>
                      {/* Contact */}
                      <td className="hidden md:table-cell">
                        <div className="space-y-0.5">
                          {shop.email && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Mail className="w-3 h-3" />{shop.email}
                            </div>
                          )}
                          {shop.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Phone className="w-3 h-3" />{shop.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      {/* Joined */}
                      <td className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(shop.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      {/* Listings */}
                      <td>
                        <span className="text-lg font-black text-slate-800 dark:text-neutral-100">{shop.total_products}</span>
                      </td>
                      {/* Active */}
                      <td>
                        <span className="text-lg font-black text-emerald-600">{shop.active_products}</span>
                      </td>
                      {/* Status */}
                      <td>
                        <span className={`badge ${shop.verified ? 'badge-green' : 'badge-gray'}`}>
                          <StatusDot active={shop.verified} />
                          {shop.verified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      {/* Expand */}
                      <td className="text-right">
                        <button
                          onClick={() => toggleExpanded(shop.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-900 hover:bg-sky-50 dark:bg-sky-950/30 hover:text-sky-700 text-slate-600 dark:text-neutral-200 text-xs font-semibold transition-all"
                        >
                          {expandedShop === shop.id ? (
                            <><ChevronUp className="w-3.5 h-3.5" /> Hide</>
                          ) : (
                            <><ExternalLink className="w-3.5 h-3.5" /> Listings</>
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded listings row */}
                    {expandedShop === shop.id && (
                      <tr>
                        <td colSpan={7} className="px-0 py-0 bg-slate-50 border-t border-b border-sky-100">
                          <div className="p-5">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-neutral-100 mb-3 flex items-center gap-2">
                              <Package className="w-4 h-4 text-sky-500" />
                              Listings for {shop.shop_name}
                              <span className="ml-1 badge badge-blue">{shop.listings.length}</span>
                            </h4>

                            {shop.listings.length === 0 ? (
                              <div className="py-8 text-center text-slate-400 text-sm">
                                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                No listings yet
                              </div>
                            ) : null}
                            {shop.listings.length > 0 && (
                              <div className="data-table-wrapper">
                                <div className="overflow-x-auto">
                                  <table className="data-table">
                                    <thead>
                                      <tr>
                                        <th>Product</th>
                                        <th>Location</th>
                                        <th>Price</th>
                                        <th>Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {shop.listings.map((listing: any) => (
                                        <tr key={listing.id}>
                                          <td>
                                            <div className="flex items-center gap-3">
                                              {listing.images?.[0] ? (
                                                <img src={listing.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-slate-200 dark:border-neutral-800" />
                                              ) : (
                                                <div className="w-10 h-10 rounded-lg bg-gray-200 flex-shrink-0" />
                                              )}
                                              <p className="font-medium text-slate-900 dark:text-white max-w-[200px] truncate">
                                                {listing.title_en || listing.title_so || 'Unknown'}
                                              </p>
                                            </div>
                                          </td>
                                          <td>
                                            {listing.location && (
                                              <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <MapPin className="w-3 h-3" />{listing.location}
                                              </div>
                                            )}
                                          </td>
                                          <td>
                                            <span className="font-semibold text-slate-900 dark:text-white">
                                              {listing.currency} {listing.price?.toLocaleString()}
                                            </span>
                                          </td>
                                          <td>
                                            <span className={`badge ${
                                              listing.status === 'active' ? 'badge-green' :
                                              listing.status === 'pending' ? 'badge-yellow' : 'badge-gray'
                                            }`}>
                                              {listing.status}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Add Listing */}
                            <div className="mt-4 pt-4 border-t border-sky-100">
                              <button
                                onClick={() => setShowAddItem((v) => !v)}
                                className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                              >
                                {showAddItem ? 'Cancel' : '+ Add Listing'}
                              </button>

                              {showAddItem && (
                                <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-3 max-w-lg">
                                  <input
                                    type="text"
                                    placeholder="Item title"
                                    value={newItem.title_en}
                                    onChange={(e) => setNewItem((f) => ({ ...f, title_en: e.target.value }))}
                                    disabled={newItemSaving}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                  />
                                  <textarea
                                    placeholder="Description"
                                    value={newItem.description_en}
                                    onChange={(e) => setNewItem((f) => ({ ...f, description_en: e.target.value }))}
                                    rows={2}
                                    disabled={newItemSaving}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50 resize-none"
                                  />
                                  <div className="grid grid-cols-2 gap-3">
                                    <input
                                      type="number"
                                      placeholder="Price"
                                      value={newItem.price}
                                      onChange={(e) => setNewItem((f) => ({ ...f, price: e.target.value }))}
                                      disabled={newItemSaving}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                    />
                                    <select
                                      value={newItem.condition}
                                      onChange={(e) => setNewItem((f) => ({ ...f, condition: e.target.value }))}
                                      disabled={newItemSaving}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
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
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                    />
                                    <select
                                      value={newItem.category_id}
                                      onChange={(e) => setNewItem((f) => ({ ...f, category_id: e.target.value, subcategory_id: '', subsubcategory_id: '' }))}
                                      disabled={newItemSaving}
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                    >
                                      <option value="">Category&hellip;</option>
                                      {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name_en}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {(() => {
                                    const selectedCat = categories.find((c) => String(c.id) === newItem.category_id);
                                    const selectedSub = selectedCat?.subcategories?.find((s: any) => String(s.id) === newItem.subcategory_id);
                                    if (!selectedCat?.subcategories?.length) return null;
                                    return (
                                      <div className="grid grid-cols-2 gap-3">
                                        <select
                                          value={newItem.subcategory_id}
                                          onChange={(e) => setNewItem((f) => ({ ...f, subcategory_id: e.target.value, subsubcategory_id: '' }))}
                                          disabled={newItemSaving}
                                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                        >
                                          <option value="">Subcategory&hellip;</option>
                                          {selectedCat.subcategories.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name_en}</option>
                                          ))}
                                        </select>
                                        {selectedSub?.subsubcategories?.length > 0 && (
                                          <select
                                            value={newItem.subsubcategory_id}
                                            onChange={(e) => setNewItem((f) => ({ ...f, subsubcategory_id: e.target.value }))}
                                            disabled={newItemSaving}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-800 text-sm bg-white dark:bg-neutral-950 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-sky-500/30 disabled:opacity-50"
                                          >
                                            <option value="">Sub-subcategory&hellip;</option>
                                            {selectedSub.subsubcategories.map((ss: any) => (
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
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    ))}
                                    <label className="cursor-pointer">
                                      <div className="w-14 h-14 rounded-lg border border-dashed border-slate-300 dark:border-neutral-800 flex items-center justify-center text-[9px] text-center leading-tight px-1 text-slate-500 hover:border-sky-400 hover:text-sky-600">
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
                                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                      <p className="text-xs text-red-800">{newItemError}</p>
                                    </div>
                                  )}

                                  <button
                                    onClick={() => handleCreateItem(shop)}
                                    disabled={newItemSaving || newItemUploading}
                                    className="w-full px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:bg-gray-300 text-white text-sm font-semibold disabled:opacity-50"
                                  >
                                    {newItemSaving ? 'Adding...' : 'Add to Shop'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-6 py-3 border-t border-slate-100 dark:border-neutral-800 bg-gray-50/50 flex items-center justify-between text-xs text-slate-400">
            <span>Showing <span className="font-semibold text-slate-600 dark:text-neutral-200">{filtered.length}</span> of <span className="font-semibold text-slate-600 dark:text-neutral-200">{shops.length}</span> shops</span>
            <span>Click "Listings" to expand a shop's products</span>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ShopsPage;
