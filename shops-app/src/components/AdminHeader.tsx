"use client";

import React from 'react';
import Link from 'next/link';
import { Shield, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuth';
import { useRouter } from 'next/navigation';

export const AdminHeader: React.FC = () => {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-700 bg-slate-800/95 backdrop-blur-md">
      <div className="flex h-16 w-full items-center justify-between px-6">
        {/* Admin Logo and Title */}
        <Link href="/admin-dashboard" className="flex items-center gap-3 shrink-0 hover:opacity-90 transition-opacity">
          <div className="p-2 bg-gradient-to-br from-red-500 to-red-600 rounded-lg">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Suqafuran Admin</h1>
            <p className="text-xs text-slate-400">Dashboard</p>
          </div>
        </Link>

        {/* Right side controls */}
        <div className="flex items-center gap-6 shrink-0">
          {/* User Info */}
          {user && (
            <div className="text-right">
              <p className="text-sm font-bold text-white">{user.full_name}</p>
              <p className="text-xs text-slate-400">Administrator</p>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 font-bold text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
