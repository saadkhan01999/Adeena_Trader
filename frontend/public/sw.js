/**
 * ============================================
 * Service Worker
 * ============================================
 * Keeps ADEENA TRADERS usable when the shop's internet drops.
 *
 * What this does and deliberately does not do
 * -------------------------------------------
 * READS work offline. The app shell is cached so it opens at all, and GET
 * responses from the API are cached so the last data seen is still there -
 * a customer's balance, today's instalments, a product's price. That covers
 * the case that actually happens at the counter: the connection goes while
 * someone is looking something up.
 *
 * WRITES are NOT queued and replayed. That is a deliberate refusal, not an
 * omission. Replaying a queued sale has no safe default: the shop may have
 * re-entered it by hand in the meantime, the stock it draws on may have been
 * sold, and a duplicated instalment plan is a customer being asked for money
 * twice. Doing it correctly needs idempotency keys the server honours and a
 * rule for what happens when a replay no longer fits reality - a decision
 * about the business, not a caching strategy. Until then a write made offline
 * fails immediately and says so, which is recoverable, rather than appearing
 * to succeed and landing hours later, which is not.
 *
 * Caches are versioned. Bumping CACHE_VERSION discards the old ones on
 * activate, so a deploy cannot leave a user on a stale shell.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `adeena-shell-${CACHE_VERSION}`;
const API_CACHE = `adeena-api-${CACHE_VERSION}`;

/** Kept small on purpose: everything else is cached as it is first requested. */
const SHELL_URLS = ['/', '/index.html', '/logo.png', '/logo-mark.png', '/favicon.ico'];

/**
 * Everything the app needs to start, precached on install.
 *
 * The build writes sw-manifest.json listing its content-hashed JS and CSS.
 * Precaching matters because on a first visit this worker is not yet
 * controlling the page, so the requests that actually load the app never pass
 * through the fetch handler and would otherwise never be cached - leaving the
 * app unable to open offline until it happened to be loaded twice online.
 */
const precache = async () => {
  const cache = await caches.open(SHELL_CACHE);

  let assets = [];
  try {
    const response = await fetch('/sw-manifest.json', { cache: 'no-cache' });
    if (response.ok) assets = (await response.json()).files || [];
  } catch {
    // No manifest: fall back to the shell alone. The app will still open
    // offline once the assets have been seen through the fetch handler.
  }

  // Added individually: one 404 must not fail the whole install and leave the
  // user with no worker at all.
  await Promise.allSettled([...SHELL_URLS, ...assets].map((url) => cache.add(url)));
};

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('adeena-') && !key.endsWith(CACHE_VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Is this one of our own build assets? Those never change under a given URL. */
const isBuildAsset = (url) =>
  url.origin === self.location.origin && /\/assets\/.*\.(js|css|woff2?)$/.test(url.pathname);

const isApiGet = (request, url) =>
  request.method === 'GET' && /\/api\//.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Anything that changes data goes straight to the network. It must fail
  // loudly when offline rather than be absorbed here - see the note above.
  if (request.method !== 'GET') return;

  // Navigation: try the network so a deploy is picked up, fall back to the
  // cached shell so the app still opens with no connection.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Build assets are content-hashed, so a cached copy is always correct.
  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // API reads: network first, so the figures are live whenever they can be,
  // with the last successful response kept as the fallback.
  if (isApiGet(request, url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache a genuine success. Caching a 401 would hand the user
          // their own rejection back after the session is restored.
          if (response.ok) {
            const copy = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) {
              // Marked so the app can tell the difference between live data
              // and something remembered from earlier.
              const headers = new Headers(cached.headers);
              headers.set('X-Adeena-From-Cache', '1');
              return cached.blob().then((body) => new Response(body, {
                status: cached.status, statusText: cached.statusText, headers,
              }));
            }
            return Response.error();
          })
        )
    );
    return;
  }

  // Everything else same-origin (images, uploads): cache as a fallback only.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((r) => r || Response.error()))
    );
  }
});
