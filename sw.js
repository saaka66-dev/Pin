'use strict';
// Bump this version whenever the application shell changes.
const CACHE_PREFIX = `repair-shell:${self.registration.scope}:`;
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL = ['index.html', 'style.css', 'app.js', 'config.js', 'pwa.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const assetUrls = new Set(SHELL.map(path => new URL(path, self.registration.scope).href));
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(SHELL.map(path => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    // The page shell remains available even if the CDN cannot be reached.
    try {
      const response = await fetch(SDK_URL, { mode: 'cors', signal: AbortSignal.timeout(10000) });
      if (response.ok) await cache.put(SDK_URL, response);
    } catch { /* The app displays its existing initialization error if SDK is unavailable. */ }
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  // Do not intercept database traffic, writes, or unrelated files.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (request.mode === 'navigate' && url.origin === self.location.origin &&
      (url.href.split('?')[0] === self.registration.scope || url.pathname === new URL('index.html', self.registration.scope).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(new URL('index.html', self.registration.scope))) || fetch(request);
    })());
    return;
  }
  if (!assetUrls.has(url.href) && url.href !== SDK_URL) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
