"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useLocation } from 'react-router-dom';
import { useRouter } from 'next/navigation';
import {
    MapPin, ShieldCheck, Phone, Heart, Share2, MessageSquare, ArrowLeft, Eye, Star, X,
    AlertTriangle, Minus, Plus, ShoppingCart, Store, CheckCircle2, Check,
} from 'lucide-react';
import api, { optimizeCloudinaryUrl } from '@/services/api';
import { listingsService, makeShopSlug } from '@/services/listings';
import { feedbackService, averageRating } from '@/services/feedback';
import { analyticsService } from '@/services/analytics';
import { useTrackItemView } from '@/hooks/useViewTracking';
import { useFavoritesStore } from '@/store/useFavorites';
import { useAuthStore } from '@/store/useAuth';
import { useAuthModal } from '@/store/useAuthModal';
import { useCurrencyStore } from '@/store/useCurrency';
import { useCart } from '@/store/useCart';
import { formatConvertedPrice } from '@/lib/currency';
import { useLocalizedField } from '@/lib/i18n';
import { ProductCard } from '@/components/features/ProductCard';
import { checkoutReceiptService } from '@/services/checkoutReceipt';
import { messageService } from '@/services/messageService';
import { trackEvent } from '@/lib/analytics';
import type { Listing, Feedback } from '@/types';


type DetailTab = 'description' | 'specs' | 'seller';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=600&auto=format&fit=crop';

