"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrencyStore, type Currency } from '../../store/useCurrency';
import { CURRENCY_INFO } from '../../lib/currency';

const CURRENCIES: Currency[] = ['USD', 'SOS', 'KES', 'UGX', 'TZS', 'ETB', 'RWF'];

export const CurrencyToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
    const { currency, setCurrency, setAutoDetected } = useCurrencyStore();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    return (
        <div ref={ref} className={`relative shrink-0 ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-neutral-900 px-2.5 py-1 text-[10px] font-black text-gray-700 dark:text-neutral-100 cursor-pointer"
            >
                {CURRENCY_INFO[currency].symbol} {currency}
                <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 shadow-xl z-50 py-1.5 max-h-72 overflow-y-auto">
                    {CURRENCIES.map((code) => (
                        <button
                            key={code}
                            onClick={() => {
                                setCurrency(code);
                                setAutoDetected(true);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold cursor-pointer ${
                                currency === code
                                    ? 'text-primary dark:text-sky-400 bg-slate-50 dark:bg-neutral-900'
                                    : 'text-gray-600 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-900'
                            }`}
                        >
                            <span>{code}</span>
                            <span className="text-gray-400">{CURRENCY_INFO[code].symbol}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
