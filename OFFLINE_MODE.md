# 📴 Modo Offline - Family Sync App

La aplicación ahora soporta funcionalidad offline completa. Puedes usar la app sin conexión a internet y todos los cambios se sincronizarán automáticamente cuando recuperes la conexión.

## 🎯 Características Offline

### ✅ Lo que funciona sin conexión:

- **📝 Lista de Compras:**
  - Agregar nuevos items
  - Marcar items como completados
  - Eliminar items
  - Limpiar items marcados
  - Ver todos los items guardados

- **📅 Calendario:**
  - Ver eventos previamente sincronizados
  - Consultar detalles de eventos
  - Navegar por la lista de eventos

- **🔄 Sincronización Automática:**
  - Los cambios se guardan localmente
  - Se sincronizan automáticamente al recuperar conexión
  - Indicador visual de estado de sincronización
  - Cola de acciones pendientes

## 🏗️ Arquitectura Técnica

### Service Worker
- Cachea recursos estáticos para acceso offline
- Estrategia "Network First" para API calls
- Estrategia "Cache First" para recursos estáticos
- Background Sync API para sincronización en segundo plano

### IndexedDB
- Almacenamiento local de datos
- 4 stores principales:
  - `shoppingItems`: Items de compras
  - `calendarEvents`: Eventos de calendario
  - `syncQueue`: Cola de sincronización
  - `metadata`: Información de última sincronización

### Sync Manager
- Gestiona sincronización entre local y servidor
- Cola de acciones pendientes
- Reintentos automáticos
- Resolución de conflictos

## 📱 Indicadores Visuales

### Badge "📵 Offline"
- Aparece en el header cuando no hay conexión
- Se oculta automáticamente al recuperar conexión

### Badge de Sincronización "⏳ X"
- Muestra el número de acciones pendientes de sincronizar
- Desaparece cuando todo está sincronizado

### Botón de Refresh
- Muestra "⏳" cuando está sincronizando
- Muestra "🔄" en estado normal
- Deshabilitado durante sincronización

## 🔄 Flujo de Sincronización

### 1. Acción Offline
```
Usuario agrega item → Guarda en IndexedDB → Agrega a syncQueue → Registra Background Sync
```

### 2. Recuperación de Conexión
```
Detecta conexión → Procesa syncQueue → Envía al servidor → Actualiza IndexedDB → Limpia queue
```

### 3. Sincronización Manual
```
Usuario toca 🔄 → Sincroniza con servidor → Actualiza datos locales → Muestra resultado
```

## 🛠️ Uso de la API

### Cargar Items de Compras
```javascript
import syncManager from '@/services/syncManager';

// Carga desde servidor o IndexedDB según conexión
const items = await syncManager.loadShoppingItems();
```

### Agregar Item
```javascript
// Funciona online y offline
const newItem = await syncManager.addShoppingItem('Leche');
```

### Toggle Item
```javascript
// Actualización optimista + sincronización
await syncManager.toggleShoppingItem(itemId, completed);
```

### Forzar Sincronización
```javascript
try {
  await syncManager.forceSyncAll();
  console.log('✅ Sincronizado');
} catch (error) {
  console.error('❌ Sin conexión');
}
```

### Obtener Estado
```javascript
const status = await syncManager.getSyncStatus();
console.log({
  pendingActions: status.pendingActions,
  lastSyncShopping: status.lastSyncShopping,
  lastSyncCalendar: status.lastSyncCalendar,
  isOnline: status.isOnline
});
```

## 📊 Monitoreo y Debugging

### Ver estado de IndexedDB
```javascript
// En la consola del navegador
import offlineStorage from '@/services/offlineStorage';

// Ver items de compras
const items = await offlineStorage.getShoppingItems();
console.table(items);

// Ver cola de sincronización
const queue = await offlineStorage.getSyncQueue();
console.table(queue);

// Ver última sincronización
const lastSync = await offlineStorage.getLastSync('shopping');
console.log('Última sync:', lastSync);
```

### Ver Service Worker
```javascript
// En Chrome DevTools → Application → Service Workers
// Ver estado, actualizar, desregistrar, etc.
```

### Simular Offline
```javascript
// En Chrome DevTools → Network → Throttling → Offline
// O programáticamente:
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.controller.postMessage({
    type: 'TEST_OFFLINE'
  });
}
```

