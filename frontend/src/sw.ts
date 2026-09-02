/// <reference lib="webworker" />

import {
    cleanupOutdatedCaches,
    createHandlerBoundToURL,
    precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare let self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: (string | { url: string; revision: string | null })[];
};

const TILE_CACHE = "osm-tiles";

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
    new NavigationRoute(createHandlerBoundToURL("index.html"), {
        denylist: [/^\/v1\//],
    }),
);

registerRoute(
    ({ url }) => url.hostname === "tile.openstreetmap.org",
    new CacheFirst({
        cacheName: TILE_CACHE,
        matchOptions: { ignoreVary: true },
        fetchOptions: { mode: "cors", credentials: "omit" },
        plugins: [
            new CacheableResponsePlugin({ statuses: [200] }),
            new ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
                purgeOnQuotaError: true,
            }),
        ],
    }),
);
self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
