import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suqafuran.app',
  appName: 'Suqafuran',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    // Capacitor's native HTTP bridge reroutes fetch/XHR through Android's
    // native networking. It's a common source of axios seeing a bare
    // "Network Error" (no response at all) for requests that work fine
    // from a real browser on the same device/emulator -- confirmed here by
    // Chrome successfully loading the API directly while the app's own
    // requests failed. Disabling it lets the WebView's own networking
    // handle requests instead, same path that already works.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
