"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, Wand2, Check, X, Undo2, FileText, Tag, Loader } from 'lucide-react';
import api from '@/services/api';
import { listingsService } from '@/services/listings';
import Papa from 'papaparse';

interface Product {
  id: string;
  sku: string;
  current_title: string;
  suggested_title: string;
  custom_title: string;
  category: string;
  brand: string;
  changed: boolean;
}

interface Category {
  id: number;
  name_en: string;
  slug: string;
}

interface CategoryEditResult {
  updated_listings: number;
  field_changes: number;
  errors: { row: number; message: string }[];
}

function CategoryBulkEditPanel() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<CategoryEditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listingsService.getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const handleExport = async () => {
    if (!categoryId) return;
    setExporting(true);
    setError(null);
    try {
      const response = await api.get('/listings/bulk-export-by-category', {
        params: { category_id: categoryId },
        responseType: 'blob',
      });
      const category = categories.find((c) => String(c.id) === categoryId);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${category?.slug || categoryId}-bulk-edit.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export category listings:', err);
      setError('Failed to export this category. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/listings/bulk-edit-by-category', formData);
      setResult(response.data);
    } catch (err) {
      console.error('Failed to import edited CSV:', err);
      setError('Failed to apply the edited CSV. Check the file and try again.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="mt-6 space-y-6">
      <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
        <label className="block text-sm font-semibold text-white mb-3">
          <Tag className="w-4 h-4 inline mr-2" />
          1. Pick a category, export its listings
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
          >
            <option value="">Select a category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name_en}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            disabled={!categoryId || exporting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 text-white rounded font-semibold transition shrink-0"
          >
            {exporting ? <Loader className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export CSV
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Columns: id, title, price, description, stock. Edit any of these in a spreadsheet -- id, category and status are for reference and won't be changed on import.
        </p>
      </div>

      <div className="bg-slate-800 rounded-lg p-5 border border-slate-700">
        <label className="block text-sm font-semibold text-white mb-3">
          <Upload className="w-4 h-4 inline mr-2" />
          2. Re-upload the edited CSV to apply changes
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleImport}
          disabled={importing}
          className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700 disabled:opacity-50"
        />
        {importing && (
          <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
            <Loader className="w-3.5 h-3.5 animate-spin" /> Applying changes...
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-slate-800 rounded-lg p-5 border border-slate-700 space-y-3">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-2xl font-black text-green-400">{result.updated_listings}</p>
              <p className="text-xs text-slate-400">Listings updated</p>
            </div>
            <div>
              <p className="text-2xl font-black text-orange-400">{result.field_changes}</p>
              <p className="text-xs text-slate-400">Fields changed</p>
            </div>
            {result.errors.length > 0 && (
              <div>
                <p className="text-2xl font-black text-red-400">{result.errors.length}</p>
                <p className="text-xs text-slate-400">Rows skipped</p>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto pt-2 border-t border-slate-700">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-400">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BulkProductsPage() {
  const [mode, setMode] = useState<'titles' | 'category-edit'>('titles');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [history, setHistory] = useState<Product[][]>([]);
  const [template, setTemplate] = useState('{brand} {category} - {feature}, {color}');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse CSV file
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const parsed = results.data.filter(row => row.id && row.current_title).map((row: any) => ({
          id: row.id,
          sku: row.sku || '',
          current_title: row.current_title,
          suggested_title: '',
          custom_title: row.current_title,
          category: row.category || '',
          brand: row.brand || '',
          changed: false,
        }));

        setHistory([products]);
        setProducts(parsed);
        generateSuggestions(parsed);
      },
      error: (err) => alert(`CSV Error: ${err.message}`),
    });
  };

  // Generate AI suggestions
  const generateSuggestions = async (prods: Product[] = products) => {
    if (prods.length === 0) return;

    setLoading(true);
    try {
      const response = await api.post('/listings/suggest-titles', {
        products: prods.map(p => ({
          id: p.id,
          current_title: p.current_title,
          category: p.category,
          brand: p.brand,
        })),
        template,
      });

      const suggestions = response.data.suggestions || {};
      const updated = prods.map(p => ({
        ...p,
        suggested_title: suggestions[p.id] || p.current_title,
      }));

      setProducts(updated);
    } catch (err) {
      console.error('Failed to generate suggestions:', err);
      alert('Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Apply suggestions
  const applySuggestions = () => {
    setHistory([...history, products]);
    setProducts(products.map(p => ({
      ...p,
      custom_title: p.suggested_title,
      changed: p.suggested_title !== p.current_title,
    })));
  };

  // Update custom title
  const updateTitle = (id: string, title: string) => {
    setProducts(products.map(p =>
      p.id === id ? { ...p, custom_title: title, changed: title !== p.current_title } : p
    ));
  };

  // Apply all changes to database
  const applyChanges = async () => {
    const changes = products.filter(p => p.changed).map(p => ({
      id: p.id,
      new_title: p.custom_title,
    }));

    if (changes.length === 0) {
      alert('No changes to apply');
      return;
    }

    setApplying(true);
    try {
      const response = await api.post('/listings/bulk-update', { updates: changes });
      alert(`✅ Updated ${response.data.updated_count} products`);
      setProducts([]);
      setHistory([]);
    } catch (err) {
      console.error('Failed to apply changes:', err);
      alert('Failed to apply changes');
    } finally {
      setApplying(false);
    }
  };

  // Undo
  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setProducts(prev);
    setHistory(history.slice(0, -1));
  };

  // Export CSV
  const exportCSV = () => {
    const csv = Papa.unparse(products.map(p => ({
      id: p.id,
      sku: p.sku,
      current_title: p.current_title,
      suggested_title: p.suggested_title,
      new_title: p.custom_title,
      changed: p.changed ? 'Yes' : 'No',
    })));

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-bulk-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const changedCount = products.filter(p => p.changed).length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white mb-2">Bulk Product Manager</h1>
          <p className="text-slate-400">
            {mode === 'titles' ? 'Rename products in bulk with AI suggestions' : 'Export a category, edit price/title/description/stock in a spreadsheet, re-import'}
          </p>
        </motion.div>

        {/* Mode Tabs */}
        <div className="mt-6 flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setMode('titles')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              mode === 'titles' ? 'border-orange-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Rename Titles (AI)
          </button>
          <button
            onClick={() => setMode('category-edit')}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              mode === 'category-edit' ? 'border-orange-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Bulk Edit by Category
          </button>
        </div>

        {mode === 'category-edit' && <CategoryBulkEditPanel />}

        {mode === 'titles' && (
        <>
        {/* Controls */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload & Template */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <label className="block text-sm font-semibold text-white mb-3">
              <Upload className="w-4 h-4 inline mr-2" />
              Upload CSV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleCSVUpload}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-orange-600 file:text-white hover:file:bg-orange-700"
            />
            <p className="text-xs text-slate-500 mt-2">Columns: id, sku, current_title, category, brand</p>
          </div>

          {/* Template */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <label className="block text-sm font-semibold text-white mb-3">
              <FileText className="w-4 h-4 inline mr-2" />
              Title Template
            </label>
            <input
              type="text"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="{brand} {category} - {feature}, {color}"
              className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm placeholder-slate-500"
            />
            <p className="text-xs text-slate-500 mt-2">Use: {'{brand'}, {'{category'}, {'{color'}, {'{feature'}</p>
          </div>
        </motion.div>

        {/* Action Buttons */}
        {products.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-4 flex gap-2 flex-wrap">
            <button
              onClick={() => generateSuggestions()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded font-semibold transition"
            >
              <Wand2 className="w-4 h-4" />
              {loading ? 'Generating...' : 'Generate AI Suggestions'}
            </button>

            <button
              onClick={applySuggestions}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition"
            >
              <Check className="w-4 h-4" />
              Apply All Suggestions
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>

            {history.length > 0 && (
              <button
                onClick={undo}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-semibold transition"
              >
                <Undo2 className="w-4 h-4" />
                Undo
              </button>
            )}

            <button
              onClick={applyChanges}
              disabled={changedCount === 0 || applying}
              className="flex items-center gap-2 px-6 py-2 bg-[#02CCFE] hover:bg-[#02CCFE] disabled:bg-slate-600 text-white rounded font-semibold transition ml-auto"
            >
              {applying ? 'Applying...' : `Apply Changes (${changedCount})`}
            </button>
          </motion.div>
        )}

        {/* Products Table */}
        {products.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-300">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">SKU</th>
                    <th className="px-4 py-3 text-left font-semibold">Current Title</th>
                    <th className="px-4 py-3 text-left font-semibold">Suggested</th>
                    <th className="px-4 py-3 text-left font-semibold">New Title</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {products.slice(0, 50).map((product) => (
                    <tr key={product.id} className={product.changed ? 'bg-orange-900/20' : ''}>
                      <td className="px-4 py-3 text-xs font-mono text-slate-400">{product.sku}</td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate">{product.current_title}</td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-purple-300">{product.suggested_title}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={product.custom_title}
                          onChange={(e) => updateTitle(product.id, e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {product.changed ? (
                          <Check className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <X className="w-4 h-4 text-slate-500 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {products.length > 50 && (
              <div className="px-4 py-3 bg-slate-700/50 text-center text-sm text-slate-400">
                Showing 50 of {products.length} products
              </div>
            )}
          </motion.div>
        )}

        {/* Empty State */}
        {products.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-12 text-center">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4 opacity-50" />
            <p className="text-slate-400">Upload a CSV file to get started</p>
            <p className="text-slate-500 text-sm mt-2">Required columns: id, current_title, category, brand</p>
          </motion.div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
