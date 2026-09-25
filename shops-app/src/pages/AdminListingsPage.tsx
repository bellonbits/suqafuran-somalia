"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, Loader, ChevronLeft, Eye, Trash2, Edit2, X, ChevronDown, Download, Upload, ImageOff, Check, XCircle, AlertCircle, Box, CheckCircle2, Clock, Ban, Star, PackageCheck } from 'lucide-react';
import api from '@/services/api';
import Papa from 'papaparse';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ADMIN_NAV_ITEMS } from '@/admin-dashboard/navigation';
import { useAuthStore } from '@/store/useAuth';
import { getBrandsForCategory } from '@/constants/brands';

const ListingsManagementPage = () => {
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all');
  const [categories, setCategories] = useState<any[]>([]);
  const [viewingListing, setViewingListing] = useState<any>(null);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editImages, setEditImages] = useState<string[]>([]);
  const [newEditImages, setNewEditImages] = useState<File[]>([]);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());
  const [savingEdit, setSavingEdit] = useState(false);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [approvalStatusOpen, setApprovalStatusOpen] = useState(false);
  const [exportCount, setExportCount] = useState(0);
  const [rejectingListing, setRejectingListing] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [approvingListing, setApprovingListing] = useState<number | null>(null);
  const [hoveredRejectionReason, setHoveredRejectionReason] = useState<{id: number, reason: string} | null>(null);
  const [importingCSV, setImportingCSV] = useState(false);
  const [stats, setStats] = useState<{ total: number; active: number; pending: number; sold: number; suspended: number; deleted: number; rejected: number; reported: number } | null>(null);
  const [busyActionId, setBusyActionId] = useState<number | null>(null);

  const { user } = useAuthStore();
  const navItems = ADMIN_NAV_ITEMS.map(item => ({
    ...item,
    icon: <item.icon className="w-5 h-5" />
  }));

  useEffect(() => {
    loadCategories();
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.get('/admin/listings/stats');
      setStats(res.data);
    } catch {
      // Cards just stay hidden if this fails -- the table itself still works
    }
  };

  const handleSuspend = async (listing: any) => {
    setBusyActionId(listing.id);
    try {
      const suspended = listing.status === 'suspended';
      await api.patch(`/listings/${listing.id}`, { status: suspended ? 'active' : 'suspended' });
      loadListings();
      loadStats();
    } finally {
      setBusyActionId(null);
    }
  };

  const handleMarkSold = async (listing: any) => {
    setBusyActionId(listing.id);
    try {
      await api.patch(`/listings/${listing.id}`, { is_sold: true });
      loadListings();
      loadStats();
    } finally {
      setBusyActionId(null);
    }
  };

  const handleToggleFeature = async (listing: any) => {
    setBusyActionId(listing.id);
    try {
      const isFeatured = (listing.boost_level || 0) > 0;
      const payload = isFeatured
        ? { boost_level: 0, boost_expires_at: null }
        : { boost_level: 1, boost_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() };
      await api.patch(`/listings/${listing.id}`, payload);
      loadListings();
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    loadListings();
  }, [searchQuery, categoryFilter, statusFilter, approvalStatusFilter]);

  const loadListings = async () => {
    setLoading(true);
    try {
      let url = `/listings/?limit=500`;
      if (searchQuery) url += `&q=${searchQuery}`;
      if (categoryFilter !== 'all') url += `&category_id=${categoryFilter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (approvalStatusFilter !== 'all') url += `&approval_status=${approvalStatusFilter}`;

      const res = await api.get(url).catch(() => null);
      if (res?.data) {
        const data = Array.isArray(res.data) ? res.data : [];
        setListings(data);
        setExportCount(data.length);
      }
    } catch (error) {
      console.error('Error loading listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await api.get('/listings/categories').catch(() => null);
      if (res?.data) {
        const cats = Array.isArray(res.data) ? res.data : [];
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCategoryName = (categoryId: string | number | null) => {
    if (!categoryId) return 'N/A';
    const category = categories.find(c => c.id == categoryId);
    return category?.name_en || 'N/A';
  };

  const handleView = (listing: any) => {
    setViewingListing(listing);
  };

  // Brands curated per sub-sub-category (via admin-categories) take priority;
  // falls back to the static category-level list when none are configured.
  const getBrandOptions = (categoryId?: string | number, subcategoryId?: string | number, subsubcategoryId?: string | number) => {
    const cat = categories.find((c) => c.id.toString() === categoryId?.toString());
    const sub = cat?.subcategories?.find((s: any) => s.id.toString() === subcategoryId?.toString());
    const subsub = sub?.subsubcategories?.find((ss: any) => ss.id.toString() === subsubcategoryId?.toString());
    if (subsub?.brands?.length > 0) return subsub.brands;
    return getBrandsForCategory(cat?.name_en);
  };

  const handleEdit = (id: number) => {
    const listing = listings.find((l) => l.id === id);
    if (!listing) return;
    setEditingListing(listing);
    setEditImages(listing.images || (listing.image_url ? [listing.image_url] : []));
    setNewEditImages([]);
    setBrokenImages(new Set());

    const initialBrand = listing.brand || listing.attributes?.brand || '';
    const knownBrands = getBrandOptions(listing.category_id, listing.subcategory_id, listing.subsubcategory_id);
    setIsCustomBrand(Boolean(initialBrand) && !knownBrands.includes(initialBrand));

    setEditForm({
      title_en: listing.title_en || listing.title || '',
      title_so: listing.title_so || '',
      description_en: listing.description_en || listing.description || '',
      description_so: listing.description_so || '',
      price: listing.price ?? 0,
      currency: listing.currency || 'KSh',
      location: listing.location || '',
      condition: listing.condition || 'good',
      category_id: listing.category_id ? String(listing.category_id) : '',
      subcategory_id: listing.subcategory_id ? String(listing.subcategory_id) : '',
      subsubcategory_id: listing.subsubcategory_id ? String(listing.subsubcategory_id) : '',
      status: listing.status || 'active',
      is_negotiable: Boolean(listing.is_negotiable),
      is_sold: Boolean(listing.is_sold),
      brand: initialBrand,
      attributes: listing.attributes || {},
    });
  };

  const handleSaveEdit = async () => {
    if (!editingListing) return;
    setSavingEdit(true);
    try {
      let finalImages = [...editImages];
      if (newEditImages.length > 0) {
        for (const file of newEditImages) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('high_quality', 'true');
          const res = await api.post('/listings/upload', formData).catch(() => null);
          if (res?.data?.url) {
            finalImages.push(res.data.url);
          }
        }
      }

      const mergedAttributes = { ...(editForm.attributes || {}) };
      if (editForm.brand) {
        mergedAttributes.brand = editForm.brand;
      } else {
        delete mergedAttributes.brand;
      }

      await api.patch(`/listings/${editingListing.id}`, {
        title_en: editForm.title_en,
        title_so: editForm.title_so,
        description_en: editForm.description_en,
        description_so: editForm.description_so,
        price: Number(editForm.price) || 0,
        currency: editForm.currency,
        location: editForm.location,
        condition: editForm.condition,
        status: editForm.status,
        category_id: editForm.category_id ? Number(editForm.category_id) : null,
        subcategory_id: editForm.subcategory_id ? Number(editForm.subcategory_id) : null,
        subsubcategory_id: editForm.subsubcategory_id ? Number(editForm.subsubcategory_id) : null,
        is_negotiable: editForm.is_negotiable,
        is_sold: editForm.is_sold,
        images: finalImages,
        attributes: mergedAttributes,
      });

      setEditingListing(null);
      setViewingListing(null);
      loadListings();
    } catch (error) {
      console.error('Error updating listing:', error);
      alert('Failed to update listing');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    if (confirm('Are you sure you want to delete this listing?')) {
      try {
        await api.delete(`/listings/${id}`).catch(() => null);
        setDeleting(null);
        loadListings();
      } catch (error) {
        console.error('Error deleting listing:', error);
        setDeleting(null);
      }
    } else {
      setDeleting(null);
    }
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(listings.map(l => ({
      id: l.id,
      title_en: l.title_en,
      title_so: l.title_so,
      description_en: l.description_en,
      description_so: l.description_so,
      price: l?.price ?? 0,
      currency: l.currency,
      category: getCategoryName(l.category_id),
      condition: l.condition,
      location: l.location,
      status: l.status,
      views: l.views,
      is_sold: l.is_sold,
      images: l.images?.join('|') || '',
    })));

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `listings_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingCSV(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/listings/bulk-edit-by-category', formData);
      const errorSummary = data.errors?.length
        ? `\n\n${data.errors.length} row(s) skipped:\n${data.errors.slice(0, 5).map((err: any) => `Row ${err.row}: ${err.message}`).join('\n')}`
        : '';
      alert(`Updated ${data.updated_listings} listing(s), ${data.field_changes} field(s) changed.${errorSummary}`);
      loadListings();
    } catch (error: any) {
      console.error('CSV import error:', error);
      alert(error?.response?.data?.detail || 'Failed to import CSV');
    } finally {
      setImportingCSV(false);
      e.target.value = '';
    }
  };

  const handleApprove = async (id: number) => {
    setApprovingListing(id);
    try {
      const notes = prompt('Add optional moderation notes:');
      await api.post(`/listings/${id}/approve`, { notes: notes || '' }).catch(() => null);
      loadListings();
    } catch (error) {
      console.error('Error approving listing:', error);
      alert('Failed to approve listing');
    } finally {
      setApprovingListing(null);
    }
  };

  const handleRejectClick = (id: number) => {
    setRejectingListing(id);
    setRejectionReason('');
    setRejectionNotes('');
    setShowRejectionModal(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Rejection reason is required');
      return;
    }

    if (!rejectingListing) return;

    try {
      await api.post(`/listings/${rejectingListing}/reject`, {
        reason: rejectionReason,
        notes: rejectionNotes || '',
      }).catch(() => null);
      setShowRejectionModal(false);
      setRejectingListing(null);
      setRejectionReason('');
      setRejectionNotes('');
      loadListings();
    } catch (error) {
      console.error('Error rejecting listing:', error);
      alert('Failed to reject listing');
    }
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'rejected':
        return 'bg-rose-50 dark:bg-rose-950/30 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400';
      default:
        return 'bg-slate-100 dark:bg-neutral-900 dark:bg-gray-700 text-slate-700 dark:text-neutral-200 dark:text-gray-300';
    }
  };

  return (
    <DashboardLayout title="Posted Ads" navItems={navItems} userRole="admin">
      <div className="py-8">

        {/* Stat cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {[
              { label: 'Total', value: stats.total, icon: Box, color: 'text-slate-500 bg-slate-50 dark:bg-neutral-900' },
              { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
              { label: 'Sold', value: stats.sold, icon: PackageCheck, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/30' },
              { label: 'Suspended', value: stats.suspended, icon: Ban, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
              { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-600 bg-rose-50 dark:bg-rose-950/30' },
              { label: 'Reported', value: stats.reported, icon: AlertCircle, color: 'text-red-600 bg-rose-50 dark:bg-rose-950/30' },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 rounded-2xl p-3.5 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.color}`}>
                  <c.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-900 dark:text-white leading-none">{c.value?.toLocaleString() ?? 0}</p>
                  <p className="text-[11px] text-slate-400 mt-1 truncate">{c.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons & Filters */}
        <div className="flex gap-3 flex-wrap mb-6 items-center">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-[#02CCFE] hover:bg-[#02CCFE] text-white rounded-lg font-semibold flex items-center gap-2 transition-colors"
          >
            <Download size={16} />
            Export {exportCount} Listings with Images
          </button>

          <label className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center gap-2 transition-colors cursor-pointer ${importingCSV ? 'opacity-50 pointer-events-none' : ''}`}>
            {importingCSV ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
            {importingCSV ? 'Importing...' : 'Import & Bulk Update CSV'}
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              disabled={importingCSV}
              className="hidden"
            />
          </label>

          <div className="flex-1" />

          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search listings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white placeholder-gray-500 dark:placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Category Dropdown */}
          <div className="relative z-40">
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-gray-600 font-medium flex items-center gap-2 transition-colors min-w-48"
            >
              Category: {categoryFilter === 'all' ? 'All' : (categories.find(c => c.id == categoryFilter)?.name_en || 'Select')}
              <ChevronDown className="w-4 h-4" />
            </button>
            {categoryOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setCategoryOpen(false)} />
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-64 max-h-96 overflow-y-auto">
                  <button
                    onClick={() => { setCategoryFilter('all'); setCategoryOpen(false); }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 border-b border-slate-200 dark:border-neutral-800 dark:border-gray-600 font-medium text-slate-900 dark:text-white dark:text-white bg-white dark:bg-gray-800"
                  >
                    All Categories
                  </button>
                  {categories.length > 0 ? (
                    categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setCategoryFilter(cat.id); setCategoryOpen(false); }}
                        className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 border-b border-slate-200 dark:border-neutral-800 dark:border-gray-600 text-slate-900 dark:text-white dark:text-white bg-white dark:bg-gray-800"
                      >
                        {cat.name_en || cat.name_so || 'Unnamed'}
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-slate-900 dark:text-white dark:text-white bg-white dark:bg-gray-800">No categories</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Status Dropdown */}
          <div className="relative z-40">
            <button
              onClick={() => setStatusOpen(!statusOpen)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-gray-600 font-medium flex items-center gap-2 transition-colors"
            >
              Status: {statusFilter === 'all' ? 'All' : statusFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {statusOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)} />
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-40 overflow-y-auto">
                  {['all', 'active', 'inactive', 'pending', 'suspended', 'sold'].map(status => (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setStatusOpen(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 border-b border-slate-200 dark:border-neutral-800 dark:border-gray-600 text-slate-900 dark:text-white dark:text-white bg-white dark:bg-gray-800"
                    >
                      {status === 'all' ? 'All Statuses' : status}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Approval Status Dropdown */}
          <div className="relative z-40">
            <button
              onClick={() => setApprovalStatusOpen(!approvalStatusOpen)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-gray-600 font-medium flex items-center gap-2 transition-colors"
            >
              Approval: {approvalStatusFilter === 'all' ? 'All' : approvalStatusFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {approvalStatusOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setApprovalStatusOpen(false)} />
                <div className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-48 overflow-y-auto">
                  {['all', 'pending', 'approved', 'rejected'].map(status => (
                    <button
                      key={status}
                      onClick={() => { setApprovalStatusFilter(status); setApprovalStatusOpen(false); }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 border-b border-slate-200 dark:border-neutral-800 dark:border-gray-600 text-slate-900 dark:text-white dark:text-white bg-white dark:bg-gray-800 flex items-center gap-2"
                    >
                      {status === 'all' && 'All Approval Statuses'}
                      {status === 'pending' && (
                        <>
                          <AlertCircle className="w-4 h-4 text-yellow-600" />
                          Pending Review
                        </>
                      )}
                      {status === 'approved' && (
                        <>
                          <Check className="w-4 h-4 text-green-600" />
                          Approved
                        </>
                      )}
                      {status === 'rejected' && (
                        <>
                          <XCircle className="w-4 h-4 text-red-600" />
                          Rejected
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-neutral-300 mb-4">CSV includes: images (pipe-separated URLs)</p>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-neutral-800 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-neutral-800 dark:border-gray-700 bg-slate-50 dark:bg-neutral-900/40 dark:bg-gray-900">
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">TITLE</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">PRICE</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">CATEGORY</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">IMAGES</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">STATUS</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">APPROVAL</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">VIEWS</th>
                    <th className="px-4 py-4 text-left text-sm font-bold text-slate-900 dark:text-white dark:text-white">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-neutral-300">
                        No listings found
                      </td>
                    </tr>
                  ) : (
                    listings.map((listing) => (
                      <tr
                        key={listing.id}
                        className="border-b border-slate-200 dark:border-neutral-800 dark:border-gray-700 hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            {listing.images && listing.images.length > 0 ? (
                              <img
                                src={listing.images[0]}
                                alt=""
                                className="w-10 h-10 rounded object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                <ImageOff size={16} className="text-slate-400" />
                              </div>
                            )}
                            <p className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white truncate">
                              {listing.title_en || listing.title_so || 'Unknown'}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white dark:text-white">
                            {listing.currency} {listing.price ? (listing?.price || 0).toLocaleString() : '0'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">
                            {getCategoryName(listing.category_id)}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            {listing.images && listing.images.slice(0, 3).map((img: string, idx: number) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Img ${idx}`}
                                className="w-8 h-8 rounded object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ))}
                            {listing.images && listing.images.length > 3 && (
                              <div className="w-8 h-8 rounded bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-bold text-slate-900 dark:text-white dark:text-white">
                                +{listing.images.length - 3}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`px-2 py-1 rounded text-xs font-bold ${
                              listing.status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : listing.status === 'pending'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                : listing.status === 'suspended'
                                ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                : listing.status === 'sold'
                                ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                                : 'bg-slate-100 dark:bg-neutral-900 dark:bg-gray-700 text-slate-700 dark:text-neutral-200 dark:text-gray-300'
                            }`}
                          >
                            {listing.status}
                          </span>
                          {(listing.boost_level || 0) > 0 && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                              <Star className="w-2.5 h-2.5 fill-current" /> Featured
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="relative">
                            <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${getApprovalStatusColor(listing.approval_status || 'pending')}`}>
                              {listing.approval_status === 'approved' && 'Approved'}
                              {listing.approval_status === 'rejected' && 'Rejected'}
                              {listing.approval_status === 'pending' && 'Pending'}
                            </span>
                            {listing.approval_status === 'rejected' && listing.rejection_reason && (
                              <div
                                className="relative inline-block ml-2"
                                onMouseEnter={() => setHoveredRejectionReason({id: listing.id, reason: listing.rejection_reason})}
                                onMouseLeave={() => setHoveredRejectionReason(null)}
                              >
                                <AlertCircle className="w-4 h-4 text-red-600 cursor-help inline" />
                                {hoveredRejectionReason?.id === listing.id && (
                                  <div className="absolute left-0 mt-2 w-64 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-xs text-red-800 dark:text-red-300 z-10 shadow-lg">
                                    {hoveredRejectionReason.reason}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-neutral-200 dark:text-neutral-300">
                          {listing.views || 0}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleView(listing)}
                              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="View details"
                            >
                              <Eye className="w-4 h-4 text-[#5bc0e8] dark:text-[#6cd4ff]" />
                            </button>
                            {listing.approval_status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApprove(listing.id)}
                                  disabled={approvingListing === listing.id}
                                  className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  {approvingListing === listing.id ? (
                                    <Loader className="w-4 h-4 text-green-600 dark:text-green-400 animate-spin" />
                                  ) : (
                                    <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleRejectClick(listing.id)}
                                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleEdit(listing.id)}
                              className="p-1.5 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                            </button>
                            {!listing.is_sold && listing.status !== 'sold' && (
                              <button
                                onClick={() => handleMarkSold(listing)}
                                disabled={busyActionId === listing.id}
                                className="p-1.5 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded transition-colors disabled:opacity-50"
                                title="Mark as Sold"
                              >
                                <PackageCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                              </button>
                            )}
                            <button
                              onClick={() => handleToggleFeature(listing)}
                              disabled={busyActionId === listing.id}
                              className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors disabled:opacity-50"
                              title={(listing.boost_level || 0) > 0 ? 'Unfeature' : 'Feature'}
                            >
                              <Star className={`w-4 h-4 ${(listing.boost_level || 0) > 0 ? 'text-amber-500 fill-amber-500' : 'text-amber-500'}`} />
                            </button>
                            <button
                              onClick={() => handleSuspend(listing)}
                              disabled={busyActionId === listing.id}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded transition-colors disabled:opacity-50"
                              title={listing.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                            >
                              <Ban className={`w-4 h-4 ${listing.status === 'suspended' ? 'text-slate-400' : 'text-slate-600 dark:text-neutral-300'}`} />
                            </button>
                            <button
                              onClick={() => handleDelete(listing.id)}
                              disabled={deleting === listing.id}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deleting === listing.id ? (
                                <Loader className="w-4 h-4 text-red-600 dark:text-red-400 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Reason Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="border-b border-slate-200 dark:border-neutral-800 dark:border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white dark:text-white flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-600" />
                Reject Listing
              </h2>
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectingListing(null);
                  setRejectionReason('');
                  setRejectionNotes('');
                }}
                className="p-1 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-6 h-6 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-2">
                  Rejection Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why is this listing being rejected? (e.g., Duplicate listing, Policy violation, Poor quality images)"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white placeholder-gray-500 dark:placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  rows={4}
                />
                <p className="mt-1 text-xs text-slate-600 dark:text-neutral-200 dark:text-neutral-300">
                  This will be shown to the seller
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-2">
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="Add internal notes for moderation team..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white dark:text-white placeholder-gray-500 dark:placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectingListing(null);
                    setRejectionReason('');
                    setRejectionNotes('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-slate-900 dark:text-white dark:text-white rounded-lg font-semibold hover:bg-slate-50 dark:bg-neutral-900/40 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmReject}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject Listing
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {viewingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-neutral-800 dark:border-gray-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white dark:text-white">Listing Details</h2>
              <button
                onClick={() => setViewingListing(null)}
                className="p-1 hover:bg-slate-100 dark:bg-neutral-900 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-6 h-6 text-slate-600 dark:text-neutral-200 dark:text-neutral-300" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {viewingListing.images && viewingListing.images.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white dark:text-white mb-3">Images</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {viewingListing.images.map((img: string, idx: number) => (
                      <img
                        key={idx}
                        src={img}
                        alt={`Image ${idx + 1}`}
                        className="w-full h-40 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">TITLE (EN)</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.title_en}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">TITLE (SO)</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.title_so}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">PRICE</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">
                    {viewingListing.currency} {viewingListing.price?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">LOCATION</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.location}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">CONDITION</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.condition}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">CATEGORY</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">
                    {getCategoryName(viewingListing.category_id)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">STATUS</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold inline-block ${
                      viewingListing.status === 'active'
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : viewingListing.status === 'pending'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-slate-100 dark:bg-neutral-900 dark:bg-gray-700 text-slate-700 dark:text-neutral-200 dark:text-gray-300'
                    }`}
                  >
                    {viewingListing.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">APPROVAL STATUS</p>
                  <span className={`px-2 py-1 rounded text-xs font-bold inline-block ${getApprovalStatusColor(viewingListing.approval_status || 'pending')}`}>
                    {viewingListing.approval_status === 'approved' && 'Approved'}
                    {viewingListing.approval_status === 'rejected' && 'Rejected'}
                    {viewingListing.approval_status === 'pending' && 'Pending'}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-1">VIEWS</p>
                  <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.views || 0}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-2">DESCRIPTION (EN)</p>
                <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.description_en}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-neutral-200 dark:text-neutral-300 mb-2">DESCRIPTION (SO)</p>
                <p className="text-sm text-slate-900 dark:text-white dark:text-white">{viewingListing.description_so}</p>
              </div>

              {viewingListing.approval_status === 'rejected' && viewingListing.rejection_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <p className="text-xs font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    REJECTION REASON
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300">{viewingListing.rejection_reason}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleEdit(viewingListing.id)}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => {
                    handleDelete(viewingListing.id);
                    setViewingListing(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Listing Modal */}
      {editingListing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => e.target === e.currentTarget && !savingEdit && setEditingListing(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-gray-700">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit Listing</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-300 mt-0.5">ID: #{editingListing.id}</p>
              </div>
              <button
                onClick={() => setEditingListing(null)}
                disabled={savingEdit}
                className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 text-slate-500 dark:text-neutral-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title EN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                  Title (English) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.title_en}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, title_en: e.target.value }))}
                  placeholder="Listing title in English"
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                  required
                />
              </div>

              {/* Title SO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                  Title (Somali)
                </label>
                <input
                  type="text"
                  value={editForm.title_so}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, title_so: e.target.value }))}
                  placeholder="Listing title in Somali"
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                />
              </div>

              {/* Description EN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                  Description (English)
                </label>
                <textarea
                  value={editForm.description_en}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, description_en: e.target.value }))}
                  placeholder="Detailed description in English"
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium resize-none"
                />
              </div>

              {/* Description SO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                  Description (Somali)
                </label>
                <textarea
                  value={editForm.description_so}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, description_so: e.target.value }))}
                  placeholder="Detailed description in Somali"
                  rows={4}
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium resize-none"
                />
              </div>

              {/* Price & Currency */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.price}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                    Currency
                  </label>
                  <select
                    value={editForm.currency}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, currency: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="SOS">SOS - Somali Shilling</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f: any) => ({ ...f, location: e.target.value }))}
                  placeholder="City, region e.g. Mogadishu, Somalia"
                  className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                />
              </div>

              {/* Categories Hierarchy */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.category_id}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, category_id: e.target.value, subcategory_id: '', subsubcategory_id: '' }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name_en || cat.name_so}</option>
                    ))}
                  </select>
                </div>

                {/* Subcategory */}
                {editForm.category_id && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                      Sub-Category
                    </label>
                    <select
                      value={editForm.subcategory_id}
                      onChange={(e) => setEditForm((f: any) => ({ ...f, subcategory_id: e.target.value, subsubcategory_id: '' }))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                    >
                      <option value="">Select Sub-Category</option>
                      {categories
                        .find((cat) => cat.id.toString() === editForm.category_id.toString())
                        ?.subcategories?.map((sub: any) => (
                          <option key={sub.id} value={sub.id}>{sub.name_en || sub.name_so}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Subsubcategory */}
                {editForm.subcategory_id && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                      Sub-Sub-Category
                    </label>
                    <select
                      value={editForm.subsubcategory_id}
                      onChange={(e) => setEditForm((f: any) => ({ ...f, subsubcategory_id: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                    >
                      <option value="">Select Sub-Sub-Category</option>
                      {categories
                        .find((cat) => cat.id.toString() === editForm.category_id.toString())
                        ?.subcategories?.find((sub: any) => sub.id.toString() === editForm.subcategory_id.toString())
                        ?.subsubcategories?.map((subsub: any) => (
                          <option key={subsub.id} value={subsub.id}>{subsub.name_en || subsub.name_so}</option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Brand - only once the full category path is picked */}
                {editForm.subsubcategory_id && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                      Brand
                    </label>
                    {!isCustomBrand ? (
                      <select
                        value={editForm.brand || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'Others') {
                            setIsCustomBrand(true);
                            setEditForm((f: any) => ({ ...f, brand: '' }));
                          } else {
                            setEditForm((f: any) => ({ ...f, brand: value }));
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                      >
                        <option value="">Select brand</option>
                        {getBrandOptions(editForm.category_id, editForm.subcategory_id, editForm.subsubcategory_id).map((brand: string) => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                        <option value="Others">Others - Custom</option>
                      </select>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editForm.brand || ''}
                          onChange={(e) => setEditForm((f: any) => ({ ...f, brand: e.target.value }))}
                          placeholder="Enter brand name"
                          className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomBrand(false);
                            setEditForm((f: any) => ({ ...f, brand: '' }));
                          }}
                          className="text-xs text-sky-600 dark:text-sky-400 hover:underline"
                        >
                          Back to list
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Condition & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                    Condition
                  </label>
                  <select
                    value={editForm.condition}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, condition: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-medium"
                  >
                    <option value="new">New</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-1">
                    Status
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="sold">Sold</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_negotiable}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, is_negotiable: e.target.checked }))}
                    className="w-4 h-4 text-sky-500 rounded focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">Price is negotiable</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_sold}
                    onChange={(e) => setEditForm((f: any) => ({ ...f, is_sold: e.target.checked }))}
                    className="w-4 h-4 text-sky-500 rounded focus:ring-sky-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">Mark as sold</span>
                </label>
              </div>

              {/* Images Management */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-neutral-200 uppercase mb-3">
                  Product Images
                </label>

                {/* Existing Images */}
                {editImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-neutral-300 mb-2">Current Images ({editImages.length})</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {editImages.map((img, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-gray-700">
                          {brokenImages.has(img) ? (
                            <div className="w-full h-24 bg-slate-100 dark:bg-gray-700 flex items-center justify-center">
                              <ImageOff className="w-6 h-6 text-slate-400" />
                            </div>
                          ) : (
                            <img
                              src={img}
                              alt={`Image ${idx + 1}`}
                              className="w-full h-24 object-cover"
                              onError={() => setBrokenImages((prev) => new Set([...prev, img]))}
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setEditImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Images Preview */}
                {newEditImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-slate-500 dark:text-neutral-300 mb-2">New Images to Upload ({newEditImages.length})</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {newEditImages.map((file, idx) => (
                        <div key={idx} className="relative group rounded-lg overflow-hidden border border-sky-300 dark:border-sky-700">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`New image ${idx + 1}`}
                            className="w-full h-24 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setNewEditImages((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Upload Trigger */}
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg p-5 text-center hover:border-sky-500 transition-colors">
                    <Upload className="mx-auto mb-2 text-slate-400 w-6 h-6" />
                    <p className="text-xs font-bold text-slate-700 dark:text-neutral-200">Click to add product images</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">PNG, JPG up to 5MB per image</p>
                  </div>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setNewEditImages((prev) => [...prev, ...files]);
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Seller / Owner Info Section */}
              {(editingListing.owner || editingListing.seller) && (
                <div className="bg-slate-50 dark:bg-gray-700/40 rounded-xl p-4 border border-slate-200 dark:border-gray-700">
                  <h3 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider mb-3">
                    Seller Information (Read-only)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold">Name</p>
                      <p className="font-bold text-slate-800 dark:text-neutral-100 mt-0.5">
                        {editingListing.owner?.full_name || editingListing.seller?.full_name || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold">Phone</p>
                      <p className="font-bold text-slate-800 dark:text-neutral-100 mt-0.5">
                        {editingListing.owner?.phone || editingListing.seller?.phone || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold">Email</p>
                      <p className="font-bold text-slate-800 dark:text-neutral-100 mt-0.5 truncate">
                        {editingListing.owner?.email || editingListing.seller?.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold">Verified</p>
                      <p className="font-bold text-slate-800 dark:text-neutral-100 mt-0.5">
                        {editingListing.owner?.is_verified || editingListing.seller?.is_verified ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setEditingListing(null)}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-neutral-100 rounded-lg text-xs font-bold hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex-1 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-xs font-extrabold shadow-md shadow-sky-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {savingEdit ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ListingsManagementPage;
