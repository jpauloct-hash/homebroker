/**
 * TRADING GP — Service Worker (PWA)
 * Estratégia pensada para um app que atualiza com frequência:
 *  - Página (index.html): NETWORK-FIRST — sempre tenta a versão nova;
 *    o cache só entra quando estiver offline. (Evita o problema clássico
 *    de PWA servindo versão velha.)
 *  - Ícones/manifest: CACHE-FIRST — são estáticos.
 *  - APIs (proxy, Firebase, brapi, TradingView, notícias): NUNCA cacheia —
 *    passa direto pela rede.
 *
 * Ao atualizar o app, suba também este arquivo mudando a VERSION abaixo:
 * isso descarta o cache antigo automaticamente.
 */

const VERSION = "tgp-v1";
const STATIC_ASSETS = [
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting(); // ativa a versão nova imediatamente
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // APIs e serviços externos: rede direta, sem cache
  if (url.origin !== self.location.origin) return;

  // Navegação (abrir o app): network-first com fallback offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match("index.html")))
    );
    return;
  }

  // Estáticos do próprio site: cache-first com atualização em segundo plano
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
