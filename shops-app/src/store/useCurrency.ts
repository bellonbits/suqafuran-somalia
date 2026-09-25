import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Currency = 'USD' | 'KES' | 'UGX' | 'TZS' | 'ETB' | 'RWF' | 'SOS';

interface CurrencyState {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    autoDetected: boolean;
    setAutoDetected: (v: boolean) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
    persist(
        (set) => ({
            currency: 'USD',
            setCurrency: (currency) => set({ currency }),
            autoDetected: false,
            setAutoDetected: (autoDetected) => set({ autoDetected }),
        }),
        {
            name: 'suqafuran-currency',
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            })),
        }
    )
);
