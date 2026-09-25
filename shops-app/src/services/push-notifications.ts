import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import api from './api';
import { capacitorCache } from './capacitor-cache';

export const pushNotificationsService = {
  async initialize() {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications: Not on native platform');
      return;
    }

    try {
      // Request permission
      let permission = await PushNotifications.checkPermissions();

      if (permission.receive === 'prompt') {
        permission = await PushNotifications.requestPermissions();
      }

      if (permission.receive !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration token
      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration token:', token.value);
        // Send token to backend
        await this.registerDeviceToken(token.value);
      });

      // Listen for push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action:', notification);
        // Handle notification tap
        this.handleNotificationTap(notification);
      });

      // Handle registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      console.log('Push notifications initialized');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  },

  async registerDeviceToken(token: string) {
    try {
      // Save locally first
      await capacitorCache.setAppSettings({
        deviceToken: token,
        deviceTokenUpdated: Date.now(),
      });

      // Send to backend if authenticated
      const jwtToken = await capacitorCache.getJWT();
      if (jwtToken) {
        await api.post('/notifications/device-token', { token });
      }
    } catch (error) {
      console.error('Failed to register device token:', error);
    }
  },

  handleNotificationTap(notification: any) {
    // Handle notification tap - navigate to relevant screen
    const { data } = notification.notification;

    if (data?.type === 'message') {
      // Navigate to messages
      window.location.hash = `/messages/${data.chatId}`;
    } else if (data?.type === 'order') {
      // Navigate to order
      window.location.hash = `/orders/${data.orderId}`;
    } else if (data?.type === 'listing') {
      // Navigate to listing
      window.location.hash = `/listings/${data.listingId}`;
    }
  },
};
