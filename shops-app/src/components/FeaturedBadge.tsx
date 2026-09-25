'use client';

import { Zap } from 'lucide-react';

interface FeaturedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FeaturedBadge({ size = 'md', className = '' }: FeaturedBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-full ${sizeClasses[size]} ${className}`}>
      <Zap className="w-3 h-3" />
      Featured
    </div>
  );
}
