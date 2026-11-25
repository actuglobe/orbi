// Service worker : permet l'installation sur téléphone et un fonctionnement hors ligne basique.
// Stratégie : réseau d'abord (pour avoir les actus du jour), cache en secours.
const CACHE = 'orbi-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'manifest.webmanifest', 'icons/icon.svg',
  'data/countries.geojson', 'data/daily.json', 'data/geopolitics.json', 'data/business.json', 'data/transfers.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok && (e.request.url.startsWith(self.location.origin) || e.request.url.includes('jsdelivr') || e.request.url.includes('flagcdn'))) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
