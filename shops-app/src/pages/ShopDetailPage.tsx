"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocationStore } from '@/store/useLocation';
import { LocationPickerModal } from '@/components/shared/LocationPickerModal';
import { listingsService } from '@/services/listings';
import api, { optimizeCloudinaryUrl, resolveMediaUrl } from '@/services/api';
import {
    ChevronRight, ChevronLeft, Star, Clock, MapPin, Plus, Minus, Search, ShoppingBag, X, Percent, ThumbsUp, Info, Heart, Filter, MessageCircle
} from 'lucide-react';
import { useCart } from '@/store/useCart';
import { useAuthStore } from '@/store/useAuth';
import { useTrackShopView } from '@/hooks/useViewTracking';
import { analyticsService } from '@/services/analytics';
import { getMockProductInfo } from '@/lib/mockProductInfo';


// Helper: Build breadcrumb from full category hierarchy (Category > Subcategory > SubSubcategory)
function getCategoryPath(categoryId: number, subcategoryId: number | undefined, dbCategories: any[] = [], subsubcategoryId: number | undefined = undefined): string {
  if (!categoryId) return 'Products';
  
  // Find the category in dbCategories
  const category = dbCategories.find((c: any) => c.id === categoryId);
  if (!category) return `Category ${categoryId}`;
  
  const categoryName = category.name_en || `Category ${categoryId}`;
  
  // If subcategory_id is provided, find the subcategory name
  if (subcategoryId && category.subcategories) {
    const subcategory = category.subcategories.find((s: any) => s.id === subcategoryId);
    if (subcategory) {
      const subcategoryName = subcategory.name_en;
      
      // If sub-subcategory_id is provided, find the sub-subcategory name
      if (subsubcategoryId && subcategory.subsubcategories) {
        const subsubcategory = subcategory.subsubcategories.find((ss: any) => ss.id === subsubcategoryId);
        if (subsubcategory) {
          const subsubcategoryName = subsubcategory.name_en;
          return `${categoryName} > ${subcategoryName} > ${subsubcategoryName}`;
        }
      }
      
      return `${categoryName} > ${subcategoryName}`;
    }
  }
  
  return categoryName;
}

