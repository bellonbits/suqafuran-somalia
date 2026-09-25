import api from './api';

export interface SellerNotification {
  sellerPhone: string;
  sellerName: string;
  sellerEmail?: string;
  orderNumber: string;
  buyerName: string;
  buyerPhone: string;
  buyerLocation: string;
  items: Array<{
    id: number;
    title: string;
    price: number;
    image?: string;
  }>;
  total: number;
  message?: string;
}

/**
 * Send WhatsApp notification to seller
 * Integrates with Twilio or similar WhatsApp Business API
 */
export const sendWhatsAppNotification = async (notification: SellerNotification) => {
  try {
    const itemsList = notification.items
      .map((item) => `• ${item.title} - $ ${(item?.price ?? 0).toLocaleString()}`)
      .join('\n');

    const message = `
🛍️ NEW ORDER RECEIVED

Order #: ${notification.orderNumber}

PRODUCTS:
${itemsList}

TOTAL: $ ${notification.total.toLocaleString()}

👤 BUYER DETAILS:
Name: ${notification.buyerName}
Phone: ${notification.buyerPhone}
Location: ${notification.buyerLocation}

💬 The buyer will contact you shortly to arrange payment and meeting location.

This is a P2P transaction on Suqafuran Marketplace.
Please confirm and discuss details directly with the buyer.

---
Suqafuran Marketplace
Connecting buyers and sellers across Somalia
    `.trim();

    // Log message (in production, this would call WhatsApp API)
    console.log('[WHATSAPP NOTIFICATION QUEUED]', {
      sellerPhone: notification.sellerPhone,
      message: message
    });

    // In production, integrate with:
    // - Twilio WhatsApp Business API
    // - Vonage WhatsApp integration
    // - AWS SNS
    // - Firebase Cloud Messaging

    return { success: true, method: 'whatsapp' };
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return { success: false, error };
  }
};

/**
 * Send SMS notification to seller
 * Integrates with Twilio SMS or similar
 */
export const sendSmsNotification = async (notification: SellerNotification) => {
  try {
    const message = `Hi ${notification.sellerName}, you have a new order on Suqafuran! Order #${notification.orderNumber} - ${notification.buyerName} (${notification.buyerPhone}) is interested in your items. Total: $ ${notification.total.toLocaleString()}. They will contact you to arrange payment & meeting location.`;

    console.log('[SMS NOTIFICATION QUEUED]', {
      sellerPhone: notification.sellerPhone,
      message: message
    });

    // In production, integrate with:
    // - Twilio SMS
    // - AWS SNS
    // - Vonage SMS
    // - Nexmo

    return { success: true, method: 'sms' };
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    return { success: false, error };
  }
};

/**
 * Send in-app notification to seller
 * Creates a notification that seller will see in their dashboard
 */
export const sendInAppNotification = async (notification: SellerNotification) => {
  try {
    await api.post('/notifications/create', {
      recipientType: 'seller',
      recipientPhone: notification.sellerPhone,
      type: 'new_order',
      title: `New Order #${notification.orderNumber}`,
      message: `${notification.buyerName} is interested in your products`,
      data: {
        orderNumber: notification.orderNumber,
        buyerName: notification.buyerName,
        buyerPhone: notification.buyerPhone,
        buyerLocation: notification.buyerLocation,
        items: notification.items,
        total: notification.total,
      },
    });

    return { success: true, method: 'in-app' };
  } catch (error) {
    console.error('Error sending in-app notification:', error);
    return { success: false, error };
  }
};

/**
 * Send complete notification package to seller
 * Sends via WhatsApp, SMS, and in-app notification
 */
export const notifySeller = async (notification: SellerNotification) => {
  try {
    console.log('[SELLER NOTIFICATION INITIATED]', {
      orderNumber: notification.orderNumber,
      sellerPhone: notification.sellerPhone,
      sellerName: notification.sellerName,
      buyerName: notification.buyerName,
    });

    // Send multiple notification channels
    const results = await Promise.all([
      sendWhatsAppNotification(notification),
      // sendSmsNotification(notification), // Optional: only send SMS if opted in
      sendInAppNotification(notification),
    ]);

    return { success: true, results };
  } catch (error) {
    console.error('Error notifying seller:', error);
    return { success: false, error };
  }
};

/**
 * Send order confirmation to buyer
 */
export const sendBuyerConfirmation = async (
  buyerPhone: string,
  orderNumber: string,
  sellerDetails: { name: string; phone: string }[]
) => {
  try {
    const sellerList = sellerDetails.map((s) => `${s.name} (${s.phone})`).join(', ');

    const message = `Your order #${orderNumber} has been created on Suqafuran! You can now contact ${sellerList} to arrange payment and meeting location. Download your receipt for reference.`;

    console.log('[BUYER CONFIRMATION QUEUED]', {
      buyerPhone,
      message,
    });

    return { success: true, message };
  } catch (error) {
    console.error('Error sending buyer confirmation:', error);
    return { success: false, error };
  }
};
