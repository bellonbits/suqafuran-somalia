"use client";

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, Search, AlertCircle, ShoppingBag, ArrowLeft, MessageSquare, Loader, CheckCircle2, HelpCircle } from 'lucide-react';
import api, { optimizeCloudinaryUrl } from '@/services/api';
import { listingsService } from '@/services/listings';
import { dealsService, type Deal } from '@/services/deals';
import { useChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/useAuth';
import { useCurrencyStore } from '@/store/useCurrency';
import { formatConvertedPrice } from '@/lib/currency';
import { useLocalizedField } from '@/lib/i18n';
import { trackEvent, trackCharge } from '@/lib/analytics';
import type { ChatMessage, Listing } from '@/types';

// A plain "hello" opener gets ignored; naming the actual product and asking
// something concrete (availability) is what actually earns a reply -- this
// is the one thing every "contact seller" tap has in common, so it's the
// one line worth writing well instead of leaving to a generic placeholder.
function buildOpeningMessage(productTitle: string): string {
    return `Hi! \u{1F44B} I just came across your listing for "${productTitle}" -- is it still available? I'd love to know a bit more.`;
}

interface Conversation {
    other_user_id: number;
    other_user_name?: string;
    other_user_avatar?: string;
    last_message?: string;
    last_message_time?: string;
    unread_count?: number;
}

function MessagesPageContent() {
    const searchParams = useSearchParams();
    const targetUserId = searchParams.get('userId');
    const sharedProductId = searchParams.get('productId');
    const field = useLocalizedField();
    const currency = useCurrencyStore((s) => s.currency);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    // The listing this thread is about -- seeded from ?productId= when
    // arriving via a "Contact Seller" tap, or recovered from the loaded
    // thread's own messages when reopening a conversation later, so the
    // product card and listing_id tagging persist across the whole chat,
    // not just the first visit.
    const [activeListingId, setActiveListingId] = useState<string | null>(null);
    const [sharedProduct, setSharedProduct] = useState<Listing | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isUserTyping, setIsUserTyping] = useState(false);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // The real auth token -- this used to read localStorage.getItem('access_token'),
    // a key nothing in the app ever writes to, so the socket never connected.
    const token = useAuthStore((s) => s.token) || '';
    const currentUser = useAuthStore((s) => s.user);
    const [deal, setDeal] = useState<Deal | null>(null);
    const [dealActionLoading, setDealActionLoading] = useState(false);

    // Initialize WebSocket connection
    const { isConnected, sendMessage: wssSendMessage, setTyping, onMessage, subscribeToUser, userStatus } = useChat(token);
    const isOtherUserOnline = userStatus?.id === selectedUserId && !!userStatus?.is_online;
    const isOtherUserTyping = userStatus?.id === selectedUserId && !!userStatus?.is_typing;

    // Load conversations from API
    useEffect(() => {
        let isFirstLoad = true;

        const loadConversations = async () => {
            try {
                // Only show the loading state for the very first fetch -- the
                // 30s background refresh below re-fetches silently so the list
                // doesn't visibly flash/reset while someone's reading it.
                if (isFirstLoad) setIsLoading(true);
                const response = await api.get('/messages/conversations');
                setConversations(response.data || []);
            } catch (error) {
                console.error('Failed to load conversations:', error);
                if (isFirstLoad) setConversations([]);
            } finally {
                if (isFirstLoad) {
                    setIsLoading(false);
                    isFirstLoad = false;
                }
            }
        };

        loadConversations();
        // Refresh conversations every 30 seconds
        const interval = setInterval(loadConversations, 30000);
        return () => clearInterval(interval);
    }, []);

    // A fresh "Contact Seller" tap carries the listing in the URL, scoped
    // to the specific conversation it was meant for -- switching to a
    // different conversation shouldn't keep tagging it onto that one too.
    useEffect(() => {
        if (sharedProductId && selectedUserId === Number(targetUserId)) {
            setActiveListingId(sharedProductId);
        }
    }, [sharedProductId, targetUserId, selectedUserId]);

    // Load and pin the product card for whichever listing this thread is
    // currently about, however that got set (URL param, or recovered from
    // the loaded thread below).
    useEffect(() => {
        if (!activeListingId) {
            setSharedProduct(null);
            return;
        }
        listingsService.getListing(activeListingId)
            .then(setSharedProduct)
            .catch(err => console.error('Failed to load shared product details', err));
    }, [activeListingId]);

    // Whichever side of this listing's conversation the viewer is on --
    // this same page is used by both buyers (via "Contact Seller") and
    // sellers (via "Open Full Messages" from their dashboard), so the
    // purchase-confirmation controls below need to know which role to show.
    const isViewerSeller = !!(currentUser && sharedProduct && currentUser.id === sharedProduct.owner_id);
    const buyerIdForDeal = isViewerSeller ? selectedUserId : currentUser?.id;

    useEffect(() => {
        if (!activeListingId || !buyerIdForDeal) {
            setDeal(null);
            return;
        }
        dealsService.getDeal(Number(activeListingId), buyerIdForDeal)
            .then(setDeal)
            .catch(() => setDeal(null));
    }, [activeListingId, buyerIdForDeal]);

    const handleMarkPurchased = async () => {
        if (!activeListingId) return;
        setDealActionLoading(true);
        try {
            const updated = await dealsService.markPurchased(Number(activeListingId));
            setDeal(updated);
        } catch (err) {
            console.error('Failed to mark as purchased', err);
        } finally {
            setDealActionLoading(false);
        }
    };

    const handleSellerConfirm = async () => {
        if (!deal) return;
        setDealActionLoading(true);
        try {
            const updated = await dealsService.sellerConfirm(deal.id);
            setDeal(updated);
            // Only the two-sided confirmation counts as a sale. `revenue`
            // is the listing's price at confirmation time -- Suqafuran
            // doesn't process payment, so there's no verified transaction
            // amount anywhere to pull instead; this is a best-effort
            // estimate, not a payment-gateway-confirmed total.
            if (updated.outcome === 'bought' && sharedProduct) {
                const revenue = sharedProduct.price ?? 0;
                trackEvent('Purchase', {
                    revenue,
                    listing_id: sharedProduct.id,
                    category_id: sharedProduct.category_id,
                    seller_id: updated.seller_id,
                });
                trackCharge(revenue, { listing_id: sharedProduct.id });
            }
        } catch (err) {
            console.error('Failed to confirm deal', err);
        } finally {
            setDealActionLoading(false);
        }
    };

    const handleSellerDeny = async () => {
        if (!deal) return;
        setDealActionLoading(true);
        try {
            const updated = await dealsService.sellerDeny(deal.id);
            setDeal(updated);
        } catch (err) {
            console.error('Failed to deny deal', err);
        } finally {
            setDealActionLoading(false);
        }
    };

    // Handle initial target user from query params. Deliberately depends
    // only on targetUserId, not on `conversations` -- the mark-as-read
    // update and the 30s poll both give `conversations` a new array
    // reference on every cycle, and including it here used to re-run this
    // effect on every such refresh.
    useEffect(() => {
        if (!targetUserId) return;
        const targetIdNum = Number(targetUserId);
        setSelectedUserId(targetIdNum);

        // Always create/fetch stub for target user, even if conversations is empty
        if (!conversations.some(c => c.other_user_id === targetIdNum)) {
            api.get(`/sellers/${targetIdNum}`)
                .then(res => {
                    const seller = res.data;
                    const stubConv: Conversation = {
                        other_user_id: targetIdNum,
                        other_user_name: seller.business_name || seller.full_name || `Seller #${targetIdNum}`,
                        other_user_avatar: seller.avatar_url,
                        last_message: 'Start a new conversation...',
                        last_message_time: new Date().toISOString(),
                        unread_count: 0
                    };
                    setConversations(prev => [stubConv, ...prev]);
                })
                .catch(() => {
                    // Fallback: create stub with just user ID
                    const stubConv: Conversation = {
                        other_user_id: targetIdNum,
                        other_user_name: `User #${targetIdNum}`,
                        last_message: 'Start a new conversation...',
                        last_message_time: new Date().toISOString(),
                        unread_count: 0
                    };
                    setConversations(prev => [stubConv, ...prev]);
                });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetUserId]);

    // Default to the first conversation on desktop when nothing is selected
    // yet. Guarded on selectedUserId being null so this never fires again
    // once the user has picked a conversation -- without that guard, any
    // later `conversations` refresh (30s poll, mark-as-read update) would
    // re-run this and snap the selection straight back to the first
    // conversation, making clicking any other conversation appear to do
    // nothing.
    useEffect(() => {
        if (targetUserId || selectedUserId !== null || conversations.length === 0) return;
        if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
            setSelectedUserId(conversations[0].other_user_id);
        }
    }, [targetUserId, selectedUserId, conversations]);

    // Load messages when selected user changes
    useEffect(() => {
        if (!selectedUserId) return;

        const loadMessages = async () => {
            try {
                setIsLoading(true);
                const response = await api.get(`/messages/${selectedUserId}`);
                const loaded: ChatMessage[] = response.data || [];
                setMessages(loaded);

                // Recover which listing this thread is about from its own
                // history, unless the URL already pins one for this exact
                // conversation (a fresh arrival from "Contact Seller").
                if (!(sharedProductId && selectedUserId === Number(targetUserId))) {
                    const withListing = [...loaded].reverse().find((m) => m.listing_id);
                    setActiveListingId(withListing ? String(withListing.listing_id) : null);
                }
            } catch (error) {
                console.error('Failed to load messages:', error);
                setMessages([]);
            } finally {
                setIsLoading(false);
            }
        };

        loadMessages();

        // Opening a conversation reads it -- clear the unread badge right
        // away instead of waiting on the next 30s conversations poll, and
        // tell the backend so it stays cleared on refresh/other devices.
        setConversations((prev) => prev.map((c) =>
            c.other_user_id === selectedUserId ? { ...c, unread_count: 0 } : c
        ));
        api.post(`/messages/${selectedUserId}/read`).catch((error) => {
            console.error('Failed to mark conversation as read:', error);
        });
    }, [selectedUserId]);

    // Pre-fill a real opening line for a brand-new, product-initiated
    // conversation -- once messages have actually loaded (so this never
    // fires while a conversation with history is still loading) and only
    // if the buyer hasn't already started typing their own.
    useEffect(() => {
        if (!isLoading && messages.length === 0 && sharedProduct && !inputText) {
            setInputText(buildOpeningMessage(field(sharedProduct.title_en, sharedProduct.title_so) || sharedProduct.title_en));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, sharedProduct]);

    // Join the per-conversation channel so the server's broadcasts (new
    // messages, typing, presence) actually reach this connection -- without
    // this, subscribing never happens and nothing arrives in real time
    // regardless of how the message handler below is wired.
    useEffect(() => {
        if (selectedUserId && isConnected) {
            subscribeToUser(selectedUserId);
        }
    }, [selectedUserId, isConnected, subscribeToUser]);

    // Handle incoming real-time messages. Re-registered whenever
    // selectedUserId changes so the closure always compares against the
    // conversation that's actually open right now.
    useEffect(() => {
        onMessage((message) => {
            if (selectedUserId && (message.sender_id === selectedUserId || message.receiver_id === selectedUserId)) {
                setMessages((prev) => [...prev, message]);
            }
            setConversations((prev) => prev.map((c) =>
                c.other_user_id === message.sender_id
                    ? { ...c, last_message: message.content, last_message_time: message.timestamp || new Date().toISOString() }
                    : c
            ));
        });
    }, [selectedUserId, onMessage]);

    // Handle typing indicator
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputText(value);

        if (!selectedUserId || !isConnected) return;

        // Send typing indicator
        if (value.trim() && !isUserTyping) {
            setIsUserTyping(true);
            setTyping(selectedUserId, true);
        }

        // Reset typing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Send stop typing after 1 second of inactivity
        if (value.trim()) {
            typingTimeoutRef.current = setTimeout(() => {
                setIsUserTyping(false);
                setTyping(selectedUserId, false);
            }, 1000);
        }
    };

    // Filter conversations by search query
    const filteredConversations = conversations.filter(conv =>
        (conv.other_user_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim() || !selectedUserId) return;

        const text = inputText.trim();
        setInputText('');
        setIsUserTyping(false);

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        try {
            setIsSending(true);
            const isNewConversation = messages.length === 0;

            // Send via HTTP first (to save to DB). Tagging every message in
            // the thread with the same listing_id (not just the first) keeps
            // them landing in the same conversation on the backend instead
            // of fragmenting into a "with listing" / "without listing" pair.
            const sendResponse = await api.post('/messages/', {
                receiver_id: selectedUserId,
                content: text,
                ...(activeListingId ? { listing_id: Number(activeListingId) } : {}),
            });

            trackEvent('Message Sent', { receiver_id: selectedUserId });
            if (isNewConversation) {
                trackEvent('Conversation Started', { receiver_id: selectedUserId });
            }

            // Then broadcast via WebSocket for instant delivery
            if (isConnected) {
                wssSendMessage(text, selectedUserId);
            }

            // Reload messages after sending
            const response = await api.get(`/messages/${selectedUserId}`);
            setMessages(response.data || []);

            // Notify typing stopped
            if (isConnected) {
                setTyping(selectedUserId, false);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            setInputText(text);
            alert('Failed to send message: ' + (error as any)?.message || 'Unknown error');
        } finally {
            setIsSending(false);
        }
    };

    const selectedConversation = conversations.find(c => c.other_user_id === selectedUserId);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 h-[calc(100vh-8rem)]">
            <div className="h-full rounded-[32px] overflow-hidden bg-white border border-gray-100 shadow-2xl dark:bg-neutral-950 dark:border-neutral-800 flex">

                {/* Conversations Left Panel */}
                <aside className={`${selectedUserId ? 'hidden md:flex' : 'flex'} w-full md:w-80 shrink-0 border-r border-gray-100 dark:border-neutral-800 flex-col h-full bg-slate-50/50 dark:bg-black/20`}>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-black text-gray-900 dark:text-neutral-50">Messages</h2>
                            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} title={isConnected ? 'Connected' : 'Disconnected'} />
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-2xl border border-gray-200 bg-white px-9 py-2 text-xs font-semibold outline-none focus:border-[#00a082] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                            Loading conversations...
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center p-4">
                            <div className="space-y-2">
                                <MessageSquare className="h-8 w-8 text-gray-300 dark:text-neutral-200 mx-auto" />
                                <p className="text-xs text-gray-400 dark:text-neutral-400">No conversations yet</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-neutral-800/50">
                            {filteredConversations.map((conv) => (
                                <button
                                    key={conv.other_user_id}
                                    onClick={() => setSelectedUserId(conv.other_user_id)}
                                    className={`w-full p-4 flex gap-3 text-left transition-all ${selectedUserId === conv.other_user_id ? 'bg-white dark:bg-neutral-950' : 'hover:bg-white/50 dark:hover:bg-neutral-950/50'}`}
                                >
                                    {conv.other_user_avatar ? (
                                        <img
                                            src={conv.other_user_avatar}
                                            alt={conv.other_user_name}
                                            className="h-11 w-11 rounded-2xl object-cover shrink-0"
                                        />
                                    ) : (
                                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shrink-0 text-white font-black text-sm">
                                            {(conv.other_user_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                        <div className="flex justify-between items-start gap-2 min-w-0">
                                            <h4 className="text-xs font-black text-gray-900 dark:text-neutral-50 truncate">
                                                {conv.other_user_name || `User ${conv.other_user_id}`}
                                            </h4>
                                            {conv.last_message_time && (
                                                <span className="text-[9px] text-gray-400 dark:text-neutral-400 font-bold shrink-0 whitespace-nowrap">
                                                    {new Date(conv.last_message_time).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-between items-center gap-2 min-w-0">
                                            <p className="text-[11px] text-gray-400 dark:text-neutral-400 truncate font-semibold">
                                                {conv.last_message || 'No messages yet'}
                                            </p>
                                            {(conv.unread_count ?? 0) > 0 && (
                                                <span className="h-4 min-w-4 px-1 rounded-full bg-[#00a082] text-white text-[9px] font-black flex items-center justify-center shrink-0">
                                                    {conv.unread_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </aside>

                {/* Conversation Right Panel */}
                <div className={`${selectedUserId ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-full bg-white dark:bg-neutral-950`}>
                    {selectedUserId && selectedConversation ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setSelectedUserId(null)} className="md:hidden -ml-1 mr-1 text-gray-400 hover:text-gray-700 dark:hover:text-neutral-100">
                                        <ArrowLeft className="h-5 w-5" />
                                    </button>
                                    {selectedConversation.other_user_avatar ? (
                                        <img
                                            src={selectedConversation.other_user_avatar}
                                            alt={selectedConversation.other_user_name}
                                            className="h-10 w-10 rounded-2xl object-cover"
                                        />
                                    ) : (
                                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-black text-xs">
                                            {(selectedConversation.other_user_name || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-xs font-black text-gray-900 dark:text-neutral-50">
                                            {selectedConversation.other_user_name || `User ${selectedConversation.other_user_id}`}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 dark:text-neutral-300">
                                            {isOtherUserTyping ? (
                                                <span className="flex items-center gap-1">
                                                    <span>typing</span>
                                                    <Loader className="h-3 w-3 animate-spin" />
                                                </span>
                                            ) : (
                                                <span>{isOtherUserOnline ? '🟢 Online' : '⚪ Offline'}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Pinned product context -- whenever this thread is
                                about a specific listing, keep it visible so
                                neither side has to scroll up to remember what
                                the conversation is actually about. */}
                            {sharedProduct && (
                                <a
                                    href={`/listing/${sharedProduct.id}`}
                                    className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-amber-50/60 dark:bg-amber-500/5 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors"
                                >
                                    <img
                                        src={optimizeCloudinaryUrl(sharedProduct.images?.[0], { width: 80 }) || sharedProduct.images?.[0]}
                                        alt={field(sharedProduct.title_en, sharedProduct.title_so) || sharedProduct.title_en}
                                        className="h-11 w-11 rounded-xl object-cover shrink-0 bg-gray-100 dark:bg-neutral-800"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                            <ShoppingBag className="h-3 w-3" /> Chatting about
                                        </p>
                                        <p className="text-xs font-black text-gray-900 dark:text-neutral-50 truncate">
                                            {field(sharedProduct.title_en, sharedProduct.title_so) || sharedProduct.title_en}
                                        </p>
                                    </div>
                                    <p className="text-xs font-black text-[#00a082] shrink-0">
                                        {formatConvertedPrice(sharedProduct.price, sharedProduct.currency, currency)}
                                    </p>
                                </a>
                            )}

                            {/* Purchase confirmation -- Suqafuran doesn't process payment,
                                so this is the only signal the platform has that a sale
                                actually happened, distinct from just "expressed interest". */}
                            {sharedProduct && !isViewerSeller && !deal && (
                                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-slate-50 dark:bg-black/20">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300 flex items-center gap-1.5">
                                        <HelpCircle className="h-3.5 w-3.5" /> Did you purchase this?
                                    </p>
                                    <button
                                        onClick={handleMarkPurchased}
                                        disabled={dealActionLoading}
                                        className="text-[11px] font-black text-white bg-[#00a082] hover:bg-[#008f73] disabled:opacity-50 rounded-full px-3 py-1.5 transition-colors"
                                    >
                                        Yes, I purchased it
                                    </button>
                                </div>
                            )}

                            {sharedProduct && !isViewerSeller && deal?.outcome === 'pending' && (
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-800 bg-amber-50/60 dark:bg-amber-500/5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                                    Waiting for the seller to confirm your purchase...
                                </div>
                            )}

                            {sharedProduct && isViewerSeller && deal?.outcome === 'pending' && (
                                <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-neutral-800 bg-slate-50 dark:bg-black/20">
                                    <p className="text-xs font-semibold text-gray-600 dark:text-neutral-300">
                                        Buyer indicated they purchased this. Confirm the sale?
                                    </p>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={handleSellerDeny}
                                            disabled={dealActionLoading}
                                            className="text-[11px] font-bold text-gray-600 dark:text-neutral-300 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 hover:bg-gray-50 disabled:opacity-50 rounded-full px-3 py-1.5 transition-colors"
                                        >
                                            I didn't sell this
                                        </button>
                                        <button
                                            onClick={handleSellerConfirm}
                                            disabled={dealActionLoading}
                                            className="text-[11px] font-black text-white bg-[#00a082] hover:bg-[#008f73] disabled:opacity-50 rounded-full px-3 py-1.5 transition-colors"
                                        >
                                            Confirm Purchase
                                        </button>
                                    </div>
                                </div>
                            )}

                            {sharedProduct && deal?.outcome === 'bought' && (
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-800 bg-emerald-50 dark:bg-emerald-500/10 text-[11px] font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Purchase confirmed
                                </div>
                            )}

                            {sharedProduct && deal?.outcome === 'not_bought' && (
                                <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900 text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                                    Marked as not purchased
                                </div>
                            )}

                            {/* Chat History View */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40 dark:bg-black/10">
                                {isLoading ? (
                                    <div className="text-center py-8 text-xs text-gray-400">Loading messages...</div>
                                ) : messages.length === 0 ? (
                                    <div className="text-center py-8 text-xs text-gray-400">No messages yet. Start the conversation!</div>
                                ) : (
                                    messages.map((msg) => {
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex ${msg.sender_id === selectedUserId ? 'justify-start' : 'justify-end'}`}
                                            >
                                                <div className={`max-w-[70%] rounded-2xl p-4 space-y-2 shadow-sm ${msg.sender_id === selectedUserId ? 'bg-white border border-gray-100 text-gray-800 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-50 rounded-bl-none' : 'bg-[#00a082] text-white rounded-br-none'}`}>
                                                    <p data-no-translate className="text-xs font-semibold leading-relaxed break-words">{msg.content}</p>
                                                    <div className="flex items-center justify-end gap-1.5 pt-0.5">
                                                        <span className="text-[8px] opacity-75 font-semibold">
                                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Chat Input form */}
                            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 dark:border-neutral-800 flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    value={inputText}
                                    onChange={handleInputChange}
                                    disabled={isSending}
                                    className="w-full rounded-2xl border border-gray-200 dark:border-neutral-800 bg-slate-50 dark:bg-black px-4 py-2.5 text-xs font-semibold outline-none focus:border-[#00a082] focus:bg-white dark:text-neutral-50 disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={isSending || !inputText.trim()}
                                    className="p-2.5 bg-[#00a082] text-white rounded-2xl shadow hover:bg-[#008f73] cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Send className="h-4.5 w-4.5" />
                                </button>
                            </form>
                        </>
                    ) : (
                        /* Empty state */
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-50/20">
                            <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-gray-300 dark:bg-black dark:text-neutral-200">
                                <MessageSquare className="h-8 w-8" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-sm font-black text-gray-900 dark:text-neutral-50">No Conversation Selected</h3>
                                <p className="text-xs text-gray-400 dark:text-neutral-400 font-semibold max-w-xs leading-relaxed">
                                    Select a conversation from the sidebar or start a new message.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading Messages...</div>}>
            <MessagesPageContent />
        </Suspense>
    );
}
