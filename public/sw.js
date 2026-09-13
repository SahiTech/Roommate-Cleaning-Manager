self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = { title: 'Roommate Cleaning Manager', body: event.data?.text() || '' }; }
  const title = payload.title || 'Roommate Cleaning Manager';
  const options = {
    body: payload.body || 'You have a cleaning duty update.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: payload.url || '/' },
    tag: payload.tag || 'roommate-cleaning',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
