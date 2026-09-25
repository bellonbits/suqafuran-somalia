"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { orderService, Order } from '@/services/orderService';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Package, Truck, MapPin, Clock, AlertCircle, Star, CheckCircle, X, MessageSquare, Trash2, Send, Phone } from 'lucide-react';

export default function OrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showRating, setShowRating] = useState(false);
    const [showIssueReport, setShowIssueReport] = useState(false);
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [cancellationReason, setCancellationReason] = useState('');
    const [refundStatus, setRefundStatus] = useState<any>(null);
    const [rating, setRating] = useState(0);
    const [ratingValue, setRatingValue] = useState(0);
    const [reviewText, setReviewText] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);
    const [issueType, setIssueType] = useState<'item_mismatch' | 'damaged' | 'missing_items' | 'other'>('item_mismatch');
    const [issueDescription, setIssueDescription] = useState('');

    const handleSubmitRating = async () => {
        if (!selectedOrder || ratingValue === 0) return;
        setSubmittingRating(true);
        try {
            await orderService.rateDelivery(selectedOrder.id, ratingValue, reviewText);
            setShowRating(false);
            setRatingValue(0);
            setReviewText('');
        } catch (err) {
            console.error('Failed to submit rating:', err);
        } finally {
            setSubmittingRating(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const data = await orderService.getOrders({ limit: 50 });
            setOrders(data);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: Order['status']) => {
        const colors: Record<Order['status'], string> = {
            pending: 'bg-yellow-100 text-yellow-700',
            payment_pending: 'bg-red-100 text-red-700',
            confirmed: 'bg-[#e0f7ff] text-blue-700',
            preparing: 'bg-purple-100 text-purple-700',
            ready_for_pickup: 'bg-green-100 text-green-700',
            in_delivery: 'bg-[#e0f7ff] text-blue-700',
            delivered: 'bg-green-100 text-green-700',
            cancelled: 'bg-gray-100 text-gray-700',
        };
        return colors[status] || 'bg-gray-100 text-gray-700';
    };

    const getStatusIcon = (status: Order['status']) => {
        switch (status) {
            case 'preparing':
            case 'confirmed':
                return <Package className="w-5 h-5" />;
            case 'in_delivery':
                return <Truck className="w-5 h-5" />;
            case 'delivered':
            case 'ready_for_pickup':
                return <CheckCircle className="w-5 h-5" />;
            default:
                return <Clock className="w-5 h-5" />;
        }
    };

    const getStatusLabel = (status: Order['status']) => {
        const labels: Record<Order['status'], string> = {
            pending: 'Pending',
            payment_pending: 'Awaiting Payment',
            confirmed: 'Confirmed',
            preparing: 'Preparing',
            ready_for_pickup: 'Ready for Pickup',
            in_delivery: 'In Delivery',
            delivered: 'Delivered',
            cancelled: 'Cancelled',
        };
        return labels[status] || status;
    };

    const handleRateDelivery = async () => {
        if (!selectedOrder || rating === 0) return;
        try {
            await orderService.rateDelivery(selectedOrder.id, rating);
            setShowRating(false);
            setRating(0);
            fetchOrders();
        } catch (error) {
            console.error('Failed to submit rating:', error);
        }
    };

    const handleReportIssue = async () => {
        if (!selectedOrder || !issueDescription) return;
        try {
            await orderService.reportIssue(selectedOrder.id, {
                issue_type: issueType,
                description: issueDescription,
            });
            setShowIssueReport(false);
            setIssueDescription('');
            fetchOrders();
        } catch (error) {
            console.error('Failed to report issue:', error);
        }
    };

    const handleCancelOrder = async () => {
        if (!selectedOrder || !cancellationReason) return;
        try {
            const response = await api.post(`/orders/${selectedOrder.id}/cancel`, {
                reason: cancellationReason
            });
            alert('✓ Order cancelled. Refund is being processed.');
            setShowCancelDialog(false);
            setCancellationReason('');
            await fetchRefundStatus();
            fetchOrders();
        } catch (error: any) {
            alert(`Error: ${error.response?.data?.detail || 'Failed to cancel order'}`);
        }
    };

    const fetchRefundStatus = async () => {
        if (!selectedOrder) return;
        try {
            const response = await api.get(`/orders/${selectedOrder.id}/refund-status`);
            setRefundStatus(response.data);
        } catch (error) {
            console.error('Failed to fetch refund status:', error);
        }
    };

    const processRefund = async () => {
        if (!selectedOrder) return;
        try {
            const response = await api.post(`/orders/${selectedOrder.id}/process-refund`);
            alert('✓ Refund processed successfully!');
            await fetchRefundStatus();
        } catch (error: any) {
            alert(`Error: ${error.response?.data?.detail || 'Failed to process refund'}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading orders...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-2">Your Orders</h1>
                    <p className="text-gray-600 dark:text-gray-400">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-neutral-950 rounded-2xl">
                        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-2">No orders yet</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">Start shopping to see your orders here</p>
                        <button
                            onClick={() => router.push('/')}
                            className="bg-[#5bc0e8] hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-full"
                        >
                            Browse Shops
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map((order) => (
                            <motion.div
                                key={order.id}
                                whileHover={{ y: -2 }}
                                onClick={() => setSelectedOrder(order)}
                                className="bg-white dark:bg-neutral-950 rounded-2xl p-6 cursor-pointer shadow-sm hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Order #{order.id.slice(0, 8)}</p>
                                        <p className="text-xl font-black text-gray-900 dark:text-white">KSh {order.total_amount.toLocaleString()}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getStatusColor(order.status)}`}>
                                        {getStatusIcon(order.status)}
                                        <span className="font-bold text-sm">{getStatusLabel(order.status)}</span>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {order.items.slice(0, 3).map((item, idx) => (
                                            <span key={idx} className="text-xs bg-gray-100 dark:bg-neutral-900 px-2 py-1 rounded">
                                                {item.title}
                                            </span>
                                        ))}
                                        {order.items.length > 3 && (
                                            <span className="text-xs bg-gray-100 dark:bg-neutral-900 px-2 py-1 rounded">
                                                +{order.items.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        {order.delivery_option === 'delivery' ? (
                                            <>
                                                <Truck className="w-4 h-4" />
                                                <span>Delivery</span>
                                            </>
                                        ) : (
                                            <>
                                                <MapPin className="w-4 h-4" />
                                                <span>Pickup</span>
                                            </>
                                        )}
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Order Details Modal */}
                <AnimatePresence>
                    {selectedOrder && (
                        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <motion.div
                                initial={{ y: 100, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 100, opacity: 0 }}
                                className="bg-white dark:bg-neutral-950 rounded-3xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                            >
                                {/* Header */}
                                <div className="sticky top-0 bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 p-6 flex items-center justify-between">
                                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">Order #{selectedOrder.id.slice(0, 8)}</h2>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-full"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="p-6 space-y-6">
                                    {/* Status Timeline */}
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-900 dark:text-white">Order Status</h3>
                                        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${getStatusColor(selectedOrder.status)}`}>
                                            {getStatusIcon(selectedOrder.status)}
                                            <div>
                                                <p className="font-bold">{getStatusLabel(selectedOrder.status)}</p>
                                                <p className="text-sm opacity-75">
                                                    {new Date(selectedOrder.updated_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Payment Method */}
                                    <div className="space-y-2">
                                        <h3 className="font-bold text-gray-900 dark:text-white">Payment Method</h3>
                                        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg font-semibold ${
                                            selectedOrder.payment_method === 'mpesa'
                                                ? 'bg-[#e0f7ff] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                        }`}>
                                            {selectedOrder.payment_method === 'mpesa' ? (
                                                <>
                                                    <Send className="w-4 h-4" />
                                                    <span>M-Pesa</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Phone className="w-4 h-4" />
                                                    <span>Pay on Delivery</span>
                                                </>
                                            )}
                                        </div>
                                        {selectedOrder.payment_method === 'cash_on_delivery' && (
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Payment will be collected by the rider when the package is delivered
                                            </p>
                                        )}
                                    </div>

                                    {/* Order Items */}
                                    <div className="space-y-4">
                                        <h3 className="font-bold text-gray-900 dark:text-white">Items</h3>
                                        <div className="space-y-2">
                                            {selectedOrder.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-100 dark:bg-neutral-900 rounded-lg">
                                                    <div>
                                                        <p className="font-semibold text-gray-900 dark:text-white">{item.title}</p>
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">Qty: {item.quantity}</p>
                                                    </div>
                                                    <p className="font-bold text-gray-900 dark:text-white">KSh {(item?.price ?? 0) * (item?.quantity ?? 0).toLocaleString()}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pricing Breakdown */}
                                    <div className="space-y-2 p-4 bg-gray-100 dark:bg-neutral-900 rounded-lg">
                                        <div className="flex justify-between text-gray-900 dark:text-white">
                                            <span>Subtotal</span>
                                            <span>KSh {(selectedOrder.total_amount - selectedOrder.platform_fee).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-gray-600 dark:text-gray-400 text-sm">
                                            <span>Platform Fee (10%)</span>
                                            <span>KSh {selectedOrder.platform_fee.toLocaleString()}</span>
                                        </div>
                                        <div className="border-t border-gray-300 dark:border-neutral-800 pt-2 flex justify-between font-bold text-gray-900 dark:text-white">
                                            <span>Total</span>
                                            <span>KSh {selectedOrder.total_amount.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    {/* Delivery Info */}
                                    {selectedOrder.delivery_option === 'delivery' && selectedOrder.delivery_address && (
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-gray-900 dark:text-white">Delivery Address</h3>
                                            <p className="text-gray-600 dark:text-gray-400">{selectedOrder.delivery_address}</p>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-neutral-800">
                                        {selectedOrder.status === 'delivered' && !showRating && (
                                            <button
                                                onClick={() => setShowRating(true)}
                                                className="w-full bg-[#5bc0e8] hover:bg-sky-700 text-white font-bold py-3 rounded-full flex items-center justify-center gap-2"
                                            >
                                                <Star className="w-5 h-5" />
                                                Rate Delivery
                                            </button>
                                        )}

                                        {selectedOrder.status === 'delivered' && !showIssueReport && (
                                            <button
                                                onClick={() => setShowIssueReport(true)}
                                                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-full flex items-center justify-center gap-2"
                                            >
                                                <AlertCircle className="w-5 h-5" />
                                                Report an Issue
                                            </button>
                                        )}

                                        {(selectedOrder.status === 'preparing' || selectedOrder.status === 'in_delivery') && (
                                            <button className="w-full bg-[#e0f7ff] hover:bg-blue-200 text-blue-700 font-bold py-3 rounded-full flex items-center justify-center gap-2">
                                                <MessageSquare className="w-5 h-5" />
                                                Contact Seller
                                            </button>
                                        )}

                                        {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'preparing' || selectedOrder.status === 'ready_for_pickup') && !showCancelDialog && (
                                            <button
                                                onClick={() => setShowCancelDialog(true)}
                                                className="w-full bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-full flex items-center justify-center gap-2"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                                Cancel Order
                                            </button>
                                        )}
                                    </div>

                                    {/* Rating Section */}
                                    {showRating && (
                                        <div className="space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <h4 className="font-bold text-gray-900 dark:text-white">Rate Your Delivery</h4>
                                            <div className="flex gap-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        onClick={() => setRating(star)}
                                                        className={`text-3xl ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                                                    >
                                                        ★
                                                    </button>
                                                ))}
                                            </div>
                                            <button
                                                onClick={handleRateDelivery}
                                                disabled={rating === 0}
                                                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg"
                                            >
                                                Submit Rating
                                            </button>
                                        </div>
                                    )}

                                    {/* Rating Section */}
                                    {showRating && selectedOrder.status === 'delivered' && (
                                        <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            <h4 className="font-bold text-gray-900 dark:text-white">Rate Your Experience</h4>
                                            
                                            {/* Star Rating */}
                                            <div className="flex gap-2 justify-center">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <button
                                                        key={star}
                                                        onClick={() => setRatingValue(star)}
                                                        className="text-3xl transition-transform hover:scale-110"
                                                    >
                                                        {star <= ratingValue ? '' : ''}
                                                    </button>
                                                ))}
                                            </div>
                                            
                                            {ratingValue > 0 && (
                                                <div className="text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    {ratingValue === 5 && 'Excellent! '}
                                                    {ratingValue === 4 && 'Great! 😊'}
                                                    {ratingValue === 3 && 'Good '}
                                                    {ratingValue === 2 && 'Fair '}
                                                    {ratingValue === 1 && 'Poor 😞'}
                                                </div>
                                            )}

                                            {/* Review Text */}
                                            <textarea
                                                placeholder="Share your experience (optional)..."
                                                value={reviewText}
                                                onChange={(e) => setReviewText(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                                rows={3}
                                            />

                                            {/* Buttons */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setShowRating(false);
                                                        setRatingValue(0);
                                                        setReviewText('');
                                                    }}
                                                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 rounded-lg"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSubmitRating}
                                                    disabled={ratingValue === 0 || submittingRating}
                                                    className="flex-1 bg-[#5bc0e8] hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg"
                                                >
                                                    {submittingRating ? 'Submitting...' : 'Submit Rating'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Issue Report Section */}
                                    {showIssueReport && (
                                        <div className="space-y-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <h4 className="font-bold text-gray-900 dark:text-white">Report an Issue</h4>
                                            <select
                                                value={issueType}
                                                onChange={(e) => setIssueType(e.target.value as any)}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                            >
                                                <option value="item_mismatch">Item doesn't match listing</option>
                                                <option value="damaged">Item is damaged</option>
                                                <option value="missing_items">Missing items</option>
                                                <option value="other">Other issue</option>
                                            </select>
                                            <textarea
                                                placeholder="Describe the issue..."
                                                value={issueDescription}
                                                onChange={(e) => setIssueDescription(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                                rows={3}
                                            />
                                            <button
                                                onClick={handleReportIssue}
                                                disabled={!issueDescription}
                                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg"
                                            >
                                                Report Issue
                                            </button>
                                        </div>
                                    )}

                                    {/* Cancel Order Dialog */}
                                    {showCancelDialog && (
                                        <div className="space-y-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <h4 className="font-bold text-gray-900 dark:text-white">Cancel Order</h4>
                                            <textarea
                                                placeholder="Reason for cancellation..."
                                                value={cancellationReason}
                                                onChange={(e) => setCancellationReason(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 dark:border-neutral-800 rounded-lg bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                                                rows={3}
                                            />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setShowCancelDialog(false)}
                                                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-2 rounded-lg"
                                                >
                                                    Keep Order
                                                </button>
                                                <button
                                                    onClick={handleCancelOrder}
                                                    disabled={!cancellationReason}
                                                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-2 rounded-lg"
                                                >
                                                    Confirm Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment on Delivery Prompt */}
                                    {selectedOrder.payment_method === 'cash_on_delivery' && selectedOrder.status === 'in_delivery' && selectedOrder.payment_status === 'pending_at_delivery' && (
                                        <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <Clock className="w-5 h-5 text-[#5bc0e8]" />
                                                Ready to Pay
                                            </h4>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                                The rider is on their way! You'll receive an M-Pesa payment prompt on your phone when they arrive.
                                            </p>
                                            <p className="text-lg font-bold text-gray-900 dark:text-white">
                                                Amount to pay: KSh {selectedOrder.total_amount.toLocaleString()}
                                            </p>
                                            <div className="bg-white dark:bg-neutral-900 p-3 rounded text-sm text-gray-700 dark:text-gray-300 space-y-1">
                                                <p><strong>What to do:</strong></p>
                                                <ol className="list-decimal list-inside space-y-1">
                                                    <li>Verify the delivery address with the rider</li>
                                                    <li>Accept the M-Pesa payment prompt on your phone</li>
                                                    <li>Complete the payment</li>
                                                    <li>Receive your order</li>
                                                </ol>
                                            </div>
                                        </div>
                                    )}

                                    {/* Payment Awaiting */}
                                    {selectedOrder.payment_method === 'cash_on_delivery' && selectedOrder.status === 'in_delivery' && selectedOrder.payment_status === 'awaiting_payment' && (
                                        <div className="space-y-2 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-300 dark:border-orange-700">
                                            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                <AlertCircle className="w-5 h-5 text-orange-600" />
                                                Complete Your Payment
                                            </h4>
                                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                                The rider has arrived! Check your phone for the M-Pesa payment prompt.
                                            </p>
                                            <p className="text-lg font-bold text-orange-700 dark:text-orange-300">
                                                Pay: KSh {selectedOrder.total_amount.toLocaleString()}
                                            </p>
                                            <button
                                                onClick={() => {
                                                    alert('M-Pesa payment prompt should appear on your phone. Complete the payment to finish the delivery.');
                                                }}
                                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-sm"
                                            >
                                                I Received Payment Prompt
                                            </button>
                                        </div>
                                    )}

                                    {/* Refund Status */}
                                    {selectedOrder.status === 'cancelled' && (
                                        <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <h4 className="font-bold text-gray-900 dark:text-white">Refund Status</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">Your order has been cancelled. A refund of KSh {selectedOrder.total_amount.toLocaleString()} is being processed.</p>
                                            <button
                                                onClick={() => fetchRefundStatus()}
                                                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 rounded-lg text-sm"
                                            >
                                                Check Refund Status
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
