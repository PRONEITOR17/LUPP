// Service worker de LUPP: hace que la app se pueda instalar y abrir sin internet.
// IMPORTANTE: cada vez que cambies el código, sube el número de VERSION
// para que el celular descargue la versión nueva.
const VERSION = 'lupp-v11';

const ARCHIVOS = [
  './',
  './index.html',
  './css/styles.css',
  './css/vivo.css',
  './config.js',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/datos-base.js',
  './js/guia.js',
  './js/graficos.js',
  './js/bancos.js',
  './js/animaciones.js',
  './js/consejos.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Los datos de Supabase siempre van directo a internet
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  // Primero la red (para tener lo último); si no hay internet, la copia guardada
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copia = res.clone();
          caches.open(VERSION).then(c => c.put(req, copia));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html'))),
  );
});

// Al tocar una notificación, abre (o enfoca) LUPP
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      const abierta = lista.find(c => 'focus' in c);
      return abierta ? abierta.focus() : self.clients.openWindow('./');
    }),
  );
});