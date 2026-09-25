import { create } from 'zustand';

interface CartItem {
  id: string;
  title: string;
  price: number;
  image?: string;
  quantity: number;
  seller_id?: string;
  owner_id?: string | number;
  owner?: {
    full_name: string;
    phone: string;
    email?: string;
    avatar_url?: string;
  };
}

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  getTotalCount: () => number;
  getTotalPrice: () => number;
}

export const useCart = create<CartState>((set, get) => ({
  items: [],

  addItem: (item: CartItem) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: item.quantity } : i
          ),
        };
      }
      return { items: [...state.items, item] };
    });
  },

  updateQuantity: (productId: string, quantity: number) => {
    set((state) => {
      if (quantity <= 0) {
        return { items: state.items.filter((i) => i.id !== productId) };
      }
      return {
        items: state.items.map((i) =>
          i.id === productId ? { ...i, quantity } : i
        ),
      };
    });
  },

  removeItem: (productId: string) => {
    set((state) => ({
      items: state.items.filter((i) => i.id !== productId),
    }));
  },

  clearCart: () => {
    set({ items: [] });
  },

  getTotalCount: () => {
    const state = get();
    return state.items.reduce((sum, item) => sum + item.quantity, 0);
  },

  getTotalPrice: () => {
    const state = get();
    return state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },
}));
