"use client";

import React from 'react';

const SECTIONS: { title: string; body: React.ReactNode }[] = [
    {
        title: '1. About Suqafuran',
        body: (
            <>
                Suqafuran is an online classifieds marketplace that allows sellers to list items and services, and
                buyers to browse and contact sellers directly. Suqafuran is not a party to any transaction between
                buyers and sellers — we do not sell, own, deliver, or take possession of any item listed on the
                platform, and we do not process payments between users.
            </>
        ),
    },
    {
        title: '2. Your Account',
        body: (
            <>
                You must provide accurate information when creating an account and are responsible for keeping your
                login credentials secure. You're responsible for all activity that happens under your account.
                Accounts found to be used for fraud, harassment, or repeated policy violations may be suspended or
                terminated without notice.
            </>
        ),
    },
    {
        title: '3. Listings',
        body: (
            <>
                Sellers are solely responsible for the accuracy of their listings, including price, condition,
                and description of items or services offered. Listings must not include prohibited, illegal,
                counterfeit, or stolen goods. Suqafuran may remove any listing, at any time, that violates these
                Terms or applicable law, without prior notice.
            </>
        ),
    },
    {
        title: '4. Transactions Between Users',
        body: (
            <>
                All negotiation, payment, and exchange of goods happens directly between the buyer and seller.
                Suqafuran does not guarantee the quality, safety, or legality of items listed, the accuracy of
                listings, or the ability of buyers or sellers to complete a transaction. Please review our{' '}
                <a href="/safe-trading-tips" className="text-primary dark:text-sky-400 font-semibold hover:underline">
                    Safe Trading Tips
                </a>{' '}
                before meeting anyone to trade.
            </>
        ),
    },
    {
        title: '5. Fees',
        body: (
            <>
                Creating an account and posting standard listings is free. Sellers may optionally pay for featured
                placements (for a listing, shop, or banner) to increase visibility. These fees relate only to
                promotion on the platform and are unrelated to, and separate from, the price of any item being sold.
            </>
        ),
    },
    {
        title: '6. Prohibited Conduct',
        body: (
            <>
                You may not use Suqafuran to post fraudulent listings, impersonate another person or business,
                harass other users, circumvent account restrictions, or attempt to interfere with the platform's
                normal operation.
            </>
        ),
    },
    {
        title: '7. Reporting & Enforcement',
        body: (
            <>
                We rely on user reports to identify listings and accounts that violate these Terms. We may
                investigate reports, remove content, and suspend or terminate accounts at our discretion to keep the
                platform safe.
            </>
        ),
    },
    {
        title: '8. Limitation of Liability',
        body: (
            <>
                Suqafuran is provided on an "as is" basis. To the fullest extent permitted by law, Suqafuran is not
                liable for any loss, damage, or dispute arising from a transaction between users, including issues
                with item quality, payment, or in-person meetups.
            </>
        ),
    },
    {
        title: '9. Changes to These Terms',
        body: (
            <>
                We may update these Terms from time to time to reflect changes to our platform or legal
                requirements. Continued use of Suqafuran after changes are posted means you accept the updated
                Terms.
            </>
        ),
    },
];

export default function TermsOfUsePage() {
    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
                <div className="mb-10">
                    <h1 className="text-3xl font-black text-gray-900 dark:text-neutral-50">Terms of Use</h1>
                    <p className="mt-3 text-sm text-gray-500 dark:text-neutral-300">
                        Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-gray-600 dark:text-neutral-300">
                        These Terms of Use govern your access to and use of Suqafuran. By creating an account or
                        using the platform, you agree to these Terms.
                    </p>
                </div>

                <div className="space-y-8">
                    {SECTIONS.map((section) => (
                        <div key={section.title}>
                            <h2 className="text-sm font-black text-gray-900 dark:text-neutral-50 mb-2">
                                {section.title}
                            </h2>
                            <p className="text-xs leading-relaxed text-gray-600 dark:text-neutral-300">
                                {section.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
