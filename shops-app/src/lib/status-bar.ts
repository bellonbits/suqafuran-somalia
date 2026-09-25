import { StatusBar, Style } from '@capacitor/status-bar';
import { isCapacitorApp } from './capacitor-utils';

// Without this, Android 15+ (this app targets SDK 36) enforces edge-to-edge
// display by default, and nothing was telling the OS to reserve space for
// the status bar -- the webview drew under it, so app content visually
// covered the notification/battery/signal icons instead of sitting below
// them. overlay: false makes the OS inset the webview so that space stays
// reserved, matching what the app's CSS already assumes via the
// safe-area-inset-top padding used in Header.tsx/App.tsx.
export async function configureStatusBar(): Promise<void> {
  if (!isCapacitorApp()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: Style.Default });
  } catch (error) {
    // Not every platform/version supports every call here (e.g. iOS ignores
    // setBackgroundColor) -- fail silently rather than block app startup
    // over a cosmetic status bar setting.
  }
}
