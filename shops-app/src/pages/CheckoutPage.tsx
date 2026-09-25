"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/store/useCart';
import { useLocationStore } from '@/store/useLocation';
import { useAuthStore } from '@/store/useAuth';
import api from '@/services/api';
import { ChevronLeft, MapPin, Download, Send, Phone, CheckCircle, AlertCircle, Map as MapIcon, Package, User, DollarSign, BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';

import { FaWhatsapp } from 'react-icons/fa';
import { MdMessage } from 'react-icons/md';
import { messageService } from '@/services/messageService';
import { checkoutReceiptService } from '@/services/checkoutReceipt';
import { trackEvent } from '@/lib/analytics';
interface CheckoutItem {
  id: string;
  title: string;
  title_en?: string;
  price: number;
  images?: string[];
  quantity?: number;
  owner_id?: string | number;
  owner?: {
    full_name: string;
    phone: string;
    email?: string;
    avatar_url?: string;
  };
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items: cartItems, getTotalPrice, clearCart } = useCart();
  const { city } = useLocationStore();
  const { user, isAuthenticated } = useAuthStore();

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [receiptGenerated, setReceiptGenerated] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerName, setBuyerName] = useState(user?.full_name || '');
  const [isProcessing, setIsProcessing] = useState(false);
  // Map of owner_id -> { phone, full_name } fetched from backend
  const [sellerInfoMap, setSellerInfoMap] = useState<Record<string, { phone: string; full_name: string }>>({});
  // Map of owner_id -> backend checkout receipt id, created when the buyer
  // proceeds — used to attribute WhatsApp/call/message clicks to a real order.
  const [receiptsBySellerId, setReceiptsBySellerId] = useState<Record<string, number>>({});
  const receiptRef = useRef<HTMLDivElement>(null);

  // Fetch seller info (phone) for cart items that don't have it embedded
  useEffect(() => {
    const ownerIds = [...new Set(
      cartItems
        .filter((item: any) => item.owner_id && !item.owner?.phone)
        .map((item: any) => String(item.owner_id))
    )];
    if (ownerIds.length === 0) return;

    ownerIds.forEach(async (ownerId) => {
      try {
        const profileRes = await api.get(`/sellers/${ownerId}`);
        const phone = profileRes?.data?.phone || '';
        const full_name = profileRes?.data?.business_name || profileRes?.data?.full_name || 'Seller';
        setSellerInfoMap(prev => ({ ...prev, [ownerId]: { phone, full_name } }));
      } catch {
        // ignore — WhatsApp will still open without a phone number
      }
    });
  }, [cartItems]);

  // Get buyer's current location
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            address: city || `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
          });
          setLocationLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setCurrentLocation({
            lat: 2.0469,
            lng: 45.3182,
            address: city || 'Mogadishu, Somalia',
          });
          setLocationLoading(false);
        }
      );
    }
  }, [city]);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Cart Empty</h2>
          <p className="text-gray-600 dark:text-neutral-300 mb-6">Add items to your cart before checking out.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-full"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  const subtotal = getTotalPrice();
  const platformFee = Math.round(subtotal * 0.02); // 2% platform fee only
  const total = subtotal + platformFee;

  const generateReceipt = () => {
    const itemsText = cartItems
      .map((item: CheckoutItem, idx: number) => `${idx + 1}. ${item.title || item.title_en || 'Product'} - ${(item?.price || 0).toLocaleString()}`)
      .join('\n');

    const receipt = `SUQAFURAN ORDER RECEIPT
========================================

ORDER #${orderNumber}
Date: ${new Date().toLocaleString()}

BUYER INFORMATION
Name: ${buyerName}
Phone: ${buyerPhone}
Location: ${currentLocation?.address}

ITEMS
${itemsText}

PRICING
Subtotal: ${subtotal.toLocaleString()}
Platform Fee (2%): ${platformFee}
TOTAL: ${total.toLocaleString()}

