"use client";

import React from 'react';
import { MapPin, Eye, Banknote, MessageSquareWarning, ShieldAlert, UserCheck } from 'lucide-react';

const TIPS = [
    {
        icon: MapPin,
        title: 'Meet in a safe, public place',
        body: "Arrange to meet the seller or buyer somewhere public and well-lit — a mall, market, or busy street. Avoid isolated locations, and consider bringing a friend along for high-value items.",
    },
    {
        icon: Eye,
        title: 'Inspect the item before you pay',
        body: 'Check that the item matches the listing photos and description, and that it works as expected, before handing over any money. Never pay for something you have not seen in person.',
    },
    {
        icon: Banknote,
        title: 'Never pay or send money in advance',
        body: "Suqafuran does not process payments between buyers and sellers — you pay each other directly when you meet. Be very cautious of anyone asking for a deposit, delivery fee, or full payment before you've seen the item.",
    },
    {
        icon: UserCheck,
        title: 'Prefer verified sellers',
        body: 'Look for the "Verified Seller" badge and check a shop\'s response rate and reviews before committing to a purchase.',
    },
    {
        icon: MessageSquareWarning,
        title: 'Keep communication on Suqafuran',
        body: "Use the in-app Chat or WhatsApp button on the listing to talk to sellers. This keeps a record of your conversation, which is helpful if you ever need to report an issue.",
    },
    {
        icon: ShieldAlert,
        title: 'Report anything suspicious',
        body: 'If a listing looks like a scam, or someone pressures you to pay upfront or move off-platform immediately, report it from the listing or shop page so we can review the account.',
    },
];

export default function SafeTradingTipsPage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-neutral-50">Safe Trading Tips</h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-neutral-300">
                        Suqafuran connects buyers and sellers directly — here's how to trade safely and confidently.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {TIPS.map((tip) => {
                        const Icon = tip.icon;
                        return (
                            <div
                                key={tip.title}
                                className="rounded-2xl border border-gray-200 dark:border-neutral-800 p-5"
                            >
                                <div className="h-9 w-9 rounded-xl bg-primary/10 dark:bg-sky-400/10 flex items-center justify-center mb-3">
                                    <Icon className="h-4.5 w-4.5 text-primary dark:text-sky-400" />
                                </div>
                                <h2 className="text-sm font-black text-gray-900 dark:text-neutral-50 mb-1.5">
                                    {tip.title}
                                </h2>
                                <p className="text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                                    {tip.body}
                                </p>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-10 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 p-6">
                    <p className="text-sm font-black text-red-600 dark:text-red-400">
                        Remember: Suqafuran is a classifieds platform.
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-red-600/90 dark:text-red-400/80">
                        We do not deliver items, hold funds in escrow, or guarantee any transaction between buyers and sellers.
                        Every trade happens directly between you and the other party — trade carefully and use your judgment.
                    </p>
                </div>
            </div>
        </div>
    );
}
