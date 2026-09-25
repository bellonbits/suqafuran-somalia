import React from 'react';
import Link from 'next/link';

export const Footer: React.FC = () => {
    return (
        <footer className="border-t border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 pb-16 md:pb-0">
            <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
                <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
                    {/* Brand Section */}
                    <div className="col-span-2 md:col-span-1 space-y-4">
                        <Link href="/" className="inline-block hover:opacity-90 transition-opacity">
                            <img src="/icon1.png" alt="Suqafuran Logo" className="h-8 w-auto object-contain" />
                        </Link>
                        <p className="text-xs text-gray-500 dark:text-neutral-300 leading-relaxed pt-1">
                            Africa's trusted online marketplace. Buy, sell, chat, and transact securely directly with local buyers and sellers.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-wider">
                            Resources
                        </h3>
                        <ul className="mt-4 space-y-2">
                            <li>
                                <Link href="/search" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Browse Ads
                                </Link>
                            </li>
                            <li>
                                <Link href="/seller-dashboard/products/add" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Post a Listing
                                </Link>
                            </li>
                            <li>
                                <Link href="/seller-dashboard" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Seller Dashboard
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Support & Legal */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-wider">
                            Support
                        </h3>
                        <ul className="mt-4 space-y-2">
                            <li>
                                <Link href="/help-center" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Help Center
                                </Link>
                            </li>
                            <li>
                                <Link href="/safe-trading-tips" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Safe Trading Tips
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-of-use" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Terms of Use
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Marketplace */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-wider">
                            Marketplace
                        </h3>
                        <ul className="mt-4 space-y-2">
                            <li>
                                <Link href="/offers" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    My Offers
                                </Link>
                            </li>
                            <li>
                                <Link href="/price-alerts" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Price Alerts
                                </Link>
                            </li>
                            <li>
                                <Link href="/saved-searches" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Saved Searches
                                </Link>
                            </li>
                            <li>
                                <Link href="/settings/notifications" className="text-xs font-medium text-gray-600 hover:text-primary dark:text-neutral-200 dark:hover:text-sky-400">
                                    Notifications
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Somalia Cities */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 dark:text-neutral-400 uppercase tracking-wider">
                            Somalia
                        </h3>
                        <ul className="mt-4 space-y-2">
                            <li className="text-xs text-gray-500 dark:text-neutral-300 font-medium">Mogadishu (Muqdisho)</li>
                            <li className="text-xs text-gray-500 dark:text-neutral-300 font-medium">Hargeisa (Hargeysa)</li>
                            <li className="text-xs text-gray-500 dark:text-neutral-300 font-medium">Bosaso (Boosaaso)</li>
                            <li className="text-xs text-gray-500 dark:text-neutral-300 font-medium">Garowe & Kismayo</li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 border-t border-gray-200 dark:border-neutral-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-400 dark:text-neutral-400 font-medium">
                        &copy; {new Date().getFullYear()} Suqafuran Ltd (suqafuran.so). All rights reserved.
                    </p>
                    <div className="flex gap-4">
                        <span className="text-xs text-gray-400 font-bold dark:text-neutral-400">Somalia's Premier Marketplace</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};
