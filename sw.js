const CACHE_NAME = 'race-against-myself-v1';
const STATIC_CACHE_NAME = 'race-static-v1';
const DATA_CACHE_NAME = 'race-data-v1';

// Files to cache for offline functionality
const STATIC_FILES = [
    '/',
    '/index.html',
    '/style.css',
    '/js/main.js',
    '/js/ui.js',
    '/js/state.js',
    '/js/race.js',
    '/js/gpx.js',
    '/js/geolocation.js',
    '/js/map.js',
    '/js/elevation.js',
    '/js/audio.js',
    '/js/trackStorage.js',
    '/js/gpsSmoothing.js',
    '/js/personalRecords.js',
    '/js/challengeModes.js',
    '/js/streakCounter.js',
    '/js/heatmaps.js'
];

// External resources that should be cached
const EXTERNAL_RESOURCES = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache static files
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static app files
            caches.open(STATIC_CACHE_NAME).then(cache => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            }),
            // Cache external resources
            caches.open(CACHE_NAME).then(cache => {
                console.log('Service Worker: Caching external resources');
                return cache.addAll(EXTERNAL_RESOURCES);
            })
        ]).then(() => {
            console.log('Service Worker: Installation complete');
            return self.skipWaiting();
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== STATIC_CACHE_NAME && 
                        cacheName !== DATA_CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Handle API requests (for future backend integration)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(event.request));
        return;
    }
    
    // Handle external resources (Leaflet, Chart.js)
    if (url.origin !== location.origin) {
        event.respondWith(handleExternalResource(event.request));
        return;
    }
    
    // Handle app files with cache-first strategy
    if (STATIC_FILES.some(file => url.pathname.endsWith(file.replace('/', '')))) {
        event.respondWith(handleAppFiles(event.request));
        return;
    }
    
    // Default: network first, cache fallback
    event.respondWith(handleDefault(event.request));
});

// Handle API requests with cache fallback
async function handleApiRequest(request) {
    try {
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(DATA_CACHE_NAME);
            cache.put(request.url, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('Service Worker: API request failed, trying cache');
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return offline fallback for API
        return new Response(JSON.stringify({
            error: 'Offline',
            message: 'This feature requires an internet connection'
        }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle external resources (CDN files)
async function handleExternalResource(request) {
    try {
        // Try cache first for external resources
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Try network
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('Service Worker: External resource failed:', request.url);
        // Return cached version if available
        return await caches.match(request) || new Response('', { status: 404 });
    }
}

// Handle app files with cache-first strategy
async function handleAppFiles(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        const response = await fetch(request);
        
        if (response.ok) {
            const cache = await caches.open(STATIC_CACHE_NAME);
            cache.put(request, response.clone());
        }
        
        return response;
    } catch (error) {
        console.log('Service Worker: App file request failed:', request.url);
        return await caches.match(request) || await caches.match('/index.html');
    }
}

// Default handler: network first, cache fallback
async function handleDefault(request) {
    try {
        const response = await fetch(request);
        return response;
    } catch (error) {
        const cachedResponse = await caches.match(request);
        return cachedResponse || await caches.match('/index.html');
    }
}

// Background sync for offline race data
self.addEventListener('sync', event => {
    console.log('Service Worker: Background sync triggered');
    
    if (event.tag === 'race-data-sync') {
        event.waitUntil(syncRaceData());
    }
});

async function syncRaceData() {
    try {
        // Get offline race data from IndexedDB
        const db = await openDB();
        const tx = db.transaction(['offlineRaces'], 'readonly');
        const store = tx.objectStore('offlineRaces');
        const offlineRaces = await store.getAll();
        
        // Sync each race to server (when backend is available)
        for (const race of offlineRaces) {
            try {
                const response = await fetch('/api/races', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(race)
                });
                
                if (response.ok) {
                    // Remove from offline storage after successful sync
                    const deleteTx = db.transaction(['offlineRaces'], 'readwrite');
                    const deleteStore = deleteTx.objectStore('offlineRaces');
                    await deleteStore.delete(race.id);
                }
            } catch (error) {
                console.log('Service Worker: Failed to sync race:', race.id, error);
            }
        }
        
        console.log('Service Worker: Race data sync complete');
    } catch (error) {
        console.log('Service Worker: Background sync failed:', error);
    }
}

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('RaceAgainstMyselfOffline', 1);
        
        request.onupgradeneeded = event => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('offlineRaces')) {
                db.createObjectStore('offlineRaces', { keyPath: 'id' });
            }
        };
        
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

// Push notification support (for challenge reminders)
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'Zeit für deine tägliche Fahrt! Dein Streak wartet auf dich.',
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        tag: 'daily-reminder',
        actions: [
            {
                action: 'start-race',
                title: 'Rennen starten'
            },
            {
                action: 'dismiss',
                title: 'Später'
            }
        ],
        data: {
            type: 'daily-reminder',
            url: '/'
        }
    };
    
    event.waitUntil(
        self.registration.showNotification('Race Against Myself', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'start-race') {
        // Open app and trigger race start
        event.waitUntil(
            clients.openWindow('/').then(client => {
                if (client) {
                    client.postMessage({ 
                        type: 'START_RACE_FROM_NOTIFICATION' 
                    });
                }
            })
        );
    } else if (event.action === 'dismiss') {
        // Just close notification
        return;
    } else {
        // Default: open app
        event.waitUntil(clients.openWindow('/'));
    }
});

// Message handling for communication with main thread
self.addEventListener('message', event => {
    console.log('Service Worker: Message received:', event.data);
    
    if (event.data.type === 'CACHE_RACE_DATA') {
        event.waitUntil(cacheRaceData(event.data.data));
    } else if (event.data.type === 'GET_OFFLINE_STATUS') {
        event.ports[0].postMessage({
            offline: !navigator.onLine,
            cacheStatus: 'ready'
        });
    }
});

// Cache race data for offline access
async function cacheRaceData(raceData) {
    try {
        const cache = await caches.open(DATA_CACHE_NAME);
        const response = new Response(JSON.stringify(raceData));
        await cache.put(`/offline-race/${raceData.id}`, response);
        console.log('Service Worker: Race data cached for offline access');
    } catch (error) {
        console.error('Service Worker: Failed to cache race data:', error);
    }
}

// Periodic background tasks (when supported)
if ('serviceWorker' in navigator && 'periodicSync' in window.ServiceWorkerRegistration.prototype) {
    self.addEventListener('periodicsync', event => {
        if (event.tag === 'daily-stats-cleanup') {
            event.waitUntil(cleanupOldData());
        }
    });
}

async function cleanupOldData() {
    try {
        // Clean up old cached data (older than 30 days)
        const cache = await caches.open(DATA_CACHE_NAME);
        const requests = await cache.keys();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        for (const request of requests) {
            const response = await cache.match(request);
            const dateHeader = response.headers.get('date');
            
            if (dateHeader && new Date(dateHeader).getTime() < thirtyDaysAgo) {
                await cache.delete(request);
            }
        }
        
        console.log('Service Worker: Old data cleanup complete');
    } catch (error) {
        console.error('Service Worker: Cleanup failed:', error);
    }
}