"use client";

import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Search, Filter, SlidersHorizontal, Calendar, ChevronRight,
  MoreHorizontal, Loader2, Package, Tag, AlertTriangle, CheckCircle2,
  Edit2, Trash2, Copy, FileUp, Zap, Clock, Box
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';

export default function ProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All Status');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxProducts, setMaxProducts] = useState<number | null>(200);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/listings/me?limit=100').catch(() => null);
      if (res?.data) {
        const items = Array.isArray(res.data) ? res.data : res.data.listings || res.data.items || [];
        setProducts(items);
      }
    } catch (err) {
      console.error('Error loading seller products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/listings/${id}`).catch(() => null);
      loadProducts();
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  const filteredProducts = products.filter(p => {
    const title = p.title_en || p.title || '';
    const matchesSearch = title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (p.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' ||
                          (statusFilter === 'Published' && p.status === 'active') ||
                          (statusFilter === 'Pending' && p.status === 'pending');
    return matchesSearch && matchesStatus;
  });

  const totalProducts = products.length;
  const activeProducts = products.filter(p => p.status === 'active').length;
  const pendingProducts = products.filter(p => p.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <p className="text-sm font-semibold text-slate-400">Loading Products List…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* ── Page Title & Action CTAs (Bright Sky Blue) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Products List
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Here you can find all of your products and stock management
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/seller-dashboard/products/bulk-import"
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-neutral-950 border border-slate-200/80 dark:border-neutral-800 text-slate-700 dark:text-neutral-100 rounded-2xl text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
          >
            <FileUp className="w-4 h-4 text-sky-500" />
            <span>Bulk Import</span>
          </Link>

          <Link
            to="/seller-dashboard/products/add"
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-sky-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* ── Products Stat Summary Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Products</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalProducts.toLocaleString()}
            </h2>
            <span className="text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">All store listings</p>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Published Active</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {activeProducts.toLocaleString()}
            </h2>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Visible to customers</p>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Review</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {pendingProducts.toLocaleString()}
            </h2>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
              Pending
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Awaiting moderation</p>
        </div>

        <div className="bg-white dark:bg-neutral-950 rounded-3xl p-5 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Product Limit</p>
          <div className="flex items-baseline justify-between mt-2">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {totalProducts} / {maxProducts ?? '∞'}
            </h2>
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full">
              PRO Plan
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">Subscription allowance</p>
        </div>
      </div>

      {/* ── Filter Toolbar ── */}
      <div className="bg-white dark:bg-neutral-950 rounded-3xl p-4 border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products by title, SKU or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 rounded-2xl pl-10 pr-12 py-2.5 text-xs md:text-sm text-slate-800 dark:text-neutral-50 placeholder-slate-400 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/60 dark:border-neutral-800/50 text-slate-700 dark:text-neutral-100 text-xs font-bold rounded-2xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
          >
            <option value="All Status">All Status</option>
            <option value="Published">Published</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      </div>

      {/* ── Products Data Table ── */}
      <div className="bg-white dark:bg-neutral-950 rounded-3xl border border-slate-100 dark:border-neutral-800 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden">
        
        {filteredProducts.length > 0 ? (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/60 dark:bg-neutral-900/40 border-b border-slate-100 dark:border-neutral-800 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-5">Product Info</th>
                    <th className="py-3.5 px-5">SKU / Code</th>
                    <th className="py-3.5 px-5">Price (USD)</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/40">
                  {filteredProducts.map((p) => {
                    const title = p.title_en || p.title || 'Untitled Product';
                    const image = p.images?.[0] || p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80';
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-neutral-900/30 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <img src={image} alt={title} className="w-10 h-10 rounded-xl object-cover border border-slate-100 dark:border-neutral-800 flex-shrink-0" />
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white leading-tight">{title}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{p.location || 'Mogadishu, Somalia'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5 font-mono font-extrabold text-slate-700 dark:text-neutral-200">
                          SKU-{p.id?.toString().padStart(6, '0')}
                        </td>

                        <td className="py-4 px-5 font-black text-slate-900 dark:text-white">
                          ${(p.price || 0).toLocaleString()}
                        </td>

                        <td className="py-4 px-5">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                            p.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {p.status === 'active' ? 'Published' : 'Pending'}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/seller-dashboard/products/edit/${p.id}`)}
                              className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-900 text-slate-600 dark:text-neutral-200 hover:bg-slate-100 transition-colors"
                              title="Edit Product"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-500 hover:bg-rose-100 transition-colors"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View (< 768px) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-neutral-800">
              {filteredProducts.map((p) => {
                const title = p.title_en || p.title || 'Untitled Product';
                const image = p.images?.[0] || p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80';
                return (
                  <div key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <img src={image} alt={title} className="w-12 h-12 rounded-xl object-cover border border-slate-100 dark:border-neutral-800 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{title}</p>
                        <p className="text-[10px] text-slate-400">SKU-{p.id?.toString().padStart(6, '0')}</p>
                        <p className="text-sm font-black text-slate-900 dark:text-white mt-1">${(p.price || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-neutral-800">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        • {p.status === 'active' ? 'Published' : 'Pending'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/seller-dashboard/products/edit/${p.id}`)}
                          className="px-3 py-1.5 bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-100 rounded-xl text-xs font-bold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <Box className="w-12 h-12 text-slate-200 dark:text-neutral-200" />
            <p className="text-base font-extrabold text-slate-700 dark:text-neutral-100">No Products Found</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Click "+ Add Product" to publish your first listing on Suqafuran Marketplace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
