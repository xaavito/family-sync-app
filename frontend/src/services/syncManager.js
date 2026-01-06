import offlineStorage from './offlineStorage';
import api from './api';

class SyncManager {
  constructor() {
    this.isSyncing = false;
    this.syncListeners = [];
    this.initServiceWorkerListener();
  }

  // Inicializar listener del Service Worker
  initServiceWorkerListener() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_SHOPPING_ITEMS') {
          this.syncShoppingItems();
        }
        if (event.data.type === 'SYNC_CALENDAR_EVENTS') {
          this.syncCalendarEvents();
        }
      });
    }
  }

  // Registrar listener para cambios de sincronización
  addSyncListener(callback) {
    this.syncListeners.push(callback);
  }

  // Notificar a los listeners
  notifyListeners(event) {
    this.syncListeners.forEach((callback) => callback(event));
  }

  // Verificar si hay conexión
  isOnline() {
    return navigator.onLine;
  }

  // ===== SHOPPING ITEMS =====

  async loadShoppingItems() {
    try {
      // Intentar cargar desde el servidor si hay conexión
      if (this.isOnline()) {
        // Primero obtener las listas
        const listsResponse = await api.get('/shopping/lists');
        const lists = listsResponse.data.lists || [];
        
        // Obtener items de la primera lista (o crear una si no existe)
        let listId = 1;
        if (lists.length === 0) {
          const newListResponse = await api.post('/shopping/lists', { name: 'Lista Principal' });
          listId = newListResponse.data.list.id;
        } else {
          listId = lists[0].id;
        }
        
        // Obtener items de la lista
        const response = await api.get(`/shopping/lists/${listId}/items`);
        const items = response.data.items || [];
        
        // Guardar en IndexedDB
        await offlineStorage.saveShoppingItems(items);
        await offlineStorage.setLastSync('shopping');
        
        // Guardar el listId para usarlo después
        localStorage.setItem('currentListId', listId);
        
        return items;
      } else {
        // Cargar desde IndexedDB si no hay conexión
        const items = await offlineStorage.getShoppingItems();
        console.log('Cargando items offline:', items.length);
        return items;
      }
    } catch (error) {
      console.error('Error al cargar items, usando caché:', error);
      // Si falla, cargar desde IndexedDB
      return await offlineStorage.getShoppingItems();
    }
  }

  async addShoppingItem(name) {
    const item = {
      name,
      completed: false,
      created_at: new Date().toISOString(),
    };

    try {
      if (this.isOnline()) {
        // Obtener el listId actual
        const listId = localStorage.getItem('currentListId') || 1;
        
        // Intentar agregar al servidor
        const response = await api.post(`/shopping/lists/${listId}/items`, item);
        const savedItem = response.data.item;
        
        // Guardar en IndexedDB
        await offlineStorage.saveShoppingItem(savedItem);
        
        return savedItem;
      } else {
        // Guardar offline y agregar a la cola de sincronización
        const tempId = `temp_${Date.now()}`;
        const offlineItem = { ...item, id: tempId };
        
        await offlineStorage.saveShoppingItem(offlineItem);
        await offlineStorage.addToSyncQueue({
          type: 'ADD_SHOPPING_ITEM',
          data: item,
          tempId: tempId,
        });

        // Registrar background sync si está disponible
        this.registerBackgroundSync('sync-shopping-items');
        
        return offlineItem;
      }
    } catch (error) {
      console.error('Error al agregar item:', error);
      
      // Si falla la request, guardar offline
      const tempId = `temp_${Date.now()}`;
      const offlineItem = { ...item, id: tempId };
      
      await offlineStorage.saveShoppingItem(offlineItem);
      await offlineStorage.addToSyncQueue({
        type: 'ADD_SHOPPING_ITEM',
        data: item,
        tempId: tempId,
      });

      this.registerBackgroundSync('sync-shopping-items');
      
      return offlineItem;
    }
  }

  async toggleShoppingItem(id, completed) {
    try {
      if (this.isOnline()) {
        // Actualizar en el servidor
        await api.patch(`/shopping/items/${id}`, { checked: completed });
        
        // Actualizar en IndexedDB
        const item = await offlineStorage.get('shoppingItems', id);
        if (item) {
          await offlineStorage.saveShoppingItem({ ...item, completed });
        }
      } else {
        // Actualizar solo en IndexedDB
        const item = await offlineStorage.get('shoppingItems', id);
        if (item) {
          await offlineStorage.saveShoppingItem({ ...item, completed });
          
          // Agregar a la cola de sincronización
          await offlineStorage.addToSyncQueue({
            type: 'UPDATE_SHOPPING_ITEM',
            data: { id, completed },
          });

          this.registerBackgroundSync('sync-shopping-items');
        }
      }
    } catch (error) {
      console.error('Error al actualizar item:', error);
      
      // Si falla, guardar la acción para sincronizar después
      const item = await offlineStorage.get('shoppingItems', id);
      if (item) {
        await offlineStorage.saveShoppingItem({ ...item, completed });
        await offlineStorage.addToSyncQueue({
          type: 'UPDATE_SHOPPING_ITEM',
          data: { id, completed },
        });

        this.registerBackgroundSync('sync-shopping-items');
      }
    }
  }

  async deleteShoppingItem(id) {
    try {
      if (this.isOnline()) {
        // Eliminar del servidor
        await api.delete(`/shopping/items/${id}`);
        
        // Eliminar de IndexedDB
        await offlineStorage.deleteShoppingItem(id);
      } else {
        // Eliminar de IndexedDB
        await offlineStorage.deleteShoppingItem(id);
        
        // Agregar a la cola de sincronización
        await offlineStorage.addToSyncQueue({
          type: 'DELETE_SHOPPING_ITEM',
          data: { id },
        });

        this.registerBackgroundSync('sync-shopping-items');
      }
    } catch (error) {
      console.error('Error al eliminar item:', error);
      
      await offlineStorage.deleteShoppingItem(id);
      await offlineStorage.addToSyncQueue({
        type: 'DELETE_SHOPPING_ITEM',
        data: { id },
      });

      this.registerBackgroundSync('sync-shopping-items');
    }
  }

  async clearCompletedItems() {
    try {
      if (this.isOnline()) {
        // Obtener el listId actual
        const listId = localStorage.getItem('currentListId') || 1;
        await api.delete(`/shopping/lists/${listId}/clear`);
        
        // Recargar items
        return await this.loadShoppingItems();
      } else {
        // Eliminar localmente
        const items = await offlineStorage.getShoppingItems();
        const itemsToKeep = items.filter((item) => !item.completed);
        
        await offlineStorage.clear('shoppingItems');
        await offlineStorage.putAll('shoppingItems', itemsToKeep);
        
        // Agregar a la cola
        await offlineStorage.addToSyncQueue({
          type: 'CLEAR_COMPLETED',
        });

        this.registerBackgroundSync('sync-shopping-items');
        
        return itemsToKeep;
      }
    } catch (error) {
      console.error('Error al limpiar items:', error);
      throw error;
    }
  }

  // Sincronizar items pendientes
  async syncShoppingItems() {
    if (this.isSyncing || !this.isOnline()) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'SYNC_START', category: 'shopping' });

    try {
      const queue = await offlineStorage.getSyncQueue();
      const shoppingQueue = queue.filter((item) =>
        item.type.includes('SHOPPING')
      );

      console.log('Sincronizando', shoppingQueue.length, 'acciones pendientes...');

      for (const queueItem of shoppingQueue) {
        try {
          switch (queueItem.type) {
            case 'ADD_SHOPPING_ITEM':
              const response = await api.post('/shopping', queueItem.data);
              // Actualizar el item temporal con el ID real
              await offlineStorage.deleteShoppingItem(queueItem.tempId);
              await offlineStorage.saveShoppingItem(response.data);
              break;

            case 'UPDATE_SHOPPING_ITEM':
              await api.patch(
                `/shopping/${queueItem.data.id}`,
                { completed: queueItem.data.completed }
              );
              break;

            case 'DELETE_SHOPPING_ITEM':
              await api.delete(`/shopping/${queueItem.data.id}`);
              break;

            case 'CLEAR_COMPLETED':
              await api.delete('/shopping/completed');
              break;
          }

          // Eliminar de la cola
          await offlineStorage.removeFromSyncQueue(queueItem.id);
        } catch (error) {
          console.error('Error al sincronizar acción:', queueItem, error);
          // Continuar con el siguiente item
        }
      }

      // Recargar items del servidor
      await this.loadShoppingItems();

      this.notifyListeners({ type: 'SYNC_SUCCESS', category: 'shopping' });
    } catch (error) {
      console.error('Error en sincronización:', error);
      this.notifyListeners({ type: 'SYNC_ERROR', category: 'shopping', error });
    } finally {
      this.isSyncing = false;
    }
  }

  // ===== CALENDAR EVENTS =====

  async loadCalendarEvents() {
    try {
      if (this.isOnline()) {
        const response = await api.get('/calendar/events');
        const events = response.data;
        
        await offlineStorage.saveCalendarEvents(events);
        await offlineStorage.setLastSync('calendar');
        
        return events;
      } else {
        const events = await offlineStorage.getCalendarEvents();
        console.log('Cargando eventos offline:', events.length);
        return events;
      }
    } catch (error) {
      console.error('Error al cargar eventos, usando caché:', error);
      return await offlineStorage.getCalendarEvents();
    }
  }

  async syncCalendarEvents() {
    if (this.isSyncing || !this.isOnline()) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners({ type: 'SYNC_START', category: 'calendar' });

    try {
      await this.loadCalendarEvents();
      this.notifyListeners({ type: 'SYNC_SUCCESS', category: 'calendar' });
    } catch (error) {
      console.error('Error en sincronización de calendario:', error);
      this.notifyListeners({ type: 'SYNC_ERROR', category: 'calendar', error });
    } finally {
      this.isSyncing = false;
    }
  }

  // ===== BACKGROUND SYNC =====

  async registerBackgroundSync(tag) {
    if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register(tag);
        console.log('Background sync registrado:', tag);
      } catch (error) {
        console.error('Error al registrar background sync:', error);
      }
    }
  }

  // Forzar sincronización manual
  async forceSyncAll() {
    if (!this.isOnline()) {
      throw new Error('No hay conexión a internet');
    }

    await this.syncShoppingItems();
    await this.syncCalendarEvents();
  }

  // Obtener estado de sincronización
  async getSyncStatus() {
    const queue = await offlineStorage.getSyncQueue();
    const lastSyncShopping = await offlineStorage.getLastSync('shopping');
    const lastSyncCalendar = await offlineStorage.getLastSync('calendar');

    return {
      pendingActions: queue.length,
      lastSyncShopping,
      lastSyncCalendar,
      isOnline: this.isOnline(),
    };
  }
}

const syncManager = new SyncManager();

// Sincronizar cuando vuelve la conexión
window.addEventListener('online', () => {
  console.log('Conexión restaurada, sincronizando...');
  syncManager.forceSyncAll().catch(console.error);
});

window.addEventListener('offline', () => {
  console.log('Sin conexión, modo offline activado');
});

export default syncManager;
