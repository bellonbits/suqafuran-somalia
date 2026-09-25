import { create } from 'zustand';

export interface Shop {
  id: number;
  business_name: string;
  full_name: string;
  email: string;
  phone: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ShopManagementStore {
  // Shops list
  shops: Shop[];
  totalShops: number;
  isLoading: boolean;
  error: string | null;

  // Pagination
  currentPage: number;
  pageSize: number;

  // Search
  searchQuery: string;

  // Edit state
  editingShop: Shop | null;
  isSaving: boolean;
  saveSuccess: string | null;
  saveError: string | null;

  // Actions
  setShops: (shops: Shop[], total: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setEditingShop: (shop: Shop | null) => void;
  setSaving: (saving: boolean) => void;
  setSaveSuccess: (message: string | null) => void;
  setSaveError: (error: string | null) => void;
  updateShopName: (shopId: number, newName: string) => void;
  reset: () => void;
}

export const useShopManagementStore = create<ShopManagementStore>((set) => ({
  shops: [],
  totalShops: 0,
  isLoading: false,
  error: null,
  currentPage: 1,
  pageSize: 25,
  searchQuery: '',
  editingShop: null,
  isSaving: false,
  saveSuccess: null,
  saveError: null,

  setShops: (shops, total) =>
    set({
      shops,
      totalShops: total,
      isLoading: false,
      error: null,
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) =>
    set({
      error,
      isLoading: false,
    }),

  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setPageSize: (size) => set({ pageSize: size, currentPage: 1 }),

  setEditingShop: (shop) =>
    set({
      editingShop: shop,
      saveSuccess: null,
      saveError: null,
    }),

  setSaving: (saving) => set({ isSaving: saving }),

  setSaveSuccess: (message) =>
    set({
      saveSuccess: message,
      isSaving: false,
      saveError: null,
    }),

  setSaveError: (error) =>
    set({
      saveError: error,
      isSaving: false,
    }),

  updateShopName: (shopId, newName) =>
    set((state) => ({
      shops: state.shops.map((shop) =>
        shop.id === shopId ? { ...shop, business_name: newName } : shop
      ),
      editingShop: state.editingShop?.id === shopId
        ? { ...state.editingShop, business_name: newName }
        : state.editingShop,
    })),

  reset: () =>
    set({
      shops: [],
      totalShops: 0,
      isLoading: false,
      error: null,
      currentPage: 1,
      searchQuery: '',
      editingShop: null,
      isSaving: false,
      saveSuccess: null,
      saveError: null,
    }),
}));
