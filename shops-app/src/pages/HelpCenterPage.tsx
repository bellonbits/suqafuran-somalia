"use client";

import React, { useState } from 'react';
import { ChevronDown, MessageCircle, ShoppingBag, ShieldCheck, CreditCard, User } from 'lucide-react';

interface FaqItem {
    question: string;
    answer: string;
}

interface FaqSection {
    title: string;
    icon: React.ElementType;
    items: FaqItem[];
}

const SECTIONS: FaqSection[] = [
    {
        title: 'Buying on Suqafuran',
        icon: ShoppingBag,
        items: [
            {
                question: 'How do I contact a seller?',
                answer: "Open any listing and tap Chat or WhatsApp to message the seller directly. All communication and price negotiation happens between you and the seller — Suqafuran doesn't process the sale.",
            },
            {
                question: 'Does Suqafuran deliver items to me?',
                answer: 'No. Suqafuran is a classifieds marketplace — buyers and sellers arrange their own meetup, inspection, and payment directly. We recommend meeting in a safe, public location.',
            },
            {
                question: 'Can I negotiate the price?',
                answer: 'Yes. Prices on listings are set by sellers and are usually negotiable. Use chat to discuss the final price before you meet.',
            },
        ],
    },
    {
        title: 'Selling on Suqafuran',
        icon: User,
        items: [
            {
                question: 'How do I post a listing?',
                answer: "Tap \"Sell\" in the bottom navigation, fill in your item's details, add photos, and publish. Your listing will appear in the relevant category and in your shop.",
            },
            {
                question: 'Is there a fee to list an item?',
                answer: 'Basic listings are free. Sellers can optionally pay to feature a listing or shop for extra visibility — this is entirely optional.',
            },
            {
                question: 'How do I respond to buyers quickly?',
                answer: "Enable notifications and reply promptly in Chat — your response rate is shown on your shop page and helps build buyer trust.",
            },
        ],
    },
    {
        title: 'Payments',
        icon: CreditCard,
        items: [
            {
                question: 'Does Suqafuran handle payments between buyers and sellers?',
                answer: "No. Suqafuran does not process payments for items — buyers and sellers pay each other directly (cash, mobile money, etc.) when they meet. See our Safe Trading Tips for guidance.",
            },
            {
                question: 'What is the featured listing payment for?',
                answer: 'Sellers can optionally pay via M-Pesa to promote a listing, shop, or banner placement for better visibility. This is unrelated to the price of items being sold.',
            },
        ],
    },
    {
        title: 'Trust & Safety',
        icon: ShieldCheck,
        items: [
            {
                question: 'How do I report a suspicious listing or user?',
                answer: 'Use the report option on the listing or shop page, or contact us through Chat. Our team reviews reports and takes action on accounts that violate our Terms of Use.',
            },
            {
                question: 'What does the "Verified Seller" badge mean?',
                answer: "Verified sellers have completed our identity verification process, which adds an extra layer of trust when browsing shops.",
            },
        ],
    },
];

export default function HelpCenterPage() {
    const [openKey, setOpenKey] = useState<string | null>(null);

    const toggle = (key: string) => {
        setOpenKey((current) => (current === key ? null : key));
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-neutral-50">Help Center</h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-neutral-300">
                        Answers to common questions about buying, selling, and staying safe on Suqafuran.
                    </p>
                </div>

                <div className="space-y-8">
                    {SECTIONS.map((section) => {
                        const Icon = section.icon;
                        return (
                            <div key={section.title}>
                                <div className="flex items-center gap-2 mb-3">
                                    <Icon className="h-4 w-4 text-primary dark:text-sky-400" />
                                    <h2 className="text-sm font-black text-gray-900 dark:text-neutral-50 uppercase tracking-wide">
                                        {section.title}
                                    </h2>
                                </div>
                                <div className="space-y-2">
                                    {section.items.map((item) => {
                                        const key = `${section.title}-${item.question}`;
                                        const isOpen = openKey === key;
                                        return (
                                            <div
                                                key={key}
                                                className="rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => toggle(key)}
                                                    className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
                                                >
                                                    <span className="text-sm font-bold text-gray-800 dark:text-neutral-100">
                                                        {item.question}
                                                    </span>
                                                    <ChevronDown
                                                        className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {isOpen && (
                                                    <div className="px-4 pb-4 text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                                                        {item.answer}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-12 rounded-2xl bg-slate-50 dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 text-center">
                    <MessageCircle className="h-5 w-5 text-primary dark:text-sky-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-gray-800 dark:text-neutral-100">Still need help?</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-neutral-300">
                        Message any shop directly through Chat, or reach out to our support team from your account settings.
                    </p>
                </div>
            </div>
        </div>
    );
}
