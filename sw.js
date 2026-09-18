const CACHE_NAME = "referto-fir-v10";

const LOCAL_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=8",
  "./app.js?v=8",
  "./pdf-generator.js?v=10",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(LOCAL_FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Firebase e PDF-lib sono gestiti direttamente dai CDN.
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request, {
      cache: "no-store"
    })
      .then(response => {
        if (!response || !response.ok) {
          return response;
        }

        const copy = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, copy);
        });

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);

        if (cached) {
          return cached;
        }

        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }

        return new Response(
          "Risorsa non disponibile offline.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      })
  );
});
