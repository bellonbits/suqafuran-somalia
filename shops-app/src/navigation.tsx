import {
  LayoutDashboard, Users, ShoppingCart, CheckCircle, Layers,
  Gift, Megaphone, MessageSquare, BarChart3, FileText,
  AlertTriangle, AlertCircle, TrendingUp, Store, Grid3x3,
  DollarSign, Package, AlertOctagon, CreditCard, Star, Mail, MessageCircle,
  Image as ImageIcon,
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Home', path: '/' },
  { label: 'Shops', path: '/shops' },
  { label: 'Search', path: '/search' },
];

export const USER_NAV_ITEMS = [
  { label: 'Orders', path: '/orders' },
  { label: 'Messages', path: '/messages' },
  { label: 'Favorites', path: '/favorites' },
  { label: 'Settings', path: '/settings' },
];

export const SELLER_NAV_ITEMS = [
  { label: 'Dashboard', path: '/seller-dashboard' },
  { label: 'Products', path: '/seller-dashboard/products' },
  { label: 'Orders', path: '/seller-dashboard/orders' },
  { label: 'Analytics', path: '/seller-dashboard/analytics' },
];

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin-dashboard' },
  { label: 'Agent Dashboard', icon: TrendingUp, href: '/agent-dashboard' },
  { label: 'Users', icon: Users, href: '/admin-users' },
  { label: 'Shops', icon: Store, href: '/admin-shops' },
  { label: 'Listings', icon: Grid3x3, href: '/admin-listings' },
  { label: 'Verifications', icon: CheckCircle, href: '/admin-verifications' },
  { label: 'Orders', icon: ShoppingCart, href: '/admin-orders' },
  { label: 'Sellers', icon: Package, href: '/admin-sellers' },
  { label: 'Categories', icon: Layers, href: '/admin-categories' },
  { label: 'Support', icon: MessageSquare, href: '/admin-support' },
  { label: 'Disputes', icon: AlertOctagon, href: '/admin-disputes' },
  { label: 'Fraud', icon: AlertTriangle, href: '/admin-fraud' },
  { label: 'Unusual Accounts', icon: AlertCircle, href: '/admin-unusual-accounts' },
  { label: 'Marketing', icon: BarChart3, href: '/admin-marketing' },
  { label: 'Homepage Banners', icon: ImageIcon, href: '/admin-dashboard/marketing/banners' },
  { label: 'User Lifecycle', icon: TrendingUp, href: '/admin-dashboard/user-lifecycle' },
  { label: 'Email Templates', icon: Mail, href: '/admin-dashboard/email-templates' },
  { label: 'Email Analytics', icon: Mail, href: '/admin-dashboard/email-analytics' },
  { label: 'Customer Segments', icon: Users, href: '/admin-dashboard/customer-segments' },
  { label: 'System Messages', icon: MessageCircle, href: '/admin-dashboard/system-messages' },
  { label: 'Reports', icon: FileText, href: '/admin-reports' },
  { label: 'Realtime Analytics', icon: TrendingUp, href: '/admin-dashboard/analytics' },
  { label: 'Subscriptions', icon: CreditCard, href: '/admin-dashboard/subscriptions' },
  { label: 'Featured Ads', icon: Star, href: '/admin-dashboard/featured-ads' },
];

export const AGENT_NAV_ITEMS = [
  { label: 'Dashboard', path: '/agent-dashboard' },
  { label: 'Earnings', path: '/agent-earnings' },
  { label: 'Analytics', path: '/agent-analytics' },
];
