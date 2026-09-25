"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Heart, ShoppingCart, MessageCircle, User, Store } from 'lucide-react';
import { useAuthStore } from '../../store/useAuth';
import api from '../../services/api';

const baseNavItems = [
  { href: '/shops', label: 'Home', icon: Home },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/checkout', label: 'Cart', icon: ShoppingCart },
  { href: '/messages', label: 'Chat', icon: MessageCircle },
  { href: '/account', label: 'Profile', icon: User },
];

export const BottomNavigation: React.FC = () => {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const [navItems, setNavItems] = useState(baseNavItems);
  const [isVerifiedSeller, setIsVerifiedSeller] = useState(false);

  // Fetch seller status when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const fetchSellerStatus = async () => {
        try {
          const response = await api.get(`/sellers/${user.id}/is-seller`);
          setIsVerifiedSeller(response.data?.is_seller === true);
        } catch (error) {
          setIsVerifiedSeller(false);
        }
      };
      fetchSellerStatus();
    } else {
      setIsVerifiedSeller(false);
    }
  }, [isAuthenticated, user?.id]);

  // Update nav items when seller status changes
  useEffect(() => {
    if (isVerifiedSeller && isAuthenticated) {
      setNavItems([
        { href: '/shops', label: 'Home', icon: Home },
        { href: '/favorites', label: 'Favorites', icon: Heart },
        { href: '/seller-dashboard', label: 'Seller', icon: Store },
        { href: '/messages', label: 'Chat', icon: MessageCircle },
        { href: '/account', label: 'Profile', icon: User },
      ]);
    } else {
      setNavItems(baseNavItems);
    }
  }, [isVerifiedSeller, isAuthenticated]);

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 sm:hidden z-40 pb-[env(safe-area-inset-bottom,0px)] bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl border-t border-gray-200/70 dark:border-neutral-800/70 shadow-[0_-4px_25px_rgba(0,0,0,0.08)]">
      <div className="max-w-md mx-auto px-2 py-2">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all relative group ${
                  active
                    ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 font-bold scale-105'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 transition-transform group-active:scale-95 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                <span className="text-[11px] leading-none tracking-tight">{item.label}</span>

                {/* Active indicator dot */}
                {active && (
                  <div className="w-1 h-1 bg-orange-600 dark:bg-orange-400 rounded-full mt-1" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
