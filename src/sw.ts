/// <reference lib="webworker" />
// Service worker: deja el sitio completo disponible sin conexión.
// - Precarga (Workbox) la app, las fotos, las fuentes y los sprites del mapa.
// - Guarda entero el paquete de mosaicos (tiles.bin, decenas de MB) y responde las peticiones Range desde la caché.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

const CACHE_MAPA = 'mapa-tiles-v1';
const URL_TILES = new URL('mapa/tiles.bin', self.registration.scope).href;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegaciones: siempre la app (una sola página).
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Al instalar, descargar el paquete de mosaicos completo (una sola vez; las versiones nuevas reemplazan la caché).
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_MAPA);
      if (!(await cache.match(URL_TILES))) {
        const r = await fetch(URL_TILES, { cache: 'no-store' });
        if (r.ok) await cache.put(URL_TILES, r);
      }
    })(),
  );
});

// Los mosaicos se piden por rangos de bytes: se sirven recortando la copia completa guardada.
registerRoute(
  ({ url }) => url.pathname.endsWith('/mapa/tiles.bin'),
  new CacheFirst({
    cacheName: CACHE_MAPA,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
  }),
);

// Avisar a la página cuando todo quedó guardado.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const clientes = await self.clients.matchAll({ type: 'window' });
      for (const c of clientes) c.postMessage({ tipo: 'offline-listo' });
    })(),
  );
});
