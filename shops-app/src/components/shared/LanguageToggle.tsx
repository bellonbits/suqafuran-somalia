"use client";

import React from 'react';
import { useLanguageStore, type Language } from '../../store/useLanguage';

interface LanguageOption {
    code: Language;
    label: string;
    short: string;
    dot: string;
}

// Somali or English only -- the old bilingual "SO/EN" mode was retired.
const LANGUAGES: LanguageOption[] = [
    { code: 'so', label: 'Soomaali', short: 'SO', dot: '#4189DD' },
    { code: 'en', label: 'English', short: 'EN', dot: '#10B981' },
];

interface LanguageToggleProps {
    className?: string;
    compact?: boolean;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
    className = '',
    compact = false,
}) => {
    const { language, setLanguage } = useLanguageStore();
    const activeCode = language === 'bilingual' ? 'so' : language;

    return (
        <div
            className={`inline-flex items-center rounded-full p-1 bg-slate-100 dark:bg-neutral-900 border border-gray-200/80 dark:border-neutral-800 shrink-0 ${className}`}
            role="radiogroup"
            aria-label="Select Language"
        >
            {LANGUAGES.map((lang) => {
                const isActive = activeCode === lang.code;
                return (
                    <button
                        key={lang.code}
                        type="button"
                        onClick={() => setLanguage(lang.code)}
                        title={lang.label}
                        aria-checked={isActive}
                        role="radio"
                        className={`relative ${compact ? 'px-2 py-1 min-w-[34px] justify-center' : 'px-2.5 py-1'} rounded-full text-[11px] font-extrabold transition-all duration-200 flex items-center gap-1.5 uppercase tracking-wider cursor-pointer ${
                            isActive
                                ? 'bg-white text-gray-950 shadow-sm dark:bg-neutral-800 dark:text-white'
                                : 'text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-neutral-200'
                        }`}
                    >
                        {!compact && <span
                            className="h-2 w-2 rounded-full shrink-0 transition-transform"
                            style={{
                                background: lang.dot,
                                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                            }}
                        />}
                        <span>{lang.short}</span>
                    </button>
                );
            })}
        </div>
    );
};
