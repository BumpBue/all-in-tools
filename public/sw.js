/*
 * Offline support for Toolbox.
 *
 * Two strategies, chosen per request rather than one blanket rule:
 *
 * - Build output under /_next/static is content-hashed, so a hit is always the
 *   right answer and cache-first costs no correctness.
 * - HTML is server-rendered per request and carries the theme and locale
 *   cookies, so it is fetched network-first and only falls back to the cache
 *   when the network is gone. Serving a page cache-first would show a stale
 *   tool to someone who is online.
 *
 * Bump CACHE_VERSION when the precache list or these rules change; the old
 * cache is deleted on activate.
 */
const CACHE_VERSION = 'v1';
const SHELL_CACHE = `toolbox-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `toolbox-assets-${CACHE_VERSION}`;
const PAGE_CACHE = `toolbox-pages-${CACHE_VERSION}`;

const OFFLINE_URL = '/offline';
const HASHED_ASSET_PREFIX = '/_next/static/';
const MAX_CACHED_PAGES = 40;

const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];

const OWN_CACHES = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // One failure must not abort the install, so each is added on its own.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('toolbox-') && !OWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Keeps the page cache from growing without bound on a long-lived install. */
async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;

  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await trimCache(PAGE_CACHE, MAX_CACHED_PAGES);
    }
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // A POST or a Server Action must always reach the network, and a request to
  // another origin is not ours to cache.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(HASHED_ASSET_PREFIX)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
