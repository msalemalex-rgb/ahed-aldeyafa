// Service worker لتطبيق عهد الضيافة (تثبيت PWA + إشعارات Push)
const CACHE = 'ahed-admin-v2';
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
  e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
});

// ===== إشعارات Push (تشتغل حتى والتطبيق مقفول) =====
self.addEventListener('push', function (e) {
  var d = { title: 'عهد الضيافة', body: '', url: '/admin.html' };
  try { if (e.data) d = Object.assign(d, e.data.json()); }
  catch (_) { try { d.body = e.data.text(); } catch (__) {} }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'ahed-order',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: { url: d.url || '/admin.html' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/admin.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/admin') > -1 && 'focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
