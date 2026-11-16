'use strict';
// Bump this version whenever the application shell changes.
// Prefix kept from the earlier repair app so its old caches are cleaned up on activate.
const CACHE_PREFIX = `repair-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v6`;
const SHELL = ['index.html', 'style.css', 'app.js', 'config.js', 'pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const assetUrls = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
// 新版本安裝後立即接手，不必等所有頁面關閉。
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    // The page shell remains available even if the CDN cannot be reached.
    try {
      const response = await fetch(SDK_URL, { mode: 'cors', signal: AbortSignal.timeout(10000) });
      if (response.ok) await cache.put(SDK_URL, response);
    } catch { /* The app displays its existing initialization error if SDK is unavailable. */ }
  }));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// 連線時一律先抓最新版本並更新快取；離線或逾時才使用快取。
async function networkFirst(request, cacheKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: 'no-cache', signal: AbortSignal.timeout(6000) });
    if (response.ok) await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  // Do not intercept database traffic, writes, or unrelated files.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === self.location.origin &&
      (url.href.split('?')[0] === self.registration.scope || url.origin + url.pathname === INDEX_URL)) {
    event.respondWith(networkFirst(INDEX_URL, INDEX_URL));
    return;
  }
  if (url.href === SDK_URL) {
    event.respondWith(caches.open(CACHE_NAME).then(async cache => (await cache.match(request)) || fetch(request)));
    return;
  }
  const assetKey = url.origin + url.pathname;
  if (!assetUrls.has(assetKey)) return;
  event.respondWith(networkFirst(request, assetKey));
});
