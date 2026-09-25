"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Loader, Check, X, Edit2 } from 'lucide-react';
import api from '@/services/api';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<number | ''>('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      const res = await api.get('/listings/me?limit=100').catch(() => null);

      if (res?.data) {
        const products = Array.isArray(res.data) ? res.data : [];
        setInventory(products);
        updateStats(products);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (products: any[]) => {
    const totalItems = products.reduce((sum: number, p: any) => sum + (p.quantity || p.stock || 0), 0);
    const lowStockCount = products.filter((p: any) => (p.quantity || p.stock || 0) > 0 && (p.quantity || p.stock || 0) <= 20).length;
    const outOfStockCount = products.filter((p: any) => (p.quantity || p.stock || 0) === 0).length;
    const inventoryValue = products.reduce((sum: number, p: any) => sum + ((p.price || 0) * (p.quantity || p.stock || 0)), 0);

    setStats({
      total_items: totalItems,
      low_stock: lowStockCount,
      out_of_stock: outOfStockCount,
      inventory_value: inventoryValue,
    });
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditingStock(item.quantity || item.stock || 0);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingStock('');
  };

  const handleSaveStock = async (itemId: string, currentStock: number) => {
    if (editingStock === '' || editingStock === currentStock) {
      handleCancelEdit();
      return;
    }

    setUpdating(itemId);
    try {
      await api.put(`/listings/${itemId}`, {
        quantity: parseInt(editingStock.toString()),
      });

      setInventory((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, quantity: parseInt(editingStock.toString()), stock: parseInt(editingStock.toString()) } : item
        )
      );
      updateStats(inventory.map((item) =>
        item.id === itemId ? { ...item, quantity: parseInt(editingStock.toString()), stock: parseInt(editingStock.toString()) } : item
      ));
      handleCancelEdit();
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-8 h-8 animate-spin text-orange-600" />
          <p className="text-gray-500 text-sm">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Inventory</h1>
          <p className="text-gray-600 dark:text-neutral-300">Track and manage product stock levels</p>
        </div>
        <button
          onClick={loadInventoryData}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total_items || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Low Stock</p>
          <p className="text-2xl font-bold text-yellow-600">{stats?.low_stock || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Out of Stock</p>
          <p className="text-2xl font-bold text-red-600">{stats?.out_of_stock || 0}</p>
        </div>
        <div className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-200 dark:border-neutral-800">
          <p className="text-gray-600 dark:text-neutral-300 text-sm mb-2">Inventory Value</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">KSh {((stats?.inventory_value || 0) / 1000000).toFixed(1)}M</p>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-950 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900">
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Product</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Price</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Stock</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Inventory Value</th>
                <th className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-center font-semibold text-gray-900 dark:text-white">Action</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400">No products in inventory</td>
                </tr>
              ) : (
                inventory.map((item) => {
                  const stock = item.quantity || item.stock || 0;
                  const itemValue = (item.price || 0) * stock;
                  const isLowStock = stock > 0 && stock <= 20;
                  const isOutOfStock = stock === 0;

                  return (
                    <tr key={item.id} className="border-b border-gray-200 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-900/50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{item.title_en || item.title || 'Untitled Product'}</p>
                          <p className="text-xs text-gray-500">{item.id}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">KSh {(item.price || 0).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {editingId === item.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="0"
                              value={editingStock}
                              onChange={(e) => setEditingStock(e.target.value === '' ? '' : parseInt(e.target.value))}
                              className="w-20 px-2 py-1 border border-gray-200 dark:border-neutral-800 rounded bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                            />
                            <button
                              onClick={() => handleSaveStock(item.id, stock)}
                              disabled={updating === item.id}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-50"
                            >
                              {updating === item.id ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                            isOutOfStock
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                              : isLowStock
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                          }`}>
                            {stock}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">KSh {itemValue.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        {(isLowStock || isOutOfStock) && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-xs text-red-600 font-semibold">{isOutOfStock ? 'Out of Stock' : 'Low Stock'}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {editingId !== item.id && (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded inline-block"
                            title="Edit stock"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
