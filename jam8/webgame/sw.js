/* Minimal service worker for the web player.
 *
 * Two jobs only:
 *  - make the page installable (Chrome wants a fetch handler that still
 *    answers when the device is offline), so the manifest's fullscreen
 *    display mode actually applies;
 *  - never get in the way of the Unity build, which is far too big to cache
 *    and must never be served stale.
 */
// Cache Storage is shared by every jam player on this origin. Only caches with this
// game's prefix may be cleaned up during activation.
var CACHE_PREFIX = 'jam8-wg-shell-';
var SHELL_CACHE = CACHE_PREFIX + 'v2';
var SHELL = ['./', './index.html', './cover.png', './icon-180.png', './icon-192.png'];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then(function(cache) { return cache.addAll(SHELL); })
            .then(function() { return self.skipWaiting(); })
    );
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(keys) {
                return Promise.all(keys
                    .filter(function(key) {
                        return key.indexOf(CACHE_PREFIX) === 0 && key !== SHELL_CACHE;
                    })
                    .map(function(key) { return caches.delete(key); }));
            })
            .then(function() { return self.clients.claim(); })
    );
});

self.addEventListener('fetch', function(event) {
    var request = event.request;
    if (request.method !== 'GET') return;

    var url;
    try { url = new URL(request.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;

    // engine files go straight to the network, never into a cache
    if (url.pathname.indexOf('/Build/') !== -1 || url.pathname.indexOf('/StreamingAssets/') !== -1) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(function() {
                return caches.match('./index.html');
            })
        );
        return;
    }

    // network first, cache as a fallback: online visitors always get fresh files
    event.respondWith(
        fetch(request).then(function(response) {
            if (response && response.ok && response.type === 'basic') {
                var copy = response.clone();
                caches.open(SHELL_CACHE).then(function(cache) { cache.put(request, copy); });
            }
            return response;
        }).catch(function() {
            return caches.match(request);
        })
    );
});
