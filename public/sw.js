// Service worker : toute l'application est mise en cache à l'installation, puis servie
// depuis le cache. Une partie entière se joue donc sans aucune connexion.
// Quand le réseau est là, les fichiers sont rafraîchis en arrière-plan pour la prochaine ouverture.
const VERSION = 'coupe-circuit-v1';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './engine/rules.js',
  './engine/game.js',
  './state/store.js',
  './state/privacy.js',
  './ui/dom.js',
  './ui/art.js',
  './ui/sound.js',
  './ui/texts.js',
  './ui/components.js',
  './ui/screens/home.js',
  './ui/screens/setup.js',
  './ui/screens/rules.js',
  './ui/screens/pass.js',
  './ui/screens/table.js',
  './ui/screens/roundEnd.js',
  './ui/screens/gameOver.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  const key = req.mode === 'navigate' ? './index.html' : req;
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
      const refresh = fetch(req)
        .then((res) => { if (res.ok) cache.put(key, res.clone()); return res; })
        .catch(() => null);
      if (cached) { event.waitUntil(refresh); return cached; }
      return (await refresh) || (await cache.match('./index.html')) || Response.error();
    }),
  );
});
