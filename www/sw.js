/* Service worker de Bitty (PWA / iPhone). Solo permite abrir la app sin conexión.
   - Solo intercepta GET del MISMO origen: Supabase y las fuentes (otros orígenes) nunca pasan por aquí ni se guardan.
   - Red primero (siempre la versión más nueva si hay conexión); sin conexión, la copia guardada.
   - Nunca guarda URLs con token_hash/token (enlaces de confirmación de correo).
   Sube CACHE al cambiar la lista PRECACHE para descartar copias antiguas. */
const CACHE = "bitty-v1";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function cacheable(url) { return !/[?&](token_hash|token|access_token|refresh_token|code)=/.test(url.search + url.hash); }

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === "basic" && cacheable(url)) { const c = await caches.open(CACHE); c.put(req, res.clone()).catch(() => {}); }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate" && !url.pathname.includes("/auth/")) { const i = await caches.match("./index.html"); if (i) return i; }
      return new Response("Sin conexión", { status: 503, statusText: "Offline", headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
