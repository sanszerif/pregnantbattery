import { createHash } from "node:crypto";
import type { Plugin } from "vite";

const PUBLIC_PRECACHE_PATHS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./favicon.svg",
  "./pwa-192.png",
  "./pwa-512.png",
  "./pwa-maskable-512.png",
  "./apple-touch-icon.png",
];

/**
 * Generates a self-contained Service Worker script that precaches built assets
 * for offline navigation and cache-first static asset serving.
 */
export function buildServiceWorkerSource(
  cacheName: string,
  precachePaths: string[],
): string {
  const uniquePaths = Array.from(new Set(precachePaths)).sort();
  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_PATHS = ${JSON.stringify(uniquePaths, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        const urls = PRECACHE_PATHS.map((p) => new URL(p, self.registration.scope).href);
        return cache.addAll(urls);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("pregnantbattery-") && k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) return;
  if (!reqUrl.href.startsWith(self.registration.scope)) return;

  if (req.mode === "navigate") {
    const shellUrl = new URL("./index.html", self.registration.scope).href;
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(shellUrl, copy));
          }
          return res;
        })
        .catch(async () => {
          const shell = await caches.match(shellUrl);
          if (shell) return shell;
          const exact = await caches.match(req);
          return exact || Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
`;
}

/**
 * Vite build plugin emitting dist/sw.js precaching all built assets and public PWA files.
 */
export function pwaOfflinePlugin(appVersion: string): Plugin {
  return {
    name: "pregnantbattery-pwa-offline",
    apply: "build",
    generateBundle(_, bundle) {
      const precachePaths = new Set<string>(PUBLIC_PRECACHE_PATHS);
      for (const fileName of Object.keys(bundle)) {
        if (fileName === "sw.js" || fileName.endsWith(".map")) continue;
        precachePaths.add(`./${fileName}`);
      }
      const sorted = Array.from(precachePaths).sort();
      const hash = createHash("sha256")
        .update(`${appVersion}:${sorted.join(",")}`)
        .digest("hex")
        .slice(0, 10);
      const cacheName = `pregnantbattery-v${appVersion}-${hash}`;
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: buildServiceWorkerSource(cacheName, sorted),
      });
    },
  };
}
