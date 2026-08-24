const CACHE_NAME = 'kopano-static-v2';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isFinancial(url) {
  return /\/api\/(orders|payments|admin|referrals|auth|supplier-app|agents|groups)/.test(url);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline', code: 'OFFLINE' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  if (isFinancial(url) || url.includes('/api/')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(
        () =>
          new Response(JSON.stringify({ error: 'Offline', code: 'OFFLINE' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          })
      )
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
        return response;
      })
      .catch(() => caches.match(request))
  );
});
