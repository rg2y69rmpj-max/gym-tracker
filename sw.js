const CACHE = 'gymtracker-v4';
const ASSETS = ['./', 'index.html', 'styles.css', 'logic.js', 'charts.js', 'app.js', 'manifest.webmanifest', 'plan.json', 'plan.recomp.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Plan files: network-first so a new plan shows up; everything else cache-first.
  if (/plan(\.\w+)?\.json$/.test(new URL(req.url).pathname)) {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); return r; }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })));
});
