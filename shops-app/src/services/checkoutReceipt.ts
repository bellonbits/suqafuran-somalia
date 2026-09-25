import api from './api';

export interface ReceiptItem {
  listing_id?: number;
  title: string;
  price: number;
  quantity: number;
}

export interface CheckoutReceipt {
  id: number;
  buyer_id: number;
  seller_id: number;
  items: ReceiptItem[];
  total_amount: number;
  created_at: string;
}

export type ContactType = 'whatsapp' | 'call' | 'message';

export const checkoutReceiptService = {
  async createReceipt(sellerId: number, items: ReceiptItem[], totalAmount: number): Promise<CheckoutReceipt> {
    const { data } = await api.post('/checkout-receipts/', {
      seller_id: sellerId,
      items,
      total_amount: totalAmount,
    });
    return data;
  },

  async trackContact(receiptId: number, type: ContactType): Promise<void> {
    try {
      await api.post('/interactions/', { receipt_id: receiptId, type });
    } catch (error) {
      // Don't block the actual contact action (WhatsApp/call/message) on tracking failure
      console.error('Failed to track contact interaction:', error);
    }
  },
};

export default checkoutReceiptService;
