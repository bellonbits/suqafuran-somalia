import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';

interface OfflineListener {
  onOnline?: () => void;
  onOffline?: () => void;
}

class OfflineManager {
  private isOnline = true;
  private listeners: Set<OfflineListener> = new Set();
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;

    // Check initial status
    if (Capacitor.isNativePlatform()) {
      try {
        const status = await Network.getStatus();
        this.isOnline = status.connected;

        // Listen for changes
        Network.addListener('networkStatusChange', (status) => {
          this.setOnlineStatus(status.connected);
        });
      } catch (err) {
        // The native plugin can be unavailable on a build that hasn't
        // picked up @capacitor/network yet (cap sync alone doesn't rebuild
        // the APK) -- degrade to "assume online" rather than an uncaught
        // rejection on every app start.
        console.warn('Network plugin unavailable, assuming online:', err);
      }
    } else {
      // Web platform: use browser's online/offline events
      window.addEventListener('online', () => this.setOnlineStatus(true));
      window.addEventListener('offline', () => this.setOnlineStatus(false));
    }
  }

  private setOnlineStatus(online: boolean) {
    if (this.isOnline === online) return;
    this.isOnline = online;

    this.listeners.forEach((listener) => {
      if (online && listener.onOnline) {
        listener.onOnline();
      } else if (!online && listener.onOffline) {
        listener.onOffline();
      }
    });
  }

  getStatus() {
    return this.isOnline;
  }

  subscribe(listener: OfflineListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const offlineManager = new OfflineManager();