export default function ShopDetailPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { slug: slugParam } = useParams<{ slug?: string }>();
    const shopIdParam = (slugParam || searchParams.get("id")) as string;
    const { city, isHydrated } = useLocationStore();

    const [shopName, setShopName] = useState('');
    const [shopOwnerName, setShopOwnerName] = useState('');
    const [shopLocation, setShopLocation] = useState('');
    const [shopPhone, setShopPhone] = useState('');
    const [shopLogo, setShopLogo] = useState('');
    const [shopAvatar, setShopAvatar] = useState('');
    const [avatarError, setAvatarError] = useState(false);

    const [allListings, setAllListings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set());
    const [dbCategories, setDbCategories] = useState<any[]>([]);
    const [customBanner, setCustomBanner] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [modalQuantity, setModalQuantity] = useState(1);
    const [modalActiveImage, setModalActiveImage] = useState(0);
    const modalGalleryRef = useRef<HTMLDivElement | null>(null);
    const [shopId, setShopId] = useState<string | null>(null);
    const [shopOwnerId, setShopOwnerId] = useState<string | number | null>(null);
    const [favorites, setFavorites] = useState<Set<string | number>>(new Set());
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<number | null>(null);
    const [selectedSubsubcategoryId, setSelectedSubsubcategoryId] = useState<number | null>(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Filters
    const [selectedPriceRanges, setSelectedPriceRanges] = useState<Set<string>>(new Set());
    const [selectedConditions, setSelectedConditions] = useState<Set<string>>(new Set());
    const [selectedDiscounts, setSelectedDiscounts] = useState<Set<string>>(new Set());
    const [selectedRatings, setSelectedRatings] = useState<Set<string>>(new Set());

    const [showMobileContactSheet, setShowMobileContactSheet] = useState(false);

    // Review/Rating State
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [userRating, setUserRating] = useState(0);
    const [userReview, setUserReview] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(false);
    const [shopRating, setShopRating] = useState<number | null>(null);
    const [totalReviews, setTotalReviews] = useState(0);
    const [verifiedReviewsCount, setVerifiedReviewsCount] = useState(0);
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [userHasReviewed, setUserHasReviewed] = useState(false);
    const [lastReviewTime, setLastReviewTime] = useState<number | null>(null);

    // Feedback State
    const [feedbackText, setFeedbackText] = useState('');
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

    // Follow State
    const [isFollowing, setIsFollowing] = useState(false);
    const [isSubmittingFollow, setIsSubmittingFollow] = useState(false);

    // Messaging State
    const [messagingModalOpen, setMessagingModalOpen] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    const { items: cartItems, addItem, updateQuantity: updateCartQuantity, getTotalPrice } = useCart();
    const { user, token, isAuthenticated } = useAuthStore();

    // Track shop profile views for analytics
    useTrackShopView(shopOwnerId as number);

    const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
    const scrollRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const toggleSubcategoryExpand = (subcategoryId: number) => {
    const newExpanded = new Set(expandedSubcategories);
    if (newExpanded.has(subcategoryId)) {
      newExpanded.delete(subcategoryId);
    } else {
      newExpanded.add(subcategoryId);
    }
    setExpandedSubcategories(newExpanded);
  };

  const handleShowAllCategory = (category: any) => {
    // Extract main category_id from the first product in the category
    if (category.products && category.products.length > 0) {
      const mainCategoryId = category.products[0].category_id;
      // Set the category and clear all subcategory filters
      setSelectedCategoryId(mainCategoryId);
      setSelectedSubcategoryId(null);
      setSelectedSubsubcategoryId(null);
      // Set the active category (no auto-scroll)
      setActiveCategory(mainCategoryId);
    }
  };

  const getCartQuantity = (productId: string) => {
        return cartItems.find(item => item.id === productId)?.quantity || 0;
    };

    // Resolve the URL's slug (or legacy numeric ID) to the full public shop
    // object in a single request, with robust fallbacks so every shop is accessible.
    const resolveShop = async (): Promise<any | null> => {
        try {
            // 1. Direct shop slug/ID endpoint
            const res = await api.get(`/listings/shops/${encodeURIComponent(shopIdParam)}`).catch(() => null);
            if (res?.data && (res.data.shop_name || res.data.business_name || res.data.full_name)) {
                return res.data;
            }

            // 2. Query public shops with shop_id filter
            if (/^\d+$/.test(shopIdParam)) {
                const { shops } = await listingsService.getShops({ shop_id: shopIdParam, limit: 1 }).catch(() => ({ shops: [] }));
                if (shops?.[0]) return shops[0];
            }

            // 3. Fallback to shops directory search
            const dirRes = await api.get('/admin/shops/directory', { params: { search: shopIdParam, limit: 5 } }).catch(() => null);
            if (dirRes?.data?.shops?.length > 0) {
                const found = dirRes.data.shops.find((s: any) => String(s.id) === String(shopIdParam)) || dirRes.data.shops[0];
                if (found) {
                    return {
                        id: String(found.id),
                        user_id: String(found.id),
                        shop_name: found.business_name || found.full_name || 'Shop',
                        owner_name: found.full_name || found.business_name || '',
                        shop_address: found.location || 'Bakaara Market (Mogadishu)',
                        phone: found.phone,
                        is_verified: Boolean(found.is_verified),
                        logo_url: found.logo_url,
                        shop_page_banner: found.shop_page_banner,
                        rating: 4.9,
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Failed to resolve shop:', error);
            return null;
        }
    };

    useEffect(() => {
        if (!city && isHydrated) {
            setIsLocationModalOpen(true);
            return;
        }

        // Always land at the top of a shop's page, not wherever the previous
        // page (or a stale scroll position from a prior visit) left off.
        window.scrollTo(0, 0);

        const fetchData = async () => {
            try {
                setLoading(true);

                // Resolving the shop and loading categories don't depend on
                // each other, so run them together instead of in sequence.
                const [categoriesData, currentShop] = await Promise.all([
                    listingsService.getCategories(),
                    resolveShop(),
                ]);
                setDbCategories(categoriesData || []);

                if (!currentShop) {
                    console.error('Shop not found in public shops list. Setting fallback data.');
                    setShopName(shopIdParam || 'Shop');
                    setShopOwnerName('');
                    setAllListings([]);
                    setLoading(false);
                    return;
                }

                setShopId(String(currentShop.id));
                console.log(' Matched public shop:', currentShop);

                const ownerId = currentShop.user_id;

                // Listings and banners both only need the owner id, so fetch
                // them together rather than one after the other.
                const [shopListings, bannerRes] = await Promise.all([
                    listingsService.getListings({ owner_id: Number(ownerId), limit: 200 }),
                    api.get(`/listings/shops/${ownerId}/banners`).catch((err: any) => {
                        console.error('⚠️ Banner fetch failed (will use category fallback):', err.message);
                        return null;
                    }),
                ]);
                console.log(' Retrieved shop listings:', shopListings);

                setShopName(currentShop.shop_name || 'Shop');
                setShopOwnerName(currentShop.owner_name || '');
                setShopLocation(currentShop.shop_address || '');
                if (currentShop.shop_name) {
                    document.title = `${currentShop.shop_name} | Suqafuran`;
                }

                // Extract logo candidate: check logo_url first, then owner_avatar_url, user avatar_url, or cover_image
                const rawLogo = currentShop.logo_url || currentShop.owner_avatar_url || currentShop.user?.avatar_url || currentShop.cover_image;
                let logoUrl = rawLogo ? (resolveMediaUrl(rawLogo) || rawLogo) : '';

                if (bannerRes?.data?.shop_detail_banner) {
                    setCustomBanner(bannerRes.data.shop_detail_banner);
                } else if (bannerRes?.data?.shop_page_banner) {
                    setCustomBanner(bannerRes.data.shop_page_banner);
                }
                // If logo was not already set from shop list, use banner endpoint logo_url
                if (!logoUrl && bannerRes?.data?.logo_url) {
                    logoUrl = resolveMediaUrl(bannerRes.data.logo_url) || bannerRes.data.logo_url;
                }

                setShopLogo(logoUrl);
                setShopAvatar(logoUrl);
                setAvatarError(false);
                setShopOwnerId(ownerId);
                setShopPhone(currentShop.phone || '');
                setAllListings(shopListings || []);
                console.log('📦 Sample listing:', shopListings?.[0]);
                console.log('📦 Has subcategory_id:', shopListings?.[0]?.subcategory_id);
                if (shopListings && shopListings.length > 0) {
                    setActiveCategory(String(shopListings[0].category_id || ''));
                }
            } catch (error) {
                console.error('Error fetching shop details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            document.title = "Suqafuran - Somalia's Marketplace";
        };
    }, [shopIdParam, city, isHydrated]);

    // Fetch user's follow/review/feedback status when component mounts or user changes
    useEffect(() => {
        if (!isAuthenticated || !shopOwnerId || !user?.id) return;

        const fetchUserStatus = async () => {
            try {
                // Fetch user's follows to check if following this shop
                const followsRes = await api.get('/follows/my/following');
                const followingUsers = followsRes.data || [];
                const isUserFollowing = followingUsers.some((f: any) => f.id === Number(shopOwnerId));
                setIsFollowing(isUserFollowing);
            } catch (err) {
                console.error('Failed to fetch follow status:', err);
            }

            try {
                // Fetch user's reviews for this shop
                const reviewsRes = await api.get(`/reviews?shop_owner_id=${shopOwnerId}`);
                const userReviews = (reviewsRes.data || []).filter((r: any) => r.author_id === user.id);
                setUserHasReviewed(userReviews.length > 0);
            } catch (err) {
                console.error('Failed to fetch review status:', err);
            }

            try {
                // Fetch user's feedback for this shop
                const feedbackRes = await api.get(`/feedback/user/${user.id}/feedback`);
                const userFeedback = (feedbackRes.data || []).find((f: any) => f.target_user_id === Number(shopOwnerId));
                if (userFeedback) {
                    setFeedbackText(userFeedback.comment || '');
                }
            } catch (err) {
                console.error('Failed to fetch feedback status:', err);
            }
        };

        fetchUserStatus();
    }, [isAuthenticated, shopOwnerId, user?.id]);


    const filteredListings = useMemo(() => {
        if (!searchQuery.trim()) return allListings;
        const query = searchQuery.toLowerCase();
        return allListings.filter(p =>
            p.title_en?.toLowerCase().includes(query) ||
            p.description_en?.toLowerCase().includes(query)
        );
    }, [allListings, searchQuery]);

    const categories = useMemo(() => {
        // Create lookup maps for subcategories and subsubcategories
        const subcategoryMap = new Map<number, any>();
        const subsubcategoryMap = new Map<number, any>();

        dbCategories.forEach((cat: any) => {
            cat.subcategories?.forEach((sub: any) => {
                subcategoryMap.set(sub.id, sub);
                sub.subsubcategories?.forEach((subsub: any) => {
                    subsubcategoryMap.set(subsub.id, subsub);
                });
            });
        });

        const categoryMap = new Map<string, any[]>();
        filteredListings.forEach((listing: any) => {
            // Group by MAIN CATEGORY ONLY
            const groupKey = String(listing.category_id);

            // Get main category name
            const mainCat = dbCategories.find((c: any) => c.id === listing.category_id);
            const displayName = mainCat?.name_en || 'Products';

            if (!categoryMap.has(groupKey)) {
                categoryMap.set(groupKey, []);
            }
            categoryMap.get(groupKey)!.push({ ...listing, _displayName: displayName });
        });

        const result = Array.from(categoryMap.entries())
            .map(([id, products]) => ({
                id,
                name: products[0]._displayName || 'Products',
                products: products.map(({ _displayName, ...rest }) => rest)
            }))
            .sort((a, b) => b.products.length - a.products.length);


        return result;
    }, [filteredListings, dbCategories]);

    const mainCategoryMap = useMemo(() => {
        const map = new Map<number, string>();
        dbCategories.forEach((cat: any) => {
            map.set(cat.id, cat.name_en);
            cat.subcategories?.forEach((sub: any) => {
                map.set(sub.id, cat.name_en);
                sub.subsubcategories?.forEach((subsub: any) => {
                    map.set(subsub.id, cat.name_en);
                });
            });
        });
        return map;
    }, [dbCategories]);

    const bannerImage = useMemo(() => {
        if (customBanner) {
            return customBanner;
        }
        return null;
    }, [customBanner]);

    // Intersection observer to track scrolled category
    useEffect(() => {
        if (loading || categories.length === 0) return;
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const catId = entry.target.getAttribute('data-category-id');
                        if (catId) {
                            setActiveCategory(catId);
                        }
                    }
                });
            },
            {
                root: null,
                rootMargin: '-15% 0px -55% 0px',
                threshold: 0,
            }
        );

        const currentRefs = categoryRefs.current;
        Object.keys(currentRefs).forEach((key) => {
            const el = currentRefs[key];
            if (el) observer.observe(el);
        });

        return () => {
            Object.keys(currentRefs).forEach((key) => {
                const el = currentRefs[key];
                if (el) observer.unobserve(el);
            });
        };
    }, [categories, loading]);

    const scrollProducts = (catId: string, direction: 'left' | 'right') => {
        const container = scrollRefs.current[catId];
        if (container) {
            const scrollAmount = direction === 'left' ? -350 : 350;
            container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    if (!city) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Select Your Location</h1>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => setIsLocationModalOpen(true)}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-full"
                    >
                        Choose Location
                    </motion.button>
                </div>
                <LocationPickerModal
                    isOpen={isLocationModalOpen}
                    onClose={() => { if (city) setIsLocationModalOpen(false); }}
                />
            </div>
        );
    }

    // Show not found if shop couldn't be resolved and not still loading
    if (!loading && !shopName) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
                <div className="text-center max-w-md">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">404</h1>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Shop Not Found</h2>
                    <p className="text-gray-600 dark:text-neutral-300 mb-6">
                        The shop "{shopIdParam}" doesn't exist or has been removed.
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        onClick={() => navigate('/shops')}
                        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-full"
                    >
                        Browse All Markets
                    </motion.button>
                </div>
            </div>
        );
    }

    const getInitials = () => {
        let initials = shopName?.[0]?.toUpperCase() || 'S';
        if (shopOwnerName && shopOwnerName.length > 0) {
            const nameParts = shopOwnerName.trim().split(' ');
            if (nameParts.length > 1) {
                initials = (shopName?.[0] || 'S') + (nameParts[nameParts.length - 1]?.[0] || '');
                return initials.toUpperCase();
            }
        }
        return initials;
    };
    const shopInitials = getInitials();

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            {/* STICKY HEADER / BREADCRUMBS */}
            <div className="sticky top-0 z-40 bg-white dark:bg-black border-b border-gray-100 dark:border-neutral-800">
                <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <button onClick={() => navigate('/')} className="text-gray-500 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                            {city}
                        </button>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <button onClick={() => navigate('/shops')} className="text-gray-500 dark:text-neutral-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                            Shops
                        </button>
                        <ChevronRight className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-900 dark:text-white truncate">{shopName}</span>
                    </div>

                    {/* Right side icons: Location + Cart */}
                    <div className="flex items-center gap-4">
                        {/* Location Icon */}
                        <button
                            onClick={() => setIsLocationModalOpen(true)}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-600 dark:text-neutral-300 transition-colors"
                            title="Change location"
                        >
                            <MapPin className="w-5 h-5" />
                        </button>

                        {/* Cart Icon */}
                        <button
                            onClick={() => navigate('/checkout')}
                            className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-900 text-gray-600 dark:text-neutral-300 transition-colors"
                            title="View cart"
                        >
                            <ShoppingBag className="w-5 h-5" />
                            {Object.keys(cartItems).length > 0 && (
                                <span className="absolute top-0 right-0 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {Object.keys(cartItems).length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* HERO BANNER & INFO (Glovo Style) */}
            <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
                {/* BANNER WITH SHOP LOGO OVERLAY */}
                <div className="relative bg-gray-200 dark:bg-neutral-900 h-32 md:h-44 rounded-xl overflow-hidden mb-6 shadow-md border border-gray-100 dark:border-neutral-800">
                    {bannerImage && (
                        <>
                            <img
                                src={optimizeCloudinaryUrl(bannerImage, { width: 1920, quality: 'auto', fetch_format: 'auto' }) || bannerImage}
                                alt={shopName}
                                className="w-full h-full object-cover"
                                loading="eager"
                                decoding="async"
                            />
                            <div className="absolute inset-0 bg-black/10 dark:bg-black/20" />
                        </>
                    )}
                    
                    {/* Circle Logo Overlay (Bottom-left) */}
                    <div className="absolute bottom-4 left-5 w-16 h-16 rounded-full bg-white dark:bg-neutral-950 border-4 border-white dark:border-neutral-800 shadow-lg flex items-center justify-center overflow-hidden">
                        {shopAvatar && !avatarError ? (
                            <img
                                src={optimizeCloudinaryUrl(shopAvatar, { width: 128 }) || shopAvatar}
                                alt={shopName}
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                className="w-full h-full object-cover"
                                onError={() => setAvatarError(true)}
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-sm">
                                {shopInitials}
                            </div>
                        )}
                    </div>
                    <button className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/95 dark:bg-neutral-950/95 flex items-center justify-center text-gray-600 dark:text-neutral-200 hover:scale-105 shadow transition-all">
                        <Info className="w-4 h-4" />
                    </button>
                </div>

                {/* DETAILS ROW (Title, Badges, bubbles metrics) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-8">
                        <h1 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white tracking-tight mb-3">
                            {shopName}
                        </h1>

                        {/* Seller Info Section */}
                        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-100 dark:border-neutral-800">
                            {/* Verification & Stats */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                    <span>✓</span> Verified Seller
                                </span>
                                <span className="text-xs text-gray-600 dark:text-neutral-300 font-semibold">
                                    <span className="text-green-600 dark:text-green-400">95%</span> response rate
                                </span>
                                <span className="text-xs text-gray-600 dark:text-neutral-300 font-semibold">
                                    Member since <span className="text-gray-900 dark:text-white">Jan 2026</span>
                                </span>
                                {shopLocation && (
                                    <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-neutral-300 font-semibold">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {shopLocation}
                                    </span>
                                )}
                            </div>

                            {/* Contact Buttons - Icon Row */}
                            <div className="flex items-center gap-2 ml-auto">
                                <a
                                    href={`tel:${shopPhone || '+252610000000'}`}
                                    title={shopPhone ? `Call: ${shopPhone}` : "Call Seller"}
                                    className="w-10 h-10 rounded-lg hover:scale-110 transition-transform flex items-center justify-center"
                                >
                                    <img src="/call-icon.png" alt="Call" className="w-6 h-6" />
                                </a>
                                <button
                                    onClick={() => {
                                        if (!isAuthenticated) {
                                            navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname));
                                            return;
                                        }
                                        analyticsService.trackClick({
                                            event_type: 'chat',
                                            shop_id: shopOwnerId as number,
                                            device_type: analyticsService.getDeviceType(),
                                        }).catch(() => {});
                                        navigate(`/messages?userId=${shopOwnerId}`);
                                    }}
                                    className="w-10 h-10 rounded-lg hover:scale-110 transition-transform flex items-center justify-center"
                                    title="Message Seller"
                                >
                                    <img src="/message-icon.png" alt="Message" className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Rating Section */}
                        {shopRating !== null && totalReviews > 0 && (
                            <div className="flex items-center gap-4 mb-4 py-3 border-y border-gray-100 dark:border-neutral-800">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5">
                                        {[...Array(5)].map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`w-4 h-4 ${
                                                    i < Math.floor(shopRating)
                                                        ? 'fill-yellow-400 text-yellow-400'
                                                        : 'text-gray-300 dark:text-neutral-300'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                                        {shopRating.toFixed(1)} ({totalReviews})
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-neutral-300">
                                        ({verifiedReviewsCount} verified)
                                    </span>
                                </div>
                                <button
                                    onClick={() => setRatingModalOpen(true)}
                                    disabled={userHasReviewed}
                                    className={`text-xs font-bold ml-auto ${
                                        userHasReviewed
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-[#00a082] hover:underline'
                                    }`}
                                >
                                    {userHasReviewed ? 'Review Submitted' : 'Rate Shop'}
                                </button>
                            </div>
                        )}

                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <span className="bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 text-xs font-bold px-3 py-1 rounded-md cursor-pointer hover:bg-slate-200 transition-colors">
                                Price match ›
                            </span>
                            <span className="bg-red-50 dark:bg-red-950/20 text-[#e81f44] text-xs font-extrabold px-3 py-1 rounded-md flex items-center gap-1">
                                <Percent className="w-3 h-3 stroke-[2.5]" />
                                -15% some items
                            </span>
                        </div>

                        {/* SEARCH & FILTER */}
                        <div className="flex gap-3 items-center max-w-2xl">
                            {/* SEARCH BAR */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search products, brands..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-white rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm border border-gray-200 dark:border-neutral-800"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>


                </div>
            </div>

            {/* THREE-COLUMN GRID CONTENT */}
            <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-24 mt-6">
                {loading ? (
                    <div className="text-center py-20">
                        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-neutral-300 text-sm font-semibold">Loading store items...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 dark:bg-neutral-950/30 rounded-2xl border border-dashed border-gray-200 dark:border-neutral-800 max-w-lg mx-auto">
                        <ShoppingBag className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-gray-800 dark:text-white">No products found</h3>
                        <p className="text-gray-500 dark:text-neutral-300 text-xs mt-1">
                            No listings match your search or filter options in this store.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-12 gap-8 items-start">
                        {/* 1. Left Sidebar (Categories with Subcategories) */}
                        <aside className="hidden lg:block lg:col-span-2 sticky top-28 self-start max-h-[75vh] overflow-y-auto pr-2 hide-scrollbar">
                            {/* Categories Section with Collapse/Expand Button */}
                            <div className="mb-4">
                                <button
                                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-950/40 transition-colors mb-2"
                                    title={isSidebarCollapsed ? "Expand categories" : "Collapse categories"}
                                >
                                    <span className="text-xs font-bold text-gray-700 dark:text-neutral-200">Categories</span>
                                    <ChevronLeft className={`w-4 h-4 text-gray-600 dark:text-neutral-300 transition-transform ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
                                </button>

                                {/* Categories Content - Hidden when collapsed */}
                                {!isSidebarCollapsed && (
                                <div className="space-y-2">
                                    {/* All Categories Button */}
                                    <button
                                        onClick={() => {
                                            setSelectedCategoryId(null);
                                            setSelectedSubcategoryId(null);
                                            setSelectedSubsubcategoryId(null);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                            selectedCategoryId === null
                                                ? 'bg-[#00a082] text-white'
                                                : 'text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-950/40'
                                        }`}
                                    >
                                        All Categories
                                    </button>

                                {dbCategories
                                    .filter((dbCategory: any) => {
                                        // Only show categories that have products in this shop
                                        return allListings.some(listing => listing.category_id === dbCategory.id);
                                    })
                                    .map((dbCategory: any) => (
                                    <div key={dbCategory.id} className="space-y-1">
                                        {/* Main Category */}
                                        <button
                                            onClick={() => {
                                                setSelectedCategoryId(dbCategory.id);
                                                setSelectedSubcategoryId(null);
                                                setSelectedSubsubcategoryId(null);
                                                setActiveCategory(dbCategory.id);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                selectedCategoryId === dbCategory.id
                                                    ? 'bg-[#00a082] text-white'
                                                    : 'text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-950/40'
                                            }`}
                                        >
                                            {dbCategory.name_en}
                                        </button>
                                        
                                        {/* Subcategories with Expandable Sub-subcategories */}
                                        {dbCategory.subcategories && dbCategory.subcategories.length > 0 && (
                                            <div className="pl-2 space-y-1">
                                                {dbCategory.subcategories
                                                    .filter((subcategory: any) => {
                                                        // Show only subcategories that have exact matching products in this shop
                                                        const hasMatch = allListings.some(
                                                            listing =>
                                                                listing.category_id === dbCategory.id &&
                                                                listing.subcategory_id === subcategory.id
                                                        );
                                                        if (hasMatch) {
                                                            console.log(`✓ ${subcategory.name_en} has products`);
                                                        }
                                                        return hasMatch;
                                                    })
                                                    .map((subcategory: any) => (
                                                    <div key={subcategory.id}>
                                                        {/* Subcategory */}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedCategoryId(dbCategory.id);
                                                                setSelectedSubcategoryId(subcategory.id);
                                                                setSelectedSubsubcategoryId(null);

                                                                const matchingCat = categories.find(c =>
                                                                    c.products?.some((p: any) =>
                                                                        p.category_id === dbCategory.id &&
                                                                        p.subcategory_id === subcategory.id
                                                                    )
                                                                );
                                                                if (matchingCat) {
                                                                    setActiveCategory(matchingCat.id);
                                                                }
                                                            }}
                                                            className="w-full text-left px-3 py-1 rounded-lg text-[11px] font-semibold transition-all text-gray-600 dark:text-neutral-300 hover:text-gray-900 hover:bg-gray-50 dark:hover:text-neutral-100 dark:hover:bg-neutral-950/40 flex items-center justify-between"
                                                        >
                                                            <span className="truncate">{subcategory.name_en}</span>
                                                            {subcategory.subsubcategories && subcategory.subsubcategories.length > 0 && (
                                                                <div
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSubcategoryExpand(subcategory.id);
                                                                    }}
                                                                    className="ml-1 shrink-0 cursor-pointer"
                                                                >
                                                                    <ChevronRight className={`w-3 h-3 transition-transform ${
                                                                        expandedSubcategories.has(subcategory.id) ? 'rotate-90' : ''
                                                                    }`} />
                                                                </div>
                                                            )}
                                                        </button>
                                                        
                                                        {/* Sub-subcategories (Expanded) - Show only those with products */}
                                                        {expandedSubcategories.has(subcategory.id) && subcategory.subsubcategories && (
                                                            <div className="pl-2 mt-1 space-y-1">
                                                                {subcategory.subsubcategories
                                                                    .filter((subsubcategory: any) => {
                                                                        // Show only subsubcategories that have exact matching products in this shop
                                                                        return allListings.some(
                                                                            listing =>
                                                                                listing.category_id === dbCategory.id &&
                                                                                listing.subcategory_id === subcategory.id &&
                                                                                listing.subsubcategory_id === subsubcategory.id
                                                                        );
                                                                    })
                                                                    .map((subsubcategory: any) => (
                                                                        <button
                                                                            key={subsubcategory.id}
                                                                            onClick={() => {
                                                                                setSelectedSubcategoryId(subcategory.id);
                                                                                setSelectedSubsubcategoryId(subsubcategory.id);

                                                                                const matchingCat = categories.find(c =>
                                                                                    c.products?.some((p: any) =>
                                                                                        p.category_id === dbCategory.id &&
                                                                                        p.subcategory_id === subcategory.id &&
                                                                                        p.subsubcategory_id === subsubcategory.id
                                                                                    )
                                                                                );
                                                                                if (matchingCat) {
                                                                                    setActiveCategory(matchingCat.id);
                                                                                }
                                                                            }}
                                                                            className="w-full text-left px-3 py-1 rounded-lg text-[10px] font-medium transition-all text-gray-500 dark:text-neutral-400 hover:text-gray-700 hover:bg-gray-50 dark:hover:text-neutral-200 dark:hover:bg-neutral-950/40 cursor-pointer"
                                                                        >
                                                                            {subsubcategory.name_en}
                                                                        </button>
                                                                    ))
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            )}
                            </div>

                            {/* Filters Section - Always Visible */}
                            <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                                {/* Price Range */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2">Price Range</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Under KSh 500', value: 'under500' },
                                            { label: 'KSh 500 - 1,000', value: '500-1000' },
                                            { label: 'KSh 1,000 - 2,500', value: '1000-2500' },
                                            { label: 'Above KSh 2,500', value: 'above2500' }
                                        ].map((range) => (
                                            <label key={range.value} className="flex items-center gap-2 cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPriceRanges.has(range.value)}
                                                    onChange={(e) => {
                                                        const newRanges = new Set(selectedPriceRanges);
                                                        if (e.target.checked) newRanges.add(range.value);
                                                        else newRanges.delete(range.value);
                                                        setSelectedPriceRanges(newRanges);
                                                    }}
                                                />
                                                {range.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Condition */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2">Condition</h3>
                                    <div className="space-y-2">
                                        {['New', 'Used'].map((condition) => (
                                            <label key={condition} className="flex items-center gap-2 cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedConditions.has(condition)}
                                                    onChange={(e) => {
                                                        const newConditions = new Set(selectedConditions);
                                                        if (e.target.checked) newConditions.add(condition);
                                                        else newConditions.delete(condition);
                                                        setSelectedConditions(newConditions);
                                                    }}
                                                />
                                                {condition}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Discount */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2">Discount</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'On Sale', value: 'sale' },
                                            { label: '10%+ Off', value: '10off' },
                                            { label: '20%+ Off', value: '20off' },
                                            { label: '50%+ Off', value: '50off' }
                                        ].map((discount) => (
                                            <label key={discount.value} className="flex items-center gap-2 cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDiscounts.has(discount.value)}
                                                    onChange={(e) => {
                                                        const newDiscounts = new Set(selectedDiscounts);
                                                        if (e.target.checked) newDiscounts.add(discount.value);
                                                        else newDiscounts.delete(discount.value);
                                                        setSelectedDiscounts(newDiscounts);
                                                    }}
                                                />
                                                {discount.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* Rating */}
                                <div>
                                    <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2">Rating</h3>
                                    <div className="space-y-2">
                                        {[
                                            { label: '4★ & Above', value: '4star' },
                                            { label: '3★ & Above', value: '3star' }
                                        ].map((rating) => (
                                            <label key={rating.value} className="flex items-center gap-2 cursor-pointer text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRatings.has(rating.value)}
                                                    onChange={(e) => {
                                                        const newRatings = new Set(selectedRatings);
                                                        if (e.target.checked) newRatings.add(rating.value);
                                                        else newRatings.delete(rating.value);
                                                        setSelectedRatings(newRatings);
                                                    }}
                                                />
                                                {rating.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </aside>

                        {/* 2. Center Column (List of Carousels) */}
                        <main className="col-span-12 lg:col-span-7 space-y-12">
                            {categories
                                .filter((category) => category.products.length > 0)
                                .filter((category) => {
                                    // If a specific category is selected, only show that category
                                    if (selectedCategoryId !== null) {
                                        return category.products.some((p: any) => p.category_id === selectedCategoryId);
                                    }
                                    // Otherwise show all categories
                                    return true;
                                })
                                .map((category) => (
                                <div
                                    key={category.id}
                                    ref={(el) => { if (el) categoryRefs.current[category.id] = el; }}
                                    data-category-id={category.id}
                                    className="scroll-mt-28"
                                >
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
                                                {(() => {
                                                    // If subsubcategory selected, find and show its name
                                                    if (selectedSubsubcategoryId) {
                                                        for (const cat of dbCategories) {
                                                            for (const subcat of cat.subcategories || []) {
                                                                const found = subcat.subsubcategories?.find((ss: any) => ss.id === selectedSubsubcategoryId);
                                                                if (found) return found.name_en;
                                                            }
                                                        }
                                                    }

                                                    // If subcategory selected, find and show its name
                                                    if (selectedSubcategoryId) {
                                                        for (const cat of dbCategories) {
                                                            const found = cat.subcategories?.find((s: any) => s.id === selectedSubcategoryId);
                                                            if (found) return found.name_en;
                                                        }
                                                    }

                                                    // If no subcategory selected, show the main category name
                                                    const mainCat = dbCategories.find((c: any) =>
                                                        category.products?.some((p: any) => p.category_id === c.id)
                                                    );
                                                    if (mainCat) return mainCat.name_en;

                                                    return (category.name === 'Other' ? 'Products' : category.name);
                                                })()}
                                            </h2>
                                        <button
                                            onClick={() => handleShowAllCategory(category)}
                                            className="text-xs font-black text-[#00a082] hover:underline"
                                        >
                                            Show all ({category.products.length})
                                        </button>
                                    </div>
                                    </div>

                                    {/* Horizontal Carousel */}
                                    <div
                                        ref={(el) => { if (el) scrollRefs.current[category.id] = el; }}
                                        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pb-2"
                                    >
                                        {(() => {
                                            const filtered = category.products.filter((product) => {
                                                // Main category filter
                                                if (selectedCategoryId !== null) {
                                                    if (product.category_id !== selectedCategoryId) return false;
                                                }

                                                // Subcategory/Subsubcategory filters
                                                if (selectedSubcategoryId !== null) {
                                                    if (selectedSubsubcategoryId === null) {
                                                        if (product.subcategory_id !== selectedSubcategoryId) return false;
                                                    } else {
                                                        if (product.subcategory_id !== selectedSubcategoryId || product.subsubcategory_id !== selectedSubsubcategoryId) return false;
                                                    }
                                                }

                                                // Price filter
                                                if (selectedPriceRanges.size > 0) {
                                                    const price = product.price || 0;
                                                    const matchesPrice = Array.from(selectedPriceRanges).some(range => {
                                                        switch(range) {
                                                            case 'under500': return price < 500;
                                                            case '500-1000': return price >= 500 && price <= 1000;
                                                            case '1000-2500': return price > 1000 && price <= 2500;
                                                            case 'above2500': return price > 2500;
                                                            default: return false;
                                                        }
                                                    });
                                                    if (!matchesPrice) return false;
                                                }

                                                // Condition filter
                                                if (selectedConditions.size > 0) {
                                                    if (!selectedConditions.has(product.condition)) return false;
                                                }

                                                // Discount filter (mock based on product id)
                                                if (selectedDiscounts.size > 0) {
                                                    const idNum = typeof product.id === 'number' ? product.id : (parseInt(String(product.id).slice(0, 4), 16) || 123);
                                                    const hasPromo = (idNum % 3) !== 0;
                                                    const discountPercent = 10 + (idNum % 4) * 5;

                                                    const matchesDiscount = Array.from(selectedDiscounts).some(discount => {
                                                        if (discount === 'sale' && hasPromo) return true;
                                                        if (discount === '10off' && hasPromo && discountPercent >= 10) return true;
                                                        if (discount === '20off' && hasPromo && discountPercent >= 20) return true;
                                                        if (discount === '50off' && hasPromo && discountPercent >= 50) return true;
                                                        return false;
                                                    });
                                                    if (!matchesDiscount) return false;
                                                }

                                                // Rating filter (mock based on shop rating)
                                                if (selectedRatings.size > 0) {
                                                    const mockRating = 3.5 + Math.random() * 1.5; // 3.5-5 stars
                                                    const matchesRating = Array.from(selectedRatings).some(rating => {
                                                        if (rating === '4star' && mockRating >= 4) return true;
                                                        if (rating === '3star' && mockRating >= 3) return true;
                                                        return false;
                                                    });
                                                    if (!matchesRating) return false;
                                                }

                                                return true;
                                            });
                                            if (filtered.length < category.products.length) {
                                                console.log(`Filtered ${category.products.length} → ${filtered.length} products`);
                                            }
                                            return filtered;
                                        })()

                                            .map((product) => {
                                            const { hasPromo, originalPrice, promoText } = getMockProductInfo(product);
                                            const cartQty = getCartQuantity(String(product.id));

                                            return (
                                                <div
                                                    key={product.id}
                                                    onClick={() => {
                                                        setSelectedProduct(product);
                                                        setModalQuantity(cartQty || 1);
                                                        setModalActiveImage(0);
                                                        if (modalGalleryRef.current) modalGalleryRef.current.scrollLeft = 0;
                                                    }}
                                                    className="cursor-pointer group"
                                                >
                                                    {/* Card Image Container */}
                                                    <div className="relative bg-gray-50 dark:bg-neutral-950/60 aspect-square rounded-lg overflow-hidden border border-gray-100 dark:border-neutral-800/80 mb-2.5 flex items-center justify-center transition-shadow group-hover:shadow-md">
                                                        {product.images?.[0] ? (
                                                            <img
                                                                src={optimizeCloudinaryUrl(product.images[0], { width: 500 }) || product.images[0]}
                                                                alt={product.title_en}
                                                                loading="eager"
                                                                decoding="async"
                                                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                <ShoppingBag className="w-6 h-6" />
                                                            </div>
                                                        )}

                                                        {/* Discount badge on the top-left */}
                                                        {hasPromo && (
                                                            <div className="absolute top-2 left-2 bg-[#e81f44] text-white text-[9px] font-black px-1.5 py-0.5 rounded">
                                                                {promoText}
                                                            </div>
                                                        )}

                                                        {/* Favorite Heart Button - Top Right */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                const newFavorites = new Set(favorites);
                                                                if (newFavorites.has(product.id)) {
                                                                    newFavorites.delete(product.id);
                                                                } else {
                                                                    newFavorites.add(product.id);
                                                                }
                                                                setFavorites(newFavorites);
                                                            }}
                                                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white dark:bg-neutral-950 shadow-md hover:scale-110 active:scale-95 flex items-center justify-center transition-all border border-gray-100 dark:border-neutral-800"
                                                        >
                                                            <Heart className={`w-3.5 h-3.5 ${favorites.has(product.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                                                        </button>

                                                        {/* Circular overlay + button on the bottom-right */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                addItem({
                                                                    owner_id: shopOwnerId ?? undefined,
                                                                    id: String(product.id),
                                                                    title: product.title_en,
                                                                    price: product?.price ?? 0,
                                                                    image: product.images?.[0],
                                                                    quantity: cartQty + 1
                                                                });
                                                            }}
                                                            className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-neutral-950 text-[#00a082] shadow-md hover:scale-105 active:scale-95 flex items-center justify-center transition-all border border-gray-100 dark:border-neutral-800"
                                                        >
                                                            {cartQty > 0 ? (
                                                                <span className="text-xs font-black text-gray-900 dark:text-white">{cartQty}</span>
                                                            ) : (
                                                                <Plus className="w-4 h-4 stroke-[3]" />
                                                            )}
                                                        </button>
                                                    </div>

                                                    {/* Card Title & Prices */}
                                                    <h3 className="font-semibold text-gray-900 dark:text-white text-xs leading-normal line-clamp-2 min-h-[32px] group-hover:text-orange-500 transition-colors">
                                                        {product.title_en}
                                                    </h3>
                                                    
                                                    {/* Category Breadcrumb */}
                                                    <p className="text-[11px] text-gray-500 dark:text-neutral-300 mt-1 line-clamp-1">
                                                        {(() => {
                                                  const cat = dbCategories.find((c: any) => c.id === product.category_id);
                                                  const subcat = cat?.subcategories?.find((s: any) => s.id === product.subcategory_id);
                                                  if (subcat) return `${cat?.name_en || 'Category'} • ${subcat.name_en}`;
                                                  return cat?.name_en || 'Category';
                                                })()}
                                                    </p>
                                                    
                                                    <div className="mt-2 flex flex-col">
                                                        <span className="text-sm font-black text-gray-900 dark:text-white">
                                                            KSh {(product?.price || 0).toLocaleString()}
                                                        </span>
                                                        {hasPromo && (
                                                            <span className="text-[10px] text-gray-400 dark:text-neutral-400 line-through">
                                                                KSh {originalPrice.toLocaleString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </main>

                        {/* 3. Right Sidebar (Your Order / Cart Summary) */}
                        <aside className="col-span-12 lg:col-span-3 sticky top-28 self-start">
                            <div className="bg-white dark:bg-neutral-950 border border-gray-100 dark:border-neutral-800 rounded-xl p-5 shadow-sm max-h-[75vh] flex flex-col">
                                <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-neutral-800 mb-4 shrink-0">
                                    <ShoppingBag className="w-4.5 h-4.5 text-gray-500" />
                                    <h3 className="font-extrabold text-gray-900 dark:text-white text-base">Your order</h3>
                                </div>

                                {cartItems.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center shrink-0">
                                        <div className="w-16 h-16 bg-gray-50 dark:bg-neutral-950 rounded-full flex items-center justify-center mb-4">
                                            <img src="/icons/shelves.png" className="w-8 h-8 object-contain opacity-40" alt="" />
                                        </div>
                                        <p className="font-bold text-gray-800 dark:text-white text-xs leading-tight">Your order is empty</p>
                                        <p className="text-gray-450 dark:text-neutral-400 text-[10px] mt-1 max-w-[170px] leading-normal">
                                            When you add products from a store, they will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 min-h-0 hide-scrollbar">
                                        {cartItems.map((item) => (
                                            <div key={item.id} className="flex gap-2 justify-between items-start text-xs">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-gray-900 dark:text-white truncate" title={item.title}>
                                                        {item.title}
                                                    </p>
                                                    <p className="text-gray-500 dark:text-neutral-300 font-bold text-[10px] mt-0.5">
                                                        KSh {(item?.price ?? 0) * (item?.quantity ?? 0).toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-neutral-900 px-2 py-0.5 rounded-full border border-gray-100 dark:border-neutral-800 shrink-0">
                                                    <button
                                                        onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                                                        className="text-gray-500 hover:text-gray-900 dark:text-neutral-300 dark:hover:text-neutral-100"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <span className="font-bold text-gray-900 dark:text-white text-[11px] px-0.5">
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                                                        className="text-orange-500 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="mt-auto border-t border-gray-100 dark:border-neutral-800 pt-4 space-y-3 shrink-0">
                                    {/* Delivery Threshold Notice */}
                                    <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-lg p-2.5 text-[10px] text-amber-800 dark:text-amber-300 leading-normal">
                                        {getTotalPrice() < 500 ? (
                                            <p className="font-medium">
                                                Reach <span className="font-bold">KSh 500.00</span> to avoid an extra fee of <span className="font-bold">KSh 300.00</span>.
                                            </p>
                                        ) : (
                                            <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                                <span>✓</span> You qualify for reduced fee checkout!
                                            </p>
                                        )}
                                    </div>

                                    {cartItems.length > 0 && (
                                        <>
                                            <div className="flex justify-between items-center text-xs font-semibold">
                                                <span className="text-gray-500">Subtotal</span>
                                                <span className="font-black text-gray-900 dark:text-white text-sm">KSh {getTotalPrice().toLocaleString()}</span>
                                            </div>
                                            
                                            <button
                                                onClick={() => navigate('/checkout')}
                                                className="w-full bg-[#00a082] hover:bg-[#008f73] text-white font-black py-2.5 px-4 rounded-full transition-colors flex items-center justify-center gap-1.5 shadow-sm text-xs"
                                            >
                                                <span>Checkout</span>
                                                <span>•</span>
                                                <span>KSh {(getTotalPrice() + (getTotalPrice() < 500 ? 300 : 0)).toLocaleString()}</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </div>

            {/* REVIEWS SECTION */}
            {shopId && (
                <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-12 mt-12">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-6">Customer Reviews</h2>

                    <div className="grid grid-cols-12 gap-8">
                        {/* Reviews & Feedback - Left/Center */}
                        <div className="col-span-12 lg:col-span-8 space-y-8">
                            {reviews && reviews.length > 0 ? (
                            <div className="space-y-4">
                                {reviews.map((review: any) => (
                                    <div
                                        key={review.id}
                                        className="bg-white dark:bg-neutral-950 rounded-lg p-4 border border-gray-100 dark:border-neutral-800"
                                    >
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        {review.display_name}
                                                    </span>
                                                    {review.is_verified_purchase ? (
                                                        <span className="text-xs bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            <span>✓</span> Verified Purchase
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full">
                                                            Public Review
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-neutral-300">
                                                    {new Date(review.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Rating */}
                                        <div className="flex gap-0.5 mb-2">
                                            {[...Array(5)].map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-4 h-4 ${
                                                        i < review.rating
                                                            ? 'fill-yellow-400 text-yellow-400'
                                                            : 'text-gray-300 dark:text-neutral-300'
                                                    }`}
                                                />
                                            ))}
                                        </div>

                                        {/* Review Text */}
                                        {review.review && (
                                            <p className="text-sm text-gray-700 dark:text-neutral-200">
                                                {review.review}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                            ) : (
                                <div className="bg-white dark:bg-neutral-950 rounded-lg p-12 border border-gray-100 dark:border-neutral-800 text-center">
                                    <p className="text-gray-600 dark:text-neutral-300 mb-4">
                                        No reviews yet. Be the first to rate this shop!
                                    </p>
                                    <button
                                        onClick={() => setRatingModalOpen(true)}
                                        className="bg-[#00a082] hover:bg-[#008f73] text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                    >
                                        Write First Review
                                    </button>
                                </div>
                            )}

                            {/* FEEDBACK SECTION */}
                            <div className="mt-8">
                                <div className="bg-white dark:bg-neutral-950 rounded-lg p-6 border border-gray-100 dark:border-neutral-800">
                                    <textarea
                                        placeholder="Share your experience with this shop..."
                                        value={feedbackText}
                                        onChange={(e) => setFeedbackText(e.target.value)}
                                        className="w-full h-24 p-4 border border-gray-100 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#00a082] resize-none"
                                    />
                                    <button
                                        onClick={async () => {
                                            if (feedbackText.trim().length === 0) {
                                                alert('Please enter your feedback');
                                                return;
                                            }
                                            try {
                                                setIsSubmittingFeedback(true);
                                                await api.post('/feedback/feedback', {
                                                    target_user_id: shopOwnerId,
                                                    comment: feedbackText,
                                                    rating: 5
                                                });
                                                setFeedbackText('');
                                                alert('Thank you for your feedback!');
                                            } catch (error) {
                                                console.error('Failed to submit feedback:', error);
                                                alert('Failed to submit feedback. Please try again.');
                                            } finally {
                                                setIsSubmittingFeedback(false);
                                            }
                                        }}
                                        disabled={isSubmittingFeedback}
                                        className="mt-4 bg-[#00a082] hover:bg-[#008f73] disabled:bg-gray-400 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                                    >
                                        {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Rating Summary - Right */}
                        <div className="col-span-12 lg:col-span-4">
                            <div className="bg-white dark:bg-neutral-950 rounded-lg p-6 border border-gray-100 dark:border-neutral-800 sticky top-28">
                                {shopRating !== null ? (
                                    <>
                                        <div className="text-center mb-6">
                                            <div className="text-5xl font-black text-gray-900 dark:text-white mb-2">
                                                {shopRating.toFixed(1)}
                                            </div>
                                            <div className="flex justify-center gap-0.5 mb-3">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star
                                                        key={i}
                                                        className={`w-5 h-5 ${
                                                            i < Math.floor(shopRating)
                                                                ? 'fill-yellow-400 text-yellow-400'
                                                                : 'text-gray-300 dark:text-neutral-300'
                                                        }`}
                                                    />
                                                ))}
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-neutral-300">
                                                {totalReviews} total reviews
                                            </p>
                                        </div>

                                        <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-neutral-800">
                                            <div>
                                                <p className="text-xs text-gray-600 dark:text-neutral-300 mb-1">
                                                    Verified Reviews
                                                </p>
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    {verifiedReviewsCount}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-600 dark:text-neutral-300 mb-1">
                                                    Community Reviews
                                                </p>
                                                <p className="font-bold text-gray-900 dark:text-white">
                                                    {totalReviews - verifiedReviewsCount}
                                                </p>
                                            </div>
                                        </div>

                                        {!userHasReviewed && (
                                            <button
                                                onClick={() => setRatingModalOpen(true)}
                                                className="w-full bg-[#00a082] hover:bg-[#008f73] text-white font-bold py-2 px-4 rounded-lg transition-colors mt-6"
                                            >
                                                Write a Review
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-sm text-gray-600 dark:text-neutral-300">No reviews yet</p>
                                    </div>
                                )}

                                <button
                                    onClick={async () => {
                                        if (!isAuthenticated) {
                                            navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname));
                                            return;
                                        }
                                        try {
                                            setIsSubmittingFollow(true);
                                            if (isFollowing) {
                                                await api.delete(`/follows/unfollow/${shopOwnerId}`);
                                                setIsFollowing(false);
                                                alert('You unfollowed this shop');
                                            } else {
                                                await api.post(`/follows/follow/${shopOwnerId}`);
                                                setIsFollowing(true);
                                                alert('You are now following this shop!');
                                            }
                                        } catch (error) {
                                            console.error('Failed to follow shop:', error);
                                            alert('Failed to follow shop. Please try again.');
                                        } finally {
                                            setIsSubmittingFollow(false);
                                        }
                                    }}
                                    disabled={isSubmittingFollow}
                                    className={`w-full font-bold py-2 px-4 rounded-lg transition-colors mt-6 ${
                                        isFollowing
                                            ? 'bg-[#00a082] text-white cursor-default'
                                            : 'bg-white dark:bg-neutral-900 border-2 border-[#00a082] text-[#00a082] dark:text-[#00a082] hover:bg-[#00a082]/5'
                                    }`}
                                >
                                    {isSubmittingFollow ? 'Following...' : isFollowing ? 'Following' : 'Follow Shop'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PRODUCT DETAIL MODAL (Overlay) */}
            <AnimatePresence>
                {selectedProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="absolute inset-0" onClick={() => setSelectedProduct(null)} />
                        
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="relative bg-white dark:bg-neutral-950 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 z-10 border border-gray-100 dark:border-neutral-800"
                        >
                            {/* Close button with circular green/teal outline */}
                            <button
                                onClick={() => setSelectedProduct(null)}
                                className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full border-2 border-[#00a082] text-white bg-[#00a082] hover:bg-[#008f73] flex items-center justify-center transition-all shadow-lg focus:outline-none hover:scale-110"
                            >
                                <X className="w-6 h-6 stroke-[3]" />
                            </button>

                            {/* Product Image Gallery — swipe/scroll through all photos */}
                            <div className="aspect-[4/3] w-full bg-white dark:bg-black rounded-2xl overflow-hidden mb-5 relative border border-gray-100 dark:border-neutral-800/80">
                                {selectedProduct.images?.length > 0 ? (
                                    <div
                                        ref={modalGalleryRef}
                                        onScroll={(e) => {
                                            const el = e.currentTarget;
                                            setModalActiveImage(Math.round(el.scrollLeft / el.clientWidth));
                                        }}
                                        className="no-scrollbar h-full w-full flex overflow-x-auto snap-x snap-mandatory"
                                    >
                                        {selectedProduct.images.map((src: string, i: number) => (
                                            <img
                                                key={i}
                                                src={optimizeCloudinaryUrl(src, { width: 900 }) || src}
                                                alt={`${selectedProduct.title_en} ${i + 1}`}
                                                loading="eager"
                                                decoding="async"
                                                className="h-full w-full object-contain p-4 shrink-0 snap-center"
                                                draggable={false}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center">
                                        <ShoppingBag className="w-12 h-12 text-gray-300" />
                                    </div>
                                )}

                                {/* Dot indicators + tap-to-jump, only when there's more than one photo */}
                                {selectedProduct.images?.length > 1 && (
                                    <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1.5 pointer-events-auto">
                                        {selectedProduct.images.map((_: string, i: number) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    const el = modalGalleryRef.current;
                                                    if (!el) return;
                                                    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                                                    setModalActiveImage(i);
                                                }}
                                                aria-label={`View photo ${i + 1}`}
                                                className={`rounded-full transition-all ${
                                                    i === modalActiveImage ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/50'
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Red promo percentage tag on the left */}
                                {getMockProductInfo(selectedProduct).hasPromo && (
                                    <div className="absolute top-4 left-4 bg-[#e81f44] text-white text-xs font-black px-2.5 py-1 rounded pointer-events-none">
                                        {getMockProductInfo(selectedProduct).promoText}
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
                                        {selectedProduct.title_en}
                                    </h2>
                                </div>

                                {/* Prices */}
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-gray-900 dark:text-white">
                                        KSh {(selectedProduct?.price || 0).toLocaleString()}
                                    </span>
                                    {getMockProductInfo(selectedProduct).hasPromo && (
                                        <span className="text-sm text-gray-400 dark:text-neutral-400 line-through font-semibold">
                                            KSh {getMockProductInfo(selectedProduct).originalPrice.toLocaleString()}
                                        </span>
                                    )}
                                </div>

                                {/* Product Description */}
                                {selectedProduct.description_en && (
                                    <p data-no-translate className="text-sm text-gray-700 dark:text-neutral-200 leading-relaxed bg-gray-50 dark:bg-neutral-900/50 p-3 rounded-lg">
                                        {selectedProduct.description_en}
                                    </p>
                                )}

                                {/* Quantity Selector Counter Pill */}
                                <div className="flex justify-center py-2">
                                    <div className="flex items-center gap-4 bg-gray-50 dark:bg-neutral-900 px-4 py-2 rounded-full border border-gray-100 dark:border-neutral-800">
                                        <button
                                            onClick={() => setModalQuantity(q => Math.max(1, q - 1))}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full text-gray-500 dark:text-neutral-300 transition-colors"
                                        >
                                            <Minus className="w-4 h-4 stroke-[2.5]" />
                                        </button>
                                        <span className="text-lg font-black text-gray-900 dark:text-white min-w-[24px] text-center">
                                            {modalQuantity}
                                        </span>
                                        <button
                                            onClick={() => setModalQuantity(q => q + 1)}
                                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full text-orange-500 dark:text-orange-400 transition-colors"
                                        >
                                            <Plus className="w-4 h-4 stroke-[2.5]" />
                                        </button>
                                    </div>
                                </div>

                                {/* Full-width Add Button */}
                                <button
                                    onClick={() => {
                                        addItem({
                                                                    owner_id: shopOwnerId ?? undefined,
                                            id: String(selectedProduct.id),
                                            title: selectedProduct.title_en,
                                            price: selectedProduct?.price ?? 0,
                                            image: selectedProduct.images?.[0],
                                            quantity: modalQuantity
                                        });
                                        setSelectedProduct(null);
                                    }}
                                    className="w-full bg-[#00a082] hover:bg-[#008f73] text-white font-black py-4 px-6 rounded-full transition-colors flex items-center justify-between text-sm shadow-md mt-4"
                                >
                                    <span>Add {modalQuantity} to order</span>
                                    <span>KSh {(selectedProduct?.price ?? 0) * (modalQuantity ?? 1).toLocaleString()}</span>
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

            {/* RATING MODAL */}
            {ratingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setRatingModalOpen(false)} />
                    <div className="relative bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 border border-gray-100 dark:border-neutral-800">
                        {/* Close button */}
                        <button
                            onClick={() => setRatingModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-neutral-300"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Rate This Shop</h2>

                        {/* Rating Stars */}
                        <div className="mb-6">
                            <p className="text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-3">Overall Rating</p>
                            <div className="flex gap-2 justify-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                        key={star}
                                        onClick={() => setUserRating(star)}
                                        className="focus:outline-none transition-transform hover:scale-110"
                                    >
                                        <Star
                                            className={`w-8 h-8 cursor-pointer ${
                                                star <= userRating
                                                    ? 'fill-yellow-400 text-yellow-400'
                                                    : 'text-gray-300 dark:text-neutral-300'
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Review Text */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">
                                Your Review
                            </label>
                            <textarea
                                value={userReview}
                                onChange={(e) => setUserReview(e.target.value)}
                                placeholder="Share your experience with this shop..."
                                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00a082] text-sm"
                                rows={4}
                            />
                        </div>

                        {/* Display Name */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">
                                Display Name
                            </label>
                            <input
                                type="text"
                                value={displayName}
                                onChange={(e) => setDisplayName(e.target.value)}
                                placeholder="Ahmed Hassan"
                                className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00a082] text-sm"
                            />
                        </div>

                        {/* Verified Purchase Checkbox */}
                        <div className="mb-6 flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="verified"
                                checked={isVerifiedPurchase}
                                onChange={(e) => setIsVerifiedPurchase(e.target.checked)}
                                className="rounded cursor-pointer"
                            />
                            <label htmlFor="verified" className="text-sm text-gray-700 dark:text-neutral-200 cursor-pointer">
                                I purchased from this shop
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={async () => {
                                if (userRating > 0 && displayName.trim()) {
                                    // Rate limiting: 24 hours between reviews
                                    if (userHasReviewed && lastReviewTime) {
                                        const hoursSinceReview = (Date.now() - lastReviewTime) / (1000 * 60 * 60);
                                        if (hoursSinceReview < 24) {
                                            alert(`You can update your review in ${Math.ceil(24 - hoursSinceReview)} hours.`);
                                            return;
                                        }
                                    }

                                    try {
                                        await api.post('/reviews', {
                                            product_id: parseInt(shopId ?? '0'),
                                            customer_name: displayName || user?.full_name || 'Anonymous',
                                            rating: userRating,
                                            comment: userReview
                                        });
                                        setUserHasReviewed(true);
                                        setLastReviewTime(Date.now());
                                        setRatingModalOpen(false);
                                        setUserRating(0);
                                        setUserReview('');
                                        setDisplayName('');
                                        setIsVerifiedPurchase(false);
                                        alert('Thank you for your review!');
                                    } catch (error) {
                                        console.error('Failed to submit review:', error);
                                        alert('Failed to submit review. Please try again.');
                                    }
                                } else {
                                    alert('Please select a rating and enter your name');
                                }
                            }}
                            className="w-full bg-[#00a082] hover:bg-[#008f73] text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
                        >
                            Submit Review
                        </button>
                    </div>
                </div>
            )}

            {/* MESSAGING MODAL */}
            {messagingModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setMessagingModalOpen(false)} />
                    <div className="relative bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10 border border-gray-100 dark:border-neutral-800">
                        <button
                            onClick={() => setMessagingModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-neutral-300"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Message {shopName}</h2>

                        <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Type your message..."
                            className="w-full h-32 p-4 border border-gray-200 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#00a082] resize-none mb-4"
                        />

                        <button
                            onClick={async () => {
                                if (!messageText.trim()) {
                                    alert('Please enter a message');
                                    return;
                                }
                                try {
                                    setIsSendingMessage(true);
                                    await api.post('/messages/', {
                                        receiver_id: shopOwnerId,
                                        content: messageText
                                    });
                                    setMessageText('');
                                    setMessagingModalOpen(false);
                                    alert('Message sent to ' + shopName + '!');
                                } catch (error) {
                                    console.error('Failed to send message:', error);
                                    alert('Failed to send message. Please try again.');
                                } finally {
                                    setIsSendingMessage(false);
                                }
                            }}
                            disabled={isSendingMessage}
                            className="w-full bg-[#00a082] hover:bg-[#008f73] disabled:bg-gray-400 text-white font-bold py-2.5 px-4 rounded-lg transition-colors"
                        >
                            {isSendingMessage ? 'Sending...' : 'Send Message'}
                        </button>
                    </div>
                </div>
            )}

</AnimatePresence>

            <LocationPickerModal
                isOpen={isLocationModalOpen}
                onClose={() => { if (city) setIsLocationModalOpen(false); }}
            />
        </div>
    );
}

