"use client";

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, Download, AlertCircle, CheckCircle2, X, Loader,
  FileSpreadsheet, ChevronRight, Info, AlertTriangle
} from 'lucide-react';
import api from '@/services/api';
import { PlanGate } from '@/components/seller/PlanGate';

interface ParsedRow {
  name: string;
  price: string;
  stock: string;
  category: string;
  description: string;
  images: string;
  _valid: boolean;
  _errors: string[];
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
}

const SAMPLE_CSV = `Name,Price,Stock,Category,Description,Images
Wireless Earbuds Pro,2500,50,Electronics,High-quality wireless earbuds with noise cancellation,https://example.com/img1.jpg
Leather Handbag,3800,20,Fashion,Premium genuine leather handbag in brown,https://example.com/img2.jpg
Organic Face Cream,1200,100,Health & Beauty,Natural organic face cream suitable for all skin types,
`;

const COLUMN_DESCRIPTIONS = [
  { col: 'Name', required: true, example: 'Wireless Earbuds Pro' },
  { col: 'Price', required: true, example: '2500 (KSh, no commas)' },
  { col: 'Stock', required: false, example: '50' },
  { col: 'Category', required: false, example: 'Electronics' },
  { col: 'Description', required: false, example: 'Product description...' },
  { col: 'Images', required: false, example: 'https://... (URL)' },
];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || '';
    });
    const errors: string[] = [];
    if (!row['name']) errors.push('Name is required');
    if (!row['price']) errors.push('Price is required');
    if (row['price'] && isNaN(Number(row['price']))) errors.push('Price must be a number');
    if (row['stock'] && isNaN(Number(row['stock']))) errors.push('Stock must be a number');
    return {
      name: row['name'] || '',
      price: row['price'] || '',
      stock: row['stock'] || '',
      category: row['category'] || '',
      description: row['description'] || '',
      images: row['images'] || '',
      _valid: errors.length === 0,
      _errors: errors,
    };
  });
}

