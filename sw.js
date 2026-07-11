// Service worker لتطبيق عهد الضيافة (يجعل الموقع قابلاً للتثبيت PWA)
const CACHE = 'ahed-admin-v1';
const SHELL = ['/admin.html', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// شبكة أولاً، ويرجع للكاش لو مفيش نت (للواجهة فقط)
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).catch(function () { return caches.match(e.request); })
  );
});