HOW IT WORKS
This is a P2P (peer-to-peer) transaction.

1. You have shared your location with the seller
2. Contact the seller via WhatsApp or message
3. Discuss and agree on:
   - Meeting location and time
   - Payment method
   - Product condition and quantity
4. Complete the transaction directly

Suqafuran's role: Connect buyers and sellers
Your payment: Directly with seller (not through platform)
Your delivery: Arrange with seller

========================================
    `;

    return receipt;
  };

  const downloadReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      // Dynamic import to avoid SSR/bundle constructor issues
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `receipt-${orderNumber}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Failed to download receipt');
    }
  };

  const handleProceed = async () => {
    if (!buyerName.trim()) {
      alert('Please enter your name');
      return;
    }
    if (!buyerPhone.trim()) {
      alert('Please enter your phone number');
      return;
    }

    const newOrderNumber = `ORD-${Date.now()}`;
    setOrderNumber(newOrderNumber);
    setReceiptGenerated(true);

    // Create a real backend receipt per seller in the cart, so admins can see
    // actual checkout activity and whether the buyer went on to contact the
    // seller. Best-effort — a failure here shouldn't block the buyer's flow.
    try {
      const groups = new Map<string, { items: CheckoutItem[]; total: number }>();
      (cartItems as any[]).forEach((item) => {
        const ownerId = String(item.owner_id || '');
        if (!ownerId) return;
        if (!groups.has(ownerId)) groups.set(ownerId, { items: [], total: 0 });
        const group = groups.get(ownerId)!;
        group.items.push(item);
        group.total += (item.price || 0) * (item.quantity || 1);
      });

      const receiptEntries = await Promise.all(
        Array.from(groups.entries()).map(async ([ownerId, group]) => {
          const receipt = await checkoutReceiptService.createReceipt(
            Number(ownerId),
            group.items.map((item) => ({
              listing_id: Number(item.id),
              title: item.title || item.title_en || 'Product',
              price: item.price || 0,
              quantity: item.quantity || 1,
            })),
            group.total
          );
          return [ownerId, receipt.id] as const;
        })
      );
      setReceiptsBySellerId(Object.fromEntries(receiptEntries));
    } catch (error) {
      console.error('Failed to create checkout receipt:', error);
    }
  };

  const handleContactSeller = (method: 'whatsapp' | 'call' | 'message') => {
    if (!receiptGenerated) {
      alert('Please generate receipt first');
      return;
    }

    // Suqafuran is peer-to-peer -- there's no in-app payment/checkout
    // completion, so "contacted the seller with real purchase intent" is
    // the closest thing to a completed-deal signal available client-side.
    trackEvent('Contacted Seller', { method, cart_size: (cartItems as any[]).length });

    // Group items by seller, using embedded owner data or sellerInfoMap fallback
    type SellerGroup = { phone: string; name: string; items: any[] };
    const sellerGroups = new Map<string, SellerGroup>();
    (cartItems as any[]).forEach((item) => {
      const ownerId = String(item.owner_id || '');
      const infoFromMap = ownerId ? sellerInfoMap[ownerId] : null;
      const phone = item.owner?.phone || infoFromMap?.phone || '';
      const name = item.owner?.full_name || infoFromMap?.full_name || 'Seller';
      const sellerId = phone || name;
      if (!sellerGroups.has(sellerId)) {
        sellerGroups.set(sellerId, { phone, name, items: [] });
      }
      sellerGroups.get(sellerId)!.items.push(item);
    });

    // Build message even if no seller phone (use generic fallback)
    const firstSeller: SellerGroup = sellerGroups.size > 0
      ? Array.from(sellerGroups.values())[0]
      : { phone: '', name: 'Seller', items: cartItems as any[] };

    // Log this contact against the real backend receipt for that seller, so
    // admins can see whether the buyer actually followed up (best-effort).
    const firstSellerOwnerId = String(firstSeller.items[0]?.owner_id || '');
    const receiptId = receiptsBySellerId[firstSellerOwnerId];
    if (receiptId) {
      checkoutReceiptService.trackContact(receiptId, method);
    }

    const itemsList = (firstSeller.items as CheckoutItem[])
      .map((item) => `• ${item.title || item.title_en || 'Product'} - $ ${(item?.price || 0).toLocaleString()}`)
      .join('\n');

    const message = `Hi ${firstSeller.name},

I'm interested in your products:
${itemsList}

📍 MY LOCATION:
${currentLocation?.address}

MY DETAILS:
Name: ${buyerName}
Phone: ${buyerPhone}

Order #: ${orderNumber}
Total Amount: $ ${total.toLocaleString()}

Please let me know about availability and we can arrange payment and meeting location.

Thanks!`;

    if (method === 'whatsapp') {
      const encodedMessage = encodeURIComponent(message);
      if (firstSeller.phone) {
        let whatsappPhone = firstSeller.phone.replace(/\D/g, '');
        if (whatsappPhone.startsWith('0')) {
          whatsappPhone = '254' + whatsappPhone.substring(1);
        } else if (!whatsappPhone.startsWith('254')) {
          whatsappPhone = '254' + whatsappPhone;
        }
        window.open(`https://wa.me/${whatsappPhone}?text=${encodedMessage}`, '_blank');
      } else {
        // No phone — open WhatsApp without a pre-filled number so buyer can choose
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      }
    } else if (method === 'call') {
      if (firstSeller.phone) {
        window.location.href = `tel:${firstSeller.phone}`;
      } else {
        alert("This seller's phone number isn't available");
      }
    } else if (method === 'message') {
      setIsProcessing(true);
      // Send message to the first seller
      const sellerId = firstSeller.items[0]?.owner_id || firstSeller.items[0]?.seller_id;
      if (sellerId) {
        messageService.sendMessage({
          receiver_id: sellerId,
          content: message,
          listing_id: firstSeller.items[0]?.id
        }).then(() => {
          setIsProcessing(false);
          router.push(`/messages?userId=${sellerId}`);
        }).catch((error) => {
          console.error('Failed to send message:', error);
          setIsProcessing(false);
          // Still route to messages even if sending fails
          router.push(`/messages?userId=${sellerId}`);
        });
      } else {
        setIsProcessing(false);
        router.push('/messages');
      }
    }
  };

  const handleWhatsApp = () => {
    handleContactSeller('whatsapp');
  };

  const handleCall = () => {
    handleContactSeller('call');
  };

  const handleMessage = () => {
    handleContactSeller('message');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800">
        <div className="px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white">Checkout</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Step 1: Buyer Info & Location */}
        {!receiptGenerated && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Buyer Information */}
            <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Your Information</h2>

              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <input
                  type="tel"
                  placeholder="Phone Number (e.g., +252 61 XXX XXXX)"
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Location Display with Map Info */}
            <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Location</h2>
              </div>

              {locationLoading ? (
                <div className="text-center py-4">
                  <p className="text-gray-600 dark:text-neutral-300">Getting your location...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Location Display */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📍 Your Location</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-lg">{currentLocation?.address}</p>
                  </div>

                  {/* Map Link */}
                  <a
                    href={`https://maps.google.com/?q=${currentLocation?.lat},${currentLocation?.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-400 font-bold py-3 rounded-lg transition-colors"
                  >
                    <MapIcon className="w-4 h-4" />
                    View on Google Maps
                  </a>

                  <p className="text-xs text-gray-600 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 p-3 rounded-lg">
                    ℹ️ Your location will be shared with the seller so they know where you're located. You'll arrange the exact meeting point directly with them.
                  </p>
                </div>
              )}
            </div>

            {/* Order Summary */}
            <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4">
                {cartItems.map((item: CheckoutItem) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white">{item.title || item.title_en || 'Product'}</p>
                      <p className="text-sm text-gray-600 dark:text-neutral-300">from {item.owner?.full_name}</p>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white">KSh {(item?.price || 0).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-2">
                <div className="flex justify-between text-gray-700 dark:text-neutral-300">
                  <span>Subtotal</span>
                  <span>KSh {subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-700 dark:text-neutral-300">
                  <span>Platform Fee (2%)</span>
                  <span>KSh {platformFee}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-neutral-800">
                  <span>Total</span>
                  <span className="text-orange-600">KSh {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Proceed Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProceed}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              Generate Receipt & Continue
            </motion.button>
          </motion.div>
        )}

        {/* Step 2: Receipt Generated - Contact Seller */}
        {receiptGenerated && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Success Message */}
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-6 h-6 text-green-600 mt-1 shrink-0" />
                <div>
                  <h3 className="font-bold text-green-900 dark:text-green-300 mb-2">Receipt Generated!</h3>
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    Order #${orderNumber} has been created. Now contact the seller(s) to arrange payment and meeting location.
                  </p>
                </div>
              </div>
            </div>

            {/* Receipt Preview - Ticket Style */}
            <div className="flex justify-center py-8">
              <div className="w-full max-w-2xl">
                {/* Receipt Card */}
                <div ref={receiptRef} className="bg-white dark:bg-neutral-950 rounded-3xl p-8 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl relative">
                  {/* Perforated edges left */}
                  <div className="absolute left-0 top-1/4 w-4 h-4 bg-gray-50 dark:bg-black rounded-full transform -translate-x-2"></div>
                  <div className="absolute left-0 bottom-1/4 w-4 h-4 bg-gray-50 dark:bg-black rounded-full transform -translate-x-2"></div>

                  {/* Perforated edges right */}
                  <div className="absolute right-0 top-1/4 w-4 h-4 bg-gray-50 dark:bg-black rounded-full transform translate-x-2"></div>
                  <div className="absolute right-0 bottom-1/4 w-4 h-4 bg-gray-50 dark:bg-black rounded-full transform translate-x-2"></div>

                  {/* Content */}
                  <div className="text-center space-y-6">
                    {/* Logo & Celebration */}
                    <div className="flex justify-center">
                      <img src="/icon1.png" alt="Suqafuran" className="h-12 w-auto object-contain" />
                    </div>

                    {/* Thank You Message */}
                    <div>
                      <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">Thank you!</h2>
                      <p className="text-gray-600 dark:text-neutral-300 text-sm">Your order has been created</p>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 dark:border-neutral-700 pt-6"></div>

                    {/* Order ID, Amount, Date & Time - 3 Columns */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-left">
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Order ID</p>
                        <p className="text-lg font-black text-gray-900 dark:text-white break-all">{orderNumber}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Total</p>
                        <p className="text-lg font-black text-orange-600">${total.toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Date & Time</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>

                    {/* Buyer Info */}
                    <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-orange-600" />
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Buyer Information</p>
                      </div>
                      <div className="space-y-2 text-left text-sm">
                        <p><span className="font-semibold text-gray-900 dark:text-white">{buyerName}</span></p>
                        <p className="text-gray-600 dark:text-neutral-300">{buyerPhone}</p>
                      </div>
                    </div>

                    {/* Location Link */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Your Location</p>
                      </div>
                      <a 
                        href={`https://maps.google.com/maps?q=${currentLocation?.lat},${currentLocation?.lng}&z=15`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-semibold break-all text-center block"
                      >
                        {currentLocation?.address}
                      </a>
                    </div>

                    {/* Items List - Detailed */}
                    <div className="text-left bg-gray-50 dark:bg-neutral-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="w-4 h-4 text-orange-600" />
                        <p className="text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">Items ({cartItems.length})</p>
                      </div>
                      <div className="space-y-3">
                        {cartItems && cartItems.length > 0 ? (
                          cartItems.map((item: CheckoutItem, idx: number) => (
                            <div key={item.id} className="pb-3 mb-3 border-b border-gray-300 dark:border-neutral-800 last:border-b-0">
                              <div className="flex justify-between items-start gap-3">
                                <div className="flex-1 min-w-0 pr-2">
                                  <p className="font-bold text-gray-900 dark:text-white text-base leading-tight mb-2">
                                    {item.title || item.title_en || 'Product' || 'Product'}
                                  </p>
                                  {item.owner && (
                                    <p className="text-xs text-gray-500 dark:text-neutral-300 mb-1">from {item.owner.full_name}</p>
                                  )}
                                </div>
                                <div className="text-right whitespace-nowrap">
                                  <p className="font-bold text-orange-600 dark:text-orange-500 text-base">{(item?.price || 0).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-600 dark:text-neutral-300 text-sm">No items in order</p>
                        )}
                      </div>

                      {/* Pricing Summary */}
                      <div className="border-t border-gray-300 dark:border-neutral-800 mt-4 pt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-neutral-300">Subtotal</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-neutral-300">Platform Fee (2%)</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{platformFee}</span>
                        </div>
                        <div className="flex justify-between border-t border-gray-300 dark:border-neutral-800 pt-2 text-base">
                          <span className="font-bold text-gray-900 dark:text-white">Grand Total</span>
                          <span className="font-black text-orange-600 text-lg">{total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 dark:border-neutral-700"></div>

                    {/* Barcode */}
                    <div className="flex justify-center py-4">
                      <div className="text-center">
                        <div className="font-mono text-xs text-gray-600 dark:text-neutral-300 mb-2">{orderNumber}</div>
                        <svg
                          width="200"
                          height="50"
                          viewBox="0 0 200 50"
                          className="mx-auto"
                        >
                          <rect width="200" height="50" fill="white" className="dark:fill-neutral-100" />
                          {[...Array(50)].map((_, i) => (
                            <line
                              key={i}
                              x1={i * 4}
                              y1="10"
                              x2={i * 4}
                              y2="35"
                              stroke="#000"
                              strokeWidth={Math.random() > 0.5 ? 2 : 1}
                              className="dark:stroke-white"
                            />
                          ))}
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadReceipt}
                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                <Download className="w-5 h-5" />
                Download
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const receipt = generateReceipt();
                  navigator.clipboard.writeText(receipt);
                  alert('Receipt copied to clipboard!');
                }}
                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                <Send className="w-5 h-5" />
                Copy
              </motion.button>
            </div>

            {/* Contact Seller Section */}
            <div className="bg-white dark:bg-neutral-950 rounded-2xl p-6 border border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Contact Seller(s)</h2>
              <p className="text-gray-600 dark:text-neutral-300 mb-6">Choose how you want to contact the seller. They'll see your location and order details.</p>

              <div className="flex items-center justify-center gap-8">
                <motion.button
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleWhatsApp}
                  className="text-[#25D366] hover:text-[#20BA5A] transition-colors p-2"
                  title="Contact via WhatsApp"
                >
                  <FaWhatsapp className="w-12 h-12" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleCall}
                  className="text-emerald-500 hover:text-emerald-600 transition-colors p-2"
                  title="Contact via Phone Call"
                >
                  <Phone className="w-12 h-12" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleMessage}
                  disabled={isProcessing}
                  className="text-blue-500 hover:text-blue-600 disabled:opacity-50 transition-colors p-2"
                  title="Contact via Message"
                >
                  <MdMessage className="w-12 h-12" />
                </motion.button>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-2xl p-6">
              <p className="text-blue-900 dark:text-blue-300 text-sm leading-relaxed">
                <strong>How it works:</strong> You've shared your location with the seller. They can see exactly where you are on the map. Contact them to confirm the meeting point, payment method, and complete the transaction directly.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
