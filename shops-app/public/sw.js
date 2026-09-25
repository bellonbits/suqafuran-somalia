// Kill-switch service worker.
//
// shops-app registers no service worker of its own. This file exists only
// so browsers still running a service worker from a previous deploy (the
// old root app used vite-plugin-pwa and installed a real one) have a valid
// script to fetch on their periodic update check. Once installed, it wipes
// every cache, unregisters itself, and reloads open tabs — after which no
// service worker controls the site at all.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();

      const clientsList = await self.clients.matchAll({ type: 'window' });
      for (const client of clientsList) {
        client.navigate(client.url);
      }
    })()
  );
});