function BulkImportContent() {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
    };
    reader.readAsText(f);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx'))) handleFile(f);
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'suqafuran_product_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file || rows.length === 0) return;
    setImporting(true);
    setProgress(0);

    const validRows = rows.filter((r) => r._valid);
    let success = 0;
    const errors: { row: number; message: string }[] = [];

    // Send to backend (batch)
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/listings/bulk-import', formData).catch(async () => {
        // Fallback: create one-by-one if bulk endpoint not available
        for (let i = 0; i < validRows.length; i++) {
          const row = validRows[i];
          try {
            await api.post('/listings/me', {
              title_en: row.name,
              price: Number(row.price),
              quantity: row.stock ? Number(row.stock) : undefined,
              description_en: row.description,
            });
            success++;
          } catch (err: any) {
            errors.push({ row: i + 2, message: err?.response?.data?.detail || 'Failed' });
          }
          setProgress(Math.round(((i + 1) / validRows.length) * 100));
        }
        return null;
      });

      if (res?.data) {
        success = res.data.success || validRows.length;
        setProgress(100);
      }
    } catch (err) {
      console.error('Bulk import error:', err);
    }

    setResult({ success, failed: errors.length + rows.filter((r) => !r._valid).length, errors });
    setImporting(false);
    setProgress(100);
  };

  const validCount = rows.filter((r) => r._valid).length;
  const invalidCount = rows.filter((r) => !r._valid).length;

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white">Bulk Import</h1>
          <p className="text-gray-500 dark:text-neutral-300 text-sm mt-1">
            Upload hundreds of products at once with a CSV file
          </p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
        >
          <Download className="w-4 h-4" />
          Download Template
        </button>
      </div>

      {/* Column guide */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300">CSV Column Format</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COLUMN_DESCRIPTIONS.map((c) => (
            <div key={c.col} className="text-xs">
              <span className="font-mono font-bold text-blue-800 dark:text-blue-300">{c.col}</span>
              {c.required && <span className="text-red-500 ml-1">*</span>}
              <p className="text-blue-600 dark:text-blue-400 mt-0.5">{c.example}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
              : 'border-gray-300 dark:border-neutral-800 hover:border-orange-400 dark:hover:border-orange-600'
          }`}
        >
          <FileSpreadsheet className="w-12 h-12 text-gray-300 dark:text-neutral-300 mx-auto mb-4" />
          <p className="text-base font-bold text-gray-700 dark:text-neutral-200">Drop your CSV file here</p>
          <p className="text-sm text-gray-400 dark:text-neutral-400 mt-1">or click to browse files</p>
          <p className="text-xs text-gray-400 dark:text-neutral-400 mt-3">.csv or .xlsx · up to 5 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={onFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* File info + change */}
      {file && (
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-500 dark:text-neutral-300">
                {rows.length} rows · {validCount} valid · {invalidCount} with errors
              </p>
            </div>
          </div>
          <button
            onClick={() => { setFile(null); setRows([]); setResult(null); setProgress(0); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && !result && (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 overflow-hidden">
          <div className="p-5 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="font-black text-gray-900 dark:text-white">Preview</h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" /> {validCount} ready
              </span>
              {invalidCount > 0 && (
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> {invalidCount} errors
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-neutral-900">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">#</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">Price</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">Stock</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">Category</th>
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 dark:text-neutral-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((row, idx) => (
                  <tr key={idx} className={`border-t border-gray-100 dark:border-neutral-800 ${!row._valid ? 'bg-red-50 dark:bg-red-900/5' : ''}`}>
                    <td className="py-3 px-4 text-gray-500 dark:text-neutral-400">{idx + 2}</td>
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white max-w-[200px] truncate">{row.name}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-neutral-200">
                      {row.price ? `KSh ${Number(row.price).toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-neutral-200">{row.stock || '—'}</td>
                    <td className="py-3 px-4 text-gray-700 dark:text-neutral-200 max-w-[120px] truncate">{row.category || '—'}</td>
                    <td className="py-3 px-4">
                      {row._valid ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs font-semibold" title={row._errors.join(', ')}>
                          <AlertCircle className="w-3.5 h-3.5" /> {row._errors[0]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="text-xs text-gray-400 dark:text-neutral-400 p-4 border-t border-gray-100 dark:border-neutral-800">
                Showing first 20 of {rows.length} rows
              </p>
            )}
          </div>

          {/* Import button */}
          <div className="p-5 border-t border-gray-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center gap-4">
            {invalidCount > 0 && (
              <div className="flex items-center gap-2 text-amber-600 text-sm flex-1">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {invalidCount} rows with errors will be skipped. {validCount} will be imported.
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm ml-auto"
            >
              {importing ? <Loader className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Import {validCount} Products
            </button>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {importing && (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Importing products...</p>
            <p className="text-sm text-gray-500">{progress}%</p>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white dark:bg-neutral-950 rounded-xl border border-gray-200 dark:border-neutral-800 p-6 space-y-4">
          <h2 className="font-black text-gray-900 dark:text-white">Import Complete</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <p className="text-2xl font-black text-green-700 dark:text-green-400">{result.success}</p>
                <p className="text-xs text-green-600 dark:text-green-500">Successfully imported</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div>
                <p className="text-2xl font-black text-red-700 dark:text-red-400">{result.failed}</p>
                <p className="text-xs text-red-600 dark:text-red-500">Failed or skipped</p>
              </div>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-500">Row {e.row}: {e.message}</p>
              ))}
            </div>
          )}
          <button
            onClick={() => { setFile(null); setRows([]); setResult(null); setProgress(0); }}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-neutral-800 rounded-xl text-sm font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}

export default function BulkImportPage() {
  return (
    <PlanGate
      requiredPlan="business"
      featureName="Bulk Import"
      featureDescription="Upload hundreds of products at once using a CSV or Excel file. Perfect for large inventories and wholesalers."
    >
      <BulkImportContent />
    </PlanGate>
  );
}
