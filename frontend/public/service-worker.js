/* eslint-disable no-console */
/* global self, caches, fetch */

const CACHE_NAME = 'family-sync-v1';
const RUNTIME_CACHE = 'family-sync-runtime-v1';

// Recursos para cachear durante la instalación
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/app.js',
  '/js/chunk-vendors.js',
  '/manifest.json',
  '/img/icons/icon-192x192.png',
  '/img/icons/icon-512x512.png',
];

// Instalar Service Worker y precachear recursos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Precacheando recursos');
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('[SW] Algunos recursos no se pudieron cachear:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activar Service Worker y limpiar cachés viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            console.log('[SW] Eliminando caché viejo:', cacheToDelete);
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Estrategia de Fetch: Network First con fallback a Cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo cachear requests GET
  if (request.method !== 'GET') {
    return;
  }

  // Para rutas de API, usar Network First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Para recursos estáticos, usar Cache First
  event.respondWith(cacheFirstStrategy(request));
});

// Estrategia Network First: Intentar red primero, fallback a caché
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Red no disponible, usando caché:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // Si no hay caché y es una request de API, retornar respuesta offline
    if (request.url.includes('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'offline',
          message: 'No hay conexión a internet. Los datos se sincronizarán cuando vuelvas a estar en línea.',
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        }
      );
    }

    throw error;
  }
}

// Estrategia Cache First: Buscar en caché primero, fallback a red
async function cacheFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] Error al obtener recurso:', request.url);
    
    // Retornar página offline para navegación
    if (request.destination === 'document') {
      const offlineResponse = await cache.match('/index.html');
      if (offlineResponse) {
        return offlineResponse;
      }
    }
    
    throw error;
  }
}

// Escuchar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[SW] Limpiando caché:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});

// Manejar sincronización en segundo plano
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'sync-shopping-items') {
    event.waitUntil(syncShoppingItems());
  }
  
  if (event.tag === 'sync-calendar-events') {
    event.waitUntil(syncCalendarEvents());
  }
});

// Función para sincronizar items de compras
async function syncShoppingItems() {
  try {
    console.log('[SW] Sincronizando items de compras...');
    
    // Notificar al cliente que sincronice
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_SHOPPING_ITEMS',
      });
    });
    
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Error al sincronizar items:', error);
    return Promise.reject(error);
  }
}

// Función para sincronizar eventos de calendario
async function syncCalendarEvents() {
  try {
    console.log('[SW] Sincronizando eventos de calendario...');
    
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_CALENDAR_EVENTS',
      });
    });
    
    return Promise.resolve();
  } catch (error) {
    console.error('[SW] Error al sincronizar eventos:', error);
    return Promise.reject(error);
  }
}

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido:', event);
  
  let notificationData = {
    title: 'Family Sync',
    body: 'Tienes una nueva actualización',
    icon: '/img/icons/icon-192x192.png',
    badge: '/img/icons/icon-96x96.png',
    tag: 'default',
    data: {
      url: '/'
    }
  };
  
  // Parsear datos si vienen en el payload
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = { ...notificationData, ...payload };
    } catch (error) {
      console.error('[SW] Error al parsear payload de push:', error);
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

// Manejar clicks en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificación clickeada:', event.notification.tag);
  
  event.notification.close();
  
  // Obtener URL de destino
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si no, abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Manejar cierre de notificaciones
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificación cerrada:', event.notification.tag);
});

console.log('[SW] Service Worker cargado');
