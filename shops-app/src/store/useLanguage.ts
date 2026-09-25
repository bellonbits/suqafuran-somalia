import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Language = 'so' | 'en' | 'bilingual';

interface LanguageState {
    language: Language;
    setLanguage: (language: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'so',
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'suqafuran-language-v2',
            // Bilingual mode was retired -- anyone who had it lands on Somali.
            merge: (persisted, current) => {
                const saved = (persisted as Partial<LanguageState> | undefined)?.language;
                return { ...current, language: saved === 'en' ? 'en' : 'so' };
            },
            storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            })),
        }
    )
);
