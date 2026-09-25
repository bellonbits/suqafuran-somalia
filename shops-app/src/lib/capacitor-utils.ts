import { Capacitor } from '@capacitor/core';

export const isCapacitorApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch (error) {
    return false;
  }
};

export const getPlatform = (): string | null => {
  try {
    return Capacitor.getPlatform();
  } catch (error) {
    return null;
  }
};

export const isIosApp = (): boolean => getPlatform() === 'ios';

export const isAndroidApp = (): boolean => getPlatform() === 'android';

export const isWebApp = (): boolean => getPlatform() === 'web';
