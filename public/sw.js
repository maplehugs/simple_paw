// Rutas relativas a sw.js: sirven igual en / (Express) y en /simple_paw/ (GitHub Pages)
const CACHE = 'pokedex-v3';
const ARCHIVOS = [
  './',
  'offline.html',
  'js/swregist.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// 1. install: guarda los archivos estáticos en la caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ARCHIVOS))
  );
  self.skipWaiting();
});

// 2. activate: borra las versiones viejas de la caché
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(nombres => Promise.all(
      nombres.filter(n => n !== CACHE).map(n => caches.delete(n))
    ))
  );
  self.clients.claim();
});

// 3. fetch: primero la caché, luego la red, y si no hay red, offline.html.
// Lo que llega de la red también se guarda: así quedan en caché el JS/CSS que
// genera Vite (con nombres con hash) y los datos e imágenes de PokeAPI.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    // ignoreSearch en navegación: /simple_paw/?q=pika usa la misma página guardada que /simple_paw/
    caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' }).then(guardada =>
      guardada || fetch(event.request).then(respuesta => {
        if (respuesta.ok || respuesta.type === 'opaque') {
          const copia = respuesta.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copia));
        }
        return respuesta;
      }).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('offline.html');
      })
    )
  );
});