## 🐛 Troubleshooting

### Los cambios no se sincronizan

1. **Verificar conexión:**
   ```javascript
   console.log('Online:', navigator.onLine);
   ```

2. **Ver cola de sincronización:**
   ```javascript
   const queue = await offlineStorage.getSyncQueue();
   console.log('Pendientes:', queue.length);
   ```

3. **Forzar sincronización:**
   ```javascript
   await syncManager.forceSyncAll();
   ```

### Service Worker no se actualiza

1. **Desregistrar y recargar:**
   ```javascript
   // En Chrome DevTools → Application → Service Workers
   // Click en "Unregister" y recarga la página
   ```

2. **Limpiar caché:**
   ```javascript
   if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
     navigator.serviceWorker.controller.postMessage({
       type: 'CLEAR_CACHE'
     });
   }
   ```

### Datos desincronizados

1. **Limpiar IndexedDB:**
   ```javascript
   // CUIDADO: Esto borra todos los datos locales
   await offlineStorage.clear('shoppingItems');
   await offlineStorage.clear('calendarEvents');
   await offlineStorage.clearSyncQueue();
   ```

2. **Recargar desde servidor:**
   ```javascript
   await syncManager.loadShoppingItems();
   await syncManager.loadCalendarEvents();
   ```

## 🔒 Consideraciones de Seguridad

### Datos Sensibles
- Los datos se almacenan localmente en IndexedDB
- IndexedDB no está encriptado por defecto
- El Service Worker puede cachear respuestas de API

### Recomendaciones
1. No almacenar información altamente sensible
2. Implementar timeout de sesión
3. Limpiar datos al cerrar sesión
4. Usar HTTPS siempre

### Limpiar Datos al Logout
```javascript
// En tu función de logout
await offlineStorage.clear('shoppingItems');
await offlineStorage.clear('calendarEvents');
await offlineStorage.clearSyncQueue();
localStorage.clear();
```

## 📈 Mejoras Futuras

### Posibles Implementaciones

1. **Resolución de Conflictos:**
   - Timestamp-based resolution
   - User prompts para conflictos
   - Merge automático de cambios

2. **Optimistic UI:**
   - Feedback inmediato en todas las acciones
   - Rollback automático en errores
   - Indicadores de estado pendiente

3. **Sincronización Selectiva:**
   - Solo sincronizar cambios recientes
   - Paginación de datos
   - Limpieza automática de datos viejos

4. **Notificaciones:**
   - Push notifications para sincronización completada
   - Alertas de conflictos
   - Estado de sincronización en background

5. **Compresión de Datos:**
   - Comprimir datos en IndexedDB
   - Reducir uso de espacio
   - Mejorar performance

## 🎓 Recursos

### Documentación Oficial
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

### Herramientas
- [Chrome DevTools - Application Panel](https://developer.chrome.com/docs/devtools/storage/indexeddb/)
- [Lighthouse PWA Audit](https://developer.chrome.com/docs/lighthouse/pwa/)
- [Workbox (para Service Workers)](https://developer.chrome.com/docs/workbox/)

## 💡 Tips de Desarrollo

### Testing Offline
1. Usa Chrome DevTools Network throttling
2. Prueba con conexiones lentas (3G, 2G)
3. Simula pérdida repentina de conexión
4. Verifica comportamiento en diferentes browsers

### Performance
1. Limita el tamaño del caché
2. Implementa expiración de datos
3. Usa indexes en IndexedDB para queries rápidas
4. Batch multiple updates

### UX
1. Siempre muestra feedback al usuario
2. Indica claramente el estado offline
3. Explica qué funciones están disponibles offline
4. Muestra progreso de sincronización

---

## 🎉 Resultado

Con estas implementaciones, Family Sync App ahora es una **verdadera PWA** que funciona completamente offline, proporcionando una experiencia fluida sin importar el estado de la conexión.

**Características Principales:**
- ✅ Funciona 100% offline
- ✅ Sincronización automática
- ✅ Cola de acciones pendientes
- ✅ Indicadores visuales claros
- ✅ Background sync cuando es posible
- ✅ Optimistic updates para mejor UX

¡Disfruta tu app offline! 🚀
