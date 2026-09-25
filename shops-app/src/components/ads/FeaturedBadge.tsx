import { Star } from 'lucide-react';

interface FeaturedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function FeaturedBadge({ size = 'md', className = '' }: FeaturedBadgeProps) {
  const sizeClasses = {
    sm: 'w-5 h-5 text-xs px-2 py-0.5',
    md: 'w-6 h-6 text-sm px-2.5 py-1',
    lg: 'w-8 h-8 text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 4,
    md: 5,
    lg: 6,
  };

  return (
    <div
      className={`inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 rounded-full font-semibold ${sizeClasses[size]} ${className}`}
      title="Featured Placement"
    >
      <Star className={`w-${iconSizes[size]} h-${iconSizes[size]} fill-current`} />
      <span>Featured</span>
    </div>
  );
}