export default function ProductDetailPage() {
    const router = useRouter();
    const { id = '' } = useParams<{ id: string }>();
    const location = useLocation();

    // Preload listing from router state, individual cache, or global listings cache
    // so clicking a product renders IMMEDIATELY (0ms, no lag, no skeleton).
    const getPreload = (): Listing | null => {
        const preloaded = (location.state as { listing?: Listing } | null)?.listing;
        if (preloaded && String(preloaded.id) === String(id)) return preloaded;

        if (typeof window !== 'undefined') {
            try {
                // 1. Direct listing cache
                const direct = localStorage.getItem(`listing:${id}`);
                if (direct) {
                    const parsed = JSON.parse(direct);
                    if (parsed.value) return parsed.value;
                }
                // 2. Scan all listings cache keys
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('listings:')) {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const data = JSON.parse(raw);
                            if (Array.isArray(data.value)) {
                                const match = data.value.find((l: any) => String(l.id) === String(id));
                                if (match) return match;
                            }
                        }
                    }
                }
            } catch (e) {}
        }
        return null;
    };

    const [listing, setListing] = useState<Listing | null>(() => getPreload());
    const [relatedListings, setRelatedListings] = useState<Listing[]>([]);
    const [categoryName, setCategoryName] = useState('');
    const [activeImage, setActiveImage] = useState(() => getPreload()?.images?.[0] || '');
    const [isLoading, setIsLoading] = useState(() => !getPreload());
    const [loadError, setLoadError] = useState(false);

    const [feedback, setFeedback] = useState<Feedback[]>([]);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportDescription, setReportDescription] = useState('');

    const [activeTab, setActiveTab] = useState<DetailTab>('description');
    const [quantity, setQuantity] = useState(1);
    const [addedToCart, setAddedToCart] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showOrderModal, setShowOrderModal] = useState(false);
    const [orderLocation, setOrderLocation] = useState('');
    const [orderNotes, setOrderNotes] = useState('');
    const [submittingOrder, setSubmittingOrder] = useState(false);
    const [orderPlaced, setOrderPlaced] = useState(false);
    const [orderError, setOrderError] = useState('');

    const { isAuthenticated } = useAuthStore();
    const openAuthModal = useAuthModal((s) => s.open);
    const isFavorite = useFavoritesStore((s) => listing ? s.isFavorite(listing.id) : false);
    const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
    const displayCurrency = useCurrencyStore((s) => s.currency);
    const addCartItem = useCart((s) => s.addItem);
    const field = useLocalizedField();

    useTrackItemView(listing?.id || 0);

    useEffect(() => {
        if (!listing) return;
        trackEvent('Product Viewed', {
            listing_id: listing.id,
            category_id: listing.category_id,
            price: listing.price,
            seller_id: listing.owner_id,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [listing?.id]);

    useEffect(() => {
        setLoadError(false);
        setFeedback([]);
        setRelatedListings([]);
        setCategoryName('');

        // Navigating here from a related-listing card while already on a
        // detail page (same route, component doesn't remount) -- apply its
        // preloaded data immediately too, same as the lazy useState above
        // does for the very first mount.
        const preloaded = getPreload();
        if (preloaded) {
            setListing(preloaded);
            setQuantity(1);
            setAddedToCart(false);
            setActiveTab('description');
            setActiveImage(preloaded.images?.[0] || FALLBACK_IMAGE);
            setIsLoading(false);
            document.title = `${field(preloaded.title_en, preloaded.title_so) || preloaded.title_en} | Suqafuran`;
        } else {
            setIsLoading(true);
        }

        const loadListingDetails = async () => {
            let data: Listing;
            try {
                data = await listingsService.getListing(id);
            } catch (err) {
                console.error('Failed to load listing details', err);
                if (!preloaded) {
                    setListing(null);
                    setLoadError(true);
                }
                setIsLoading(false);
                return;
            }

            // Render the page now that the one thing it actually needs is
            // in hand -- reviews, related listings and the category label
            // are all supplementary and shouldn't hold up the product itself.
            setListing(data);
            setQuantity(1);
            setAddedToCart(false);
            setActiveTab('description');
            setActiveImage(data.images && data.images.length > 0 ? data.images[0] : FALLBACK_IMAGE);
            setIsLoading(false);
            document.title = `${field(data.title_en, data.title_so) || data.title_en} | Suqafuran`;

            feedbackService.getListingFeedback(data.id).then(setFeedback).catch(() => setFeedback([]));

            listingsService.getCategories().then((categories) => {
                const cat = (categories || []).find((c: any) => c.id === data.category_id);
                setCategoryName(cat?.name_en || '');
            }).catch(() => {});

            // Related listings -- same category first, since an unscoped
            // fetch isn't actually "related" to anything. Backfill with
            // other active listings if the category alone doesn't have
            // enough to reach a full row/two of results.
            listingsService.getListings({ category_id: data.category_id, limit: 16 }).then(async (sameCategory) => {
                let related = sameCategory.filter((r) => r.id !== data.id);
                if (related.length < 10) {
                    const backfillPool = await listingsService.getListings({ limit: 16 }).catch(() => []);
                    const excludeIds = new Set([data.id, ...related.map((r) => r.id)]);
                    related = [...related, ...backfillPool.filter((r) => !excludeIds.has(r.id))];
                }
                setRelatedListings(related.slice(0, 15));
            }).catch(() => {});
        };
        loadListingDetails();

        return () => {
            document.title = "Suqafuran - Africa's Marketplace";
        };
    }, [id]);

    // Product structured data (schema.org) for search-engine rich results --
    // kept as a separate effect, keyed on `listing`, so it updates whether
    // the page rendered from preload or from the real fetch.
    useEffect(() => {
        if (!listing || typeof document === 'undefined') return;

        const productName = field(listing.title_en, listing.title_so) || listing.title_en;
        const schema: Record<string, any> = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: productName,
            description: field(listing.description_en, listing.description_so) || listing.description_en,
            image: listing.images && listing.images.length > 0 ? listing.images : undefined,
            sku: String(listing.id),
            offers: {
                '@type': 'Offer',
                price: listing.price,
                priceCurrency: listing.currency || 'USD',
                availability: listing.is_sold || listing.status !== 'active'
                    ? 'https://schema.org/OutOfStock'
                    : 'https://schema.org/InStock',
                url: `https://suqafuran.so/listings/${listing.id}`,
            },
        };

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.id = 'listing-product-schema';
        script.text = JSON.stringify(schema);

        const existing = document.getElementById('listing-product-schema');
        if (existing) existing.remove();
        document.head.appendChild(script);

        return () => {
            document.getElementById('listing-product-schema')?.remove();
        };
    }, [listing]);

    const handleToggleFavorite = () => {
        if (!listing) return;
        if (!isAuthenticated) {
            openAuthModal('signin');
            return;
        }
        if (!isFavorite) {
            analyticsService.trackClick({
                event_type: 'favorite',
                listing_id: listing.id,
                shop_id: listing.owner_id,
                device_type: analyticsService.getDeviceType(),
            }).catch(() => {});
            trackEvent('Added to Wishlist', { listing_id: listing.id, price: listing.price });
        }
        toggleFavorite(listing.id);
    };

    const handleSubmitReview = async () => {
        if (!listing?.owner) return;
        if (!isAuthenticated) {
            openAuthModal('signin');
            return;
        }
        setSubmittingReview(true);
        try {
            await feedbackService.createFeedback({
                target_user_id: listing.owner_id,
                listing_id: listing.id,
                rating: reviewRating,
                comment: reviewComment.trim() || undefined,
            });
            const refreshed = await feedbackService.getListingFeedback(listing.id);
            setFeedback(refreshed);
            setReviewComment('');
            setReviewRating(5);
        } catch (err) {
            console.error('Failed to submit review', err);
        } finally {
            setSubmittingReview(false);
        }
    };

    const handleSubmitReport = async () => {
        if (!listing || !reportReason) return;
        if (!isAuthenticated) {
            openAuthModal('signin');
            return;
        }
        try {
            await api.post('/listings/report', {
                listing_id: listing.id,
                reason: reportReason,
                description: reportDescription.trim() || undefined,
            });
            setShowReportModal(false);
            setReportReason('');
            setReportDescription('');
            alert('Thank you for your report!');
        } catch (err: any) {
            console.error('Failed to submit report', err);
            alert(err?.response?.data?.detail || 'Failed to submit report. Please try again.');
        }
    };

    const ratingAvg = averageRating(feedback);

    const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
        const count = feedback.filter((f) => Math.round(f.rating) === star).length;
        return { star, count, pct: feedback.length > 0 ? Math.round((count / feedback.length) * 100) : 0 };
    });

    const handleAddToCart = () => {
        if (!listing) return;
        addCartItem({
            id: String(listing.id),
            title: field(listing.title_en, listing.title_so) || listing.title_en,
            price: listing?.price ?? 0,
            quantity,
            image: activeImage,
            owner_id: listing.owner_id,
        });
        trackEvent('Add to Cart', {
            listing_id: listing.id,
            price: listing.price,
            quantity,
            cart_size: useCart.getState().items.length,
        });
        setAddedToCart(true);
    };

    const galleryTouchStartX = useRef<number | null>(null);
    const galleryTouchDeltaX = useRef(0);

    const goToImage = (delta: number) => {
        if (!listing?.images || listing.images.length <= 1) return;
        const currentIndex = Math.max(0, listing.images.indexOf(activeImage));
        const nextIndex = (currentIndex + delta + listing.images.length) % listing.images.length;
        setActiveImage(listing.images[nextIndex]);
    };

    const handleGalleryTouchStart = (e: React.TouchEvent) => {
        galleryTouchStartX.current = e.touches[0].clientX;
        galleryTouchDeltaX.current = 0;
    };

    const handleGalleryTouchMove = (e: React.TouchEvent) => {
        if (galleryTouchStartX.current === null) return;
        galleryTouchDeltaX.current = e.touches[0].clientX - galleryTouchStartX.current;
    };

    const handleGalleryTouchEnd = () => {
        const SWIPE_THRESHOLD = 50;
        if (galleryTouchDeltaX.current > SWIPE_THRESHOLD) goToImage(-1);
        else if (galleryTouchDeltaX.current < -SWIPE_THRESHOLD) goToImage(1);
        galleryTouchStartX.current = null;
        galleryTouchDeltaX.current = 0;
    };

    const shareTitle = listing ? (field(listing.title_en, listing.title_so) || listing.title_en) : '';
    // Never use window.location.href/origin for share links -- inside the
    // native app the WebView's origin is capacitor://localhost (or
    // http://localhost), not the real site. Always build from the real
    // domain plus the current path so shared links actually work for
    // recipients and can be crawled for a preview.
    const shareUrl = typeof window !== 'undefined' ? `https://suqafuran.so${window.location.pathname}${window.location.search}` : '';

    const handleNativeShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({ title: shareTitle, url: shareUrl });
            } catch (err) {
                // User dismissed the share sheet -- not an error worth logging.
            }
            return;
        }
        try {
            await navigator.clipboard.writeText(shareUrl);
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy link', err);
        }
    };

    const shareToX = () => {
        const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const shareToWhatsApp = () => {
        const url = `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleOrderSubmit = async () => {
        if (!listing) return;
        if (!isAuthenticated) {
            openAuthModal('signin');
            return;
        }
        setSubmittingOrder(true);
        setOrderError('');
        try {
            const itemTitle = field(listing.title_en, listing.title_so) || listing.title_en;
            await checkoutReceiptService.createReceipt(
                listing.owner_id,
                [{ listing_id: listing.id, title: itemTitle, price: listing.price ?? 0, quantity }],
                (listing.price ?? 0) * quantity,
            );

            // Relay the meetup/delivery details to the seller via chat --
            // the receipt itself has no location/notes fields (this
            // marketplace is chat-first, not a delivery/logistics system).
            const messageLines = [
                `I'd like to buy: ${quantity} x ${itemTitle}.`,
                orderLocation.trim() ? `Delivery/meetup location: ${orderLocation.trim()}` : null,
                orderNotes.trim() ? `Notes: ${orderNotes.trim()}` : null,
            ].filter(Boolean);
            messageService.sendMessage({
                receiver_id: listing.owner_id,
                listing_id: listing.id,
                content: messageLines.join('\n'),
            }).catch((err) => console.error('Order placed, but failed to message seller', err));

            setOrderPlaced(true);
        } catch (err) {
            console.error('Failed to place order', err);
            setOrderError('Could not place your order right now. Please try again, or message the seller directly.');
        } finally {
            setSubmittingOrder(false);
        }
    };

    if (isLoading) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-8 animate-pulse space-y-8 pb-24">
                <div className="h-6 w-32 bg-gray-200 dark:bg-neutral-900 rounded-full" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 aspect-square bg-gray-200 dark:bg-neutral-900 rounded-lg" />
                    <div className="md:col-span-2 space-y-6">
                        <div className="h-8 bg-gray-200 dark:bg-neutral-900 rounded-xl" />
                        <div className="h-6 w-1/4 bg-gray-200 dark:bg-neutral-900 rounded-xl" />
                        <div className="h-24 bg-gray-200 dark:bg-neutral-900 rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!listing) {
        return (
            <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4">
                <p className="font-bold text-gray-500">
                    {loadError ? 'Could not load this listing. Please try again.' : 'Listing not found'}
                </p>
                <Link href="/" className="text-primary font-black hover:underline">Go Home</Link>
            </div>
        );
    }

    const isSold = listing.is_sold || listing.status !== 'active';
    const sellerName = listing.owner?.business_name || listing.owner?.full_name || 'Shop';
    const sellerSlug = listing.owner ? makeShopSlug(sellerName, listing.owner_id) : '';
    const hasDiscount = typeof listing.compare_at_price === 'number' && listing.compare_at_price > (listing.price ?? 0);
    const discountPct = hasDiscount ? Math.round((1 - (listing.price ?? 0) / (listing.compare_at_price as number)) * 100) : 0;

    return (
        <div className="pb-28 md:pb-0 bg-gray-50 dark:bg-black min-h-screen">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
                {/* Header Navigation */}
                <button
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 dark:text-neutral-300 dark:hover:text-white"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                </button>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-8 bg-white dark:bg-neutral-950 rounded-2xl p-4 md:p-8">
                    {/* Left: Image gallery */}
                    <div className="md:col-span-2 space-y-3">
                        <div
                            className="aspect-square overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-neutral-900 relative touch-pan-y"
                            onTouchStart={handleGalleryTouchStart}
                            onTouchMove={handleGalleryTouchMove}
                            onTouchEnd={handleGalleryTouchEnd}
                        >
                            <img
                                src={optimizeCloudinaryUrl(activeImage, { width: 900 }) || activeImage}
                                alt={field(listing.title_en, listing.title_so)}
                                // This is the listing page's LCP element.
                                loading="eager"
                                fetchPriority="high"
                                decoding="async"
                                className="h-full w-full object-cover"
                            />
                            {isSold && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <span className="bg-white text-gray-900 font-black text-sm px-4 py-1.5 rounded-full uppercase tracking-wide">Sold</span>
                                </div>
                            )}
                        </div>
                        {listing.images && listing.images.length > 1 && (
                            <>
                                {/* Mobile: swipe + small pagination dots instead of a thumbnail strip */}
                                <div className="flex md:hidden justify-center gap-1.5">
                                    {listing.images.slice(0, 8).map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImage(img)}
                                            aria-label={`Go to image ${idx + 1}`}
                                            className={`h-1.5 rounded-full transition-all ${activeImage === img ? 'w-4 bg-orange-500' : 'w-1.5 bg-gray-300 dark:bg-neutral-700'}`}
                                        />
                                    ))}
                                </div>
                                {/* Desktop: thumbnail strip */}
                                <div className="hidden md:flex gap-2 overflow-x-auto pb-1">
                                    {listing.images.slice(0, 6).map((img, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setActiveImage(img)}
                                            className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${activeImage === img ? 'border-orange-500' : 'border-gray-200 dark:border-neutral-800'}`}
                                        >
                                            <img src={optimizeCloudinaryUrl(img, { width: 100 }) || img} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" />
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right: Info + purchase panel */}
                    <div className="md:col-span-3 space-y-5">
                        <div>
                            {categoryName && (
                                <div className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1.5">
                                    {categoryName}
                                </div>
                            )}
                            <h1 data-no-translate className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">
                                {field(listing.title_en, listing.title_so)}
                            </h1>

                            <div className="flex items-center gap-3 flex-wrap">
                                {ratingAvg !== null ? (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={`h-4 w-4 ${i < Math.round(ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-neutral-300'}`} />
                                            ))}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">
                                            {ratingAvg.toFixed(1)} ({feedback.length} {feedback.length === 1 ? 'review' : 'reviews'})
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-500 dark:text-neutral-300">No ratings yet</span>
                                )}
                                {typeof listing.views === 'number' && (
                                    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-400">
                                        <Eye className="h-3.5 w-3.5" /> {listing.views} views
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Price */}
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-3xl font-black text-gray-900 dark:text-white">
                                {formatConvertedPrice(listing?.price ?? 0, listing.currency || 'USD', displayCurrency)}
                            </span>
                            {hasDiscount && (
                                <>
                                    <span className="text-sm text-gray-400 dark:text-neutral-400 line-through">
                                        {formatConvertedPrice(listing.compare_at_price as number, listing.currency || 'USD', displayCurrency)}
                                    </span>
                                    <span className="text-xs font-bold text-white bg-red-500 px-2 py-1 rounded-full">
                                        {discountPct}% OFF
                                    </span>
                                </>
                            )}
                            {listing.is_negotiable && (
                                <span className="text-xs font-bold text-gray-500 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-900 px-2 py-1 rounded-full">Negotiable</span>
                            )}
                        </div>

                        {/* Quantity */}
                        {!isSold && (
                            <div>
                                <div className="text-xs font-bold text-gray-700 dark:text-neutral-200 mb-2 uppercase tracking-wide">Quantity</div>
                                <div className="inline-flex items-center gap-3 border border-gray-200 dark:border-neutral-800 rounded-full px-1 py-1">
                                    <button
                                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-bold text-gray-900 dark:text-white">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900 transition-colors"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Secondary links */}
                        <div className="flex items-center gap-4 text-sm">
                            {listing.owner && (
                                <Link href={`/shop/${sellerSlug}`} className="flex items-center gap-1.5 font-semibold text-gray-700 dark:text-neutral-200 hover:text-orange-600 dark:hover:text-orange-400">
                                    <Store className="h-4 w-4" /> View Shop
                                </Link>
                            )}
                            <button
                                onClick={handleToggleFavorite}
                                className={`flex items-center gap-1.5 font-semibold ${isFavorite ? 'text-red-500' : 'text-gray-700 dark:text-neutral-200 hover:text-red-500'}`}
                            >
                                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                                {isFavorite ? 'Wishlisted' : 'Add to Wishlist'}
                            </button>
                        </div>

                        {/* Primary CTAs (desktop) */}
                        {!isSold && (
                            <div className="hidden md:flex gap-3">
                                <button
                                    onClick={handleAddToCart}
                                    className="flex-1 flex items-center justify-center gap-2 rounded-full border-2 border-orange-500 text-orange-600 dark:text-orange-400 font-black py-3 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    {addedToCart ? 'Added!' : 'Add to Cart'}
                                </button>
                                <button
                                    onClick={() => { setOrderPlaced(false); setOrderError(''); setShowOrderModal(true); }}
                                    className="flex-1 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 transition-colors"
                                >
                                    Buy Now
                                </button>
                            </div>
                        )}

                        {/* Trust badges */}
                        <div className="flex items-center gap-4 flex-wrap text-xs font-semibold text-gray-600 dark:text-neutral-300">
                            <span className="flex items-center gap-1">
                                <Check className="h-3.5 w-3.5 text-green-600" /> Secure purchase
                            </span>
                            {listing.owner?.is_verified && (
                                <span className="flex items-center gap-1">
                                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Seller verified
                                </span>
                            )}
                            <span className="flex items-center gap-1">
                                <Check className="h-3.5 w-3.5 text-green-600" /> Buyer protection
                            </span>
                        </div>

                        <Link
                            href={`/messages?userId=${listing.owner_id}&productId=${listing.id}`}
                            onClick={() => analyticsService.trackClick({
                                event_type: 'chat',
                                listing_id: listing.id,
                                shop_id: listing.owner_id,
                                device_type: analyticsService.getDeviceType(),
                            }).catch(() => {})}
                            className="flex items-center justify-center gap-2 w-full rounded-full bg-gray-900 dark:bg-neutral-900 text-white font-bold py-2.5 text-sm hover:bg-gray-800 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <MessageSquare className="h-4 w-4" />
                            Contact Seller
                        </Link>

                        {/* Location chip */}
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-300">
                            <MapPin className="h-3.5 w-3.5" /> {listing.location || 'Somalia'}
                        </div>

                        {/* Share + Report */}
                        <div className="flex items-center justify-between border-t border-gray-200 dark:border-neutral-800 pt-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-gray-700 dark:text-neutral-200 mr-1">Share:</span>
                                <button
                                    onClick={handleNativeShare}
                                    aria-label={linkCopied ? 'Link copied' : 'Share this listing'}
                                    className="h-8 w-8 rounded-full border border-gray-200 dark:border-neutral-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
                                >
                                    {linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4 text-blue-600" />}
                                </button>
                                <button
                                    onClick={shareToX}
                                    aria-label="Share on X"
                                    className="h-8 w-8 rounded-full border border-gray-200 dark:border-neutral-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
                                >
                                    <X className="h-4 w-4 text-gray-900 dark:text-white" />
                                </button>
                                <button
                                    onClick={shareToWhatsApp}
                                    aria-label="Share on WhatsApp"
                                    className="h-8 w-8 rounded-full border border-gray-200 dark:border-neutral-800 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
                                >
                                    <img src="/whatsapp-icon.png" alt="" className="h-4 w-4" />
                                </button>
                            </div>
                            <button
                                onClick={() => setShowReportModal(true)}
                                className="text-xs text-gray-500 dark:text-neutral-300 hover:underline font-medium flex items-center gap-1"
                            >
                                <AlertTriangle className="h-3 w-3" />
                                Report
                            </button>
                        </div>
                    </div>
                </div>

                {/* Detail Tabs */}
                <div className="bg-white dark:bg-neutral-950 rounded-2xl p-4 md:p-8">
                    <div className="flex gap-6 border-b border-gray-200 dark:border-neutral-800 mb-5">
                        {([
                            { key: 'description', label: 'Description' },
                            { key: 'specs', label: 'Specs' },
                            { key: 'seller', label: 'Seller' },
                        ] as { key: DetailTab; label: string }[]).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === tab.key ? 'border-orange-500 text-gray-900 dark:text-white' : 'border-transparent text-gray-400 dark:text-neutral-400 hover:text-gray-600 dark:hover:text-neutral-200'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'description' && (
                        <p data-no-translate className="text-sm text-gray-700 dark:text-neutral-200 whitespace-pre-line leading-relaxed">
                            {field(listing.description_en, listing.description_so)}
                        </p>
                    )}

                    {activeTab === 'specs' && (
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                            {[
                                ['Condition', listing.condition],
                                ['Category', categoryName || '—'],
                                ['Location', listing.location],
                                ['Posted', new Date(listing.created_at).toLocaleDateString()],
                                ['Negotiable', listing.is_negotiable ? 'Yes' : 'No'],
                            ].map(([label, value]) => (
                                <div key={label} className="flex justify-between border-b border-gray-100 dark:border-neutral-800 pb-2">
                                    <dt className="text-sm text-gray-500 dark:text-neutral-300">{label}</dt>
                                    <dd className="text-sm font-semibold text-gray-900 dark:text-white">{value}</dd>
                                </div>
                            ))}
                        </dl>
                    )}

                    {activeTab === 'seller' && listing.owner && (
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
                                    {sellerName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-gray-900 dark:text-white">{sellerName}</span>
                                        {listing.owner.is_verified && <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-neutral-300">
                                        {ratingAvg !== null ? `${ratingAvg.toFixed(1)}★ rated seller` : 'New seller'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {listing.owner.phone && (
                                    <a
                                        href={`tel:${listing.owner.phone}`}
                                        onClick={() => analyticsService.trackClick({
                                            event_type: 'call',
                                            listing_id: listing.id,
                                            shop_id: listing.owner_id,
                                            device_type: analyticsService.getDeviceType(),
                                        }).catch(() => {})}
                                        className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 rounded-full px-4 py-2 text-xs font-bold text-gray-700 dark:text-neutral-200 transition-all"
                                    >
                                        <Phone className="h-3.5 w-3.5" /> Call
                                    </a>
                                )}
                                <Link href={`/shop/${sellerSlug}`} className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 rounded-full px-4 py-2 text-xs font-bold text-white transition-all">
                                    <Store className="h-3.5 w-3.5" /> View Shop
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Ratings & Reviews */}
                <div className="bg-white dark:bg-neutral-950 rounded-2xl p-4 md:p-8">
                    <h2 className="text-lg font-black text-gray-900 dark:text-white mb-6">Ratings & Reviews</h2>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                        <div className="md:col-span-2 flex md:flex-col items-center md:items-start gap-4 md:gap-2">
                            <div className="text-4xl font-black text-gray-900 dark:text-white">
                                {ratingAvg !== null ? ratingAvg.toFixed(1) : '—'}
                            </div>
                            <div>
                                <div className="flex items-center gap-0.5 mb-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Star key={i} className={`h-4 w-4 ${ratingAvg !== null && i < Math.round(ratingAvg) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-neutral-300'}`} />
                                    ))}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-neutral-300">{feedback.length} {feedback.length === 1 ? 'review' : 'reviews'}</div>
                            </div>
                        </div>

                        <div className="md:col-span-3 space-y-1.5">
                            {ratingBreakdown.map(({ star, count, pct }) => (
                                <div key={star} className="flex items-center gap-2 text-xs">
                                    <span className="flex items-center gap-0.5 w-8 shrink-0 font-semibold text-gray-600 dark:text-neutral-300">
                                        {star} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                    </span>
                                    <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-neutral-900 overflow-hidden">
                                        <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="w-6 text-right text-gray-400 dark:text-neutral-400 shrink-0">{count}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {feedback.length > 0 && (
                        <div className="space-y-4 mt-8 pt-6 border-t border-gray-100 dark:border-neutral-800">
                            {feedback.slice(0, 5).map((f) => (
                                <div key={f.id} className="pb-4 border-b border-gray-100 dark:border-neutral-800 last:border-b-0">
                                    <div className="flex items-center gap-2 mb-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star key={i} className={`h-3.5 w-3.5 ${i < f.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-neutral-300'}`} />
                                        ))}
                                        <span className="text-xs text-gray-400 dark:text-neutral-400 ml-1">{new Date(f.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {f.comment && <p className="text-sm text-gray-700 dark:text-neutral-200">{f.comment}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Write a review */}
                    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-neutral-800">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Write a review</h3>
                        <div className="flex items-center gap-1 mb-3">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <button key={i} onClick={() => setReviewRating(i + 1)} aria-label={`Rate ${i + 1} stars`}>
                                    <Star className={`h-6 w-6 transition-colors ${i < reviewRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-neutral-300'}`} />
                                </button>
                            ))}
                        </div>
                        <textarea
                            value={reviewComment}
                            onChange={(e) => setReviewComment(e.target.value)}
                            placeholder="Share your experience with this item or seller..."
                            rows={3}
                            className="w-full rounded-xl border border-gray-200 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white px-4 py-3 text-sm focus:outline-none focus:border-orange-500 resize-none mb-3"
                        />
                        <button
                            onClick={handleSubmitReview}
                            disabled={submittingReview}
                            className="rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm px-6 py-2.5 transition-colors"
                        >
                            {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </div>
                </div>

                {/* Related Listings */}
                {relatedListings.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Related Listings</h2>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                            {relatedListings.map(rel => (
                                <ProductCard key={rel.id} listing={rel} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Sticky mobile action bar */}
            {!isSold && (
                <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white dark:bg-neutral-950 border-t border-gray-200 dark:border-neutral-800 p-3 flex items-center gap-2">
                    <div className="flex-shrink-0 pr-1">
                        <div className="text-sm font-black text-gray-900 dark:text-white whitespace-nowrap">
                            {formatConvertedPrice(listing?.price ?? 0, listing.currency || 'USD', displayCurrency)}
                        </div>
                    </div>
                    <button
                        onClick={handleAddToCart}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full border-2 border-orange-500 text-orange-600 dark:text-orange-400 font-black py-2.5 text-sm"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        {addedToCart ? 'Added!' : 'Add to Cart'}
                    </button>
                    <button
                        onClick={() => { setOrderPlaced(false); setOrderError(''); setShowOrderModal(true); }}
                        className="flex-1 rounded-full bg-orange-500 text-white font-black py-2.5 text-sm"
                    >
                        Buy Now
                    </button>
                </div>
            )}

            {/* Buy Now / Order Modal */}
            {showOrderModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
                    <div className="bg-white dark:bg-neutral-950 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        {orderPlaced ? (
                            <div className="text-center py-6 space-y-3">
                                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order request sent!</h2>
                                <p className="text-sm text-gray-500 dark:text-neutral-300">
                                    We've recorded your order and sent the seller a message with your delivery details. They'll reach out to confirm.
                                </p>
                                <button
                                    onClick={() => setShowOrderModal(false)}
                                    className="mt-2 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm px-6 py-2.5 transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Confirm your order</h2>
                                <div className="flex items-center justify-between bg-gray-50 dark:bg-neutral-900 rounded-xl p-3">
                                    <span className="text-sm font-semibold text-gray-700 dark:text-neutral-200">{quantity} × {field(listing.title_en, listing.title_so)}</span>
                                    <span className="text-sm font-black text-gray-900 dark:text-white">
                                        {formatConvertedPrice((listing.price ?? 0) * quantity, listing.currency || 'USD', displayCurrency)}
                                    </span>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Delivery / meetup location</label>
                                    <input
                                        type="text"
                                        value={orderLocation}
                                        onChange={(e) => setOrderLocation(e.target.value)}
                                        placeholder="e.g. Mogadishu, Bakaara Market"
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">Notes (optional)</label>
                                    <textarea
                                        value={orderNotes}
                                        onChange={(e) => setOrderNotes(e.target.value)}
                                        placeholder="Anything the seller should know..."
                                        rows={3}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                                    />
                                </div>
                                {orderError && (
                                    <p className="text-sm text-red-600 dark:text-red-400 font-semibold">{orderError}</p>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <button
                                        onClick={() => setShowOrderModal(false)}
                                        className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 text-gray-700 dark:text-neutral-200 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleOrderSubmit}
                                        disabled={!orderLocation.trim() || submittingOrder}
                                        className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold transition-all"
                                    >
                                        {submittingOrder ? 'Placing...' : 'Place Order'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Report Listing Modal */}
            {showReportModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center">
                    <div className="bg-white dark:bg-neutral-950 rounded-t-2xl md:rounded-2xl w-full md:w-full md:max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Report this product</h2>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">
                                What's the problem?
                            </label>
                            <select
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-orange-500"
                            >
                                <option value="">Select a reason...</option>
                                <option value="incorrect_info">Incorrect product information</option>
                                <option value="not_available">Product not available</option>
                                <option value="duplicate">Duplicate listing</option>
                                <option value="fraud">Suspected fraud</option>
                                <option value="offensive">Offensive content</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-neutral-200 mb-2">
                                Additional details (optional)
                            </label>
                            <textarea
                                value={reportDescription}
                                onChange={(e) => setReportDescription(e.target.value)}
                                placeholder="Please provide more information..."
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                                rows={4}
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                onClick={() => {
                                    setShowReportModal(false);
                                    setReportReason('');
                                    setReportDescription('');
                                }}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-800 text-gray-700 dark:text-neutral-200 font-semibold hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmitReport}
                                disabled={!reportReason}
                                className="flex-1 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-semibold transition-all"
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
