/**
 * Cache buster utility
 * Clears old site caches on page load
 */

export async function initCacheBuster() {
  if (typeof window === 'undefined') return;

  try {
    // Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('🗑️ Clearing caches:', cacheNames);
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    }

    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log('🗑️ Unregistering service workers:', registrations.length);
      await Promise.all(registrations.map(reg => reg.unregister()));
    }

    // Clear localStorage keys that might belong to old site
    const keysToCheck = ['oldSiteData', 'previousSiteState', 'legacyUser'];
    keysToCheck.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log('🗑️ Clearing localStorage:', key);
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    sessionStorage.clear();

    // Force reload if different from expected hostname
    // Skip this check for native Capacitor apps and localhost development
    const expectedHostnames = ['suqafuran.so', 'www.suqafuran.so', 'suqafuran.com', 'www.suqafuran.com', 'suqafuran.vercel.app'];
    const currentHostname = window.location.hostname;
    const isNativeApp = window.location.protocol === 'capacitor:';
    const isLocalhost = currentHostname === 'localhost' || currentHostname === '127.0.0.1';

    if (!isNativeApp && !isLocalhost && !expectedHostnames.includes(currentHostname)) {
      console.warn('⚠️ Wrong hostname detected:', currentHostname);
      window.location.href = `https://suqafuran.so${window.location.pathname}`;
    }

    console.log('✅ Cache buster complete');
  } catch (error) {
    console.error('❌ Cache buster error:', error);
  }
}

/**
 * Add version query parameter to all fetch requests
 * Prevents cached responses from being served
 */
export function addCacheBusterToRequests() {
  const originalFetch = window.fetch;
  const version = new Date().getTime();

  window.fetch = function (...args) {
    let url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

    if (url && !url.includes('_next')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}_v=${version}`;
      args[0] = url;
    }

    return originalFetch.apply(this, args);
  };
}
