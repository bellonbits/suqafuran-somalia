import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NotificationType = 'order' | 'payment' | 'delivery' | 'issue' | 'promotion' | 'system';
export type NotificationStatus = 'unread' | 'read' | 'archived';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  timestamp: Date;
  icon?: string;
  actionUrl?: string;
  actionLabel?: string;
  data?: Record<string, any>;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  orderUpdates: boolean;
  paymentUpdates: boolean;
  deliveryUpdates: boolean;
  promotions: boolean;
  systemAlerts: boolean;
}

interface NotificationStore {
  notifications: Notification[];
  preferences: NotificationPreferences;
  unreadCount: number;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'status'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  archiveNotification: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearAll: () => void;

  // Preferences
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  getPreferences: () => NotificationPreferences;
}

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  smsNotifications: true,
  pushNotifications: true,
  inAppNotifications: true,
  orderUpdates: true,
  paymentUpdates: true,
  deliveryUpdates: true,
  promotions: true,
  systemAlerts: true,
};

export const useNotifications = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      preferences: defaultPreferences,
      unreadCount: 0,

      addNotification: (notification) => {
        const id = `notif_${Date.now()}`;
        const newNotif: Notification = {
          ...notification,
          id,
          status: 'unread',
          timestamp: new Date(),
        };

        set((state) => ({
          notifications: [newNotif, ...state.notifications],
          unreadCount: state.unreadCount + 1,
        }));

        // Auto-remove after 7 days
        setTimeout(() => {
          get().deleteNotification(id);
        }, 7 * 24 * 60 * 60 * 1000);
      },

      markAsRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, status: 'read' } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({
            ...n,
            status: 'read' as const,
          })),
          unreadCount: 0,
        }));
      },

      archiveNotification: (id) => {
        set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          return {
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, status: 'archived' } : n
            ),
            unreadCount: notif?.status === 'unread' ? state.unreadCount - 1 : state.unreadCount,
          };
        });
      },

      deleteNotification: (id) => {
        set((state) => {
          const notif = state.notifications.find((n) => n.id === id);
          return {
            notifications: state.notifications.filter((n) => n.id !== id),
            unreadCount: notif?.status === 'unread' ? state.unreadCount - 1 : state.unreadCount,
          };
        });
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },

      updatePreferences: (prefs) => {
        set((state) => ({
          preferences: { ...state.preferences, ...prefs },
        }));
      },

      getPreferences: () => get().preferences,
    }),
    {
      name: 'notifications-storage',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);
