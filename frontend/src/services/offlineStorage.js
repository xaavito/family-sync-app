// IndexedDB wrapper para almacenamiento offline
class OfflineStorage {
  constructor() {
    this.dbName = 'FamilySyncDB';
    this.version = 1;
    this.db = null;
  }

  // Inicializar la base de datos
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB inicializado correctamente');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store para items de compras
        if (!db.objectStoreNames.contains('shoppingItems')) {
          const shoppingStore = db.createObjectStore('shoppingItems', {
            keyPath: 'id',
            autoIncrement: true,
          });
          shoppingStore.createIndex('name', 'name', { unique: false });
          shoppingStore.createIndex('completed', 'completed', { unique: false });
          shoppingStore.createIndex('synced', 'synced', { unique: false });
        }

        // Store para eventos de calendario
        if (!db.objectStoreNames.contains('calendarEvents')) {
          const calendarStore = db.createObjectStore('calendarEvents', {
            keyPath: 'id',
          });
          calendarStore.createIndex('start', 'start', { unique: false });
          calendarStore.createIndex('synced', 'synced', { unique: false });
        }

        // Store para cola de sincronización (pending actions)
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para metadata (última sincronización, etc)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  // Obtener todos los items de un store
  async getAll(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Obtener un item por ID
  async get(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Guardar o actualizar un item
  async put(storeName, item) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Guardar múltiples items
  async putAll(storeName, items) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach((item) => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Eliminar un item
  async delete(storeName, id) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Limpiar todo un store
  async clear(storeName) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== MÉTODOS ESPECÍFICOS PARA SHOPPING =====

  async getShoppingItems() {
    return this.getAll('shoppingItems');
  }

  async saveShoppingItem(item) {
    const itemWithSync = {
      ...item,
      synced: false,
      lastModified: new Date().toISOString(),
    };
    return this.put('shoppingItems', itemWithSync);
  }

  async saveShoppingItems(items) {
    const itemsWithSync = items.map((item) => ({
      ...item,
      synced: true,
      lastModified: new Date().toISOString(),
    }));
    await this.clear('shoppingItems');
    return this.putAll('shoppingItems', itemsWithSync);
  }

  async deleteShoppingItem(id) {
    return this.delete('shoppingItems', id);
  }

  // ===== MÉTODOS ESPECÍFICOS PARA CALENDAR =====

  async getCalendarEvents() {
    return this.getAll('calendarEvents');
  }

  async saveCalendarEvents(events) {
    const eventsWithSync = events.map((event) => ({
      ...event,
      synced: true,
      lastModified: new Date().toISOString(),
    }));
    await this.clear('calendarEvents');
    return this.putAll('calendarEvents', eventsWithSync);
  }

  // ===== COLA DE SINCRONIZACIÓN =====

  async addToSyncQueue(action) {
    const queueItem = {
      ...action,
      timestamp: new Date().toISOString(),
    };
    return this.put('syncQueue', queueItem);
  }

  async getSyncQueue() {
    return this.getAll('syncQueue');
  }

  async removeFromSyncQueue(id) {
    return this.delete('syncQueue', id);
  }

  async clearSyncQueue() {
    return this.clear('syncQueue');
  }

  // ===== METADATA =====

  async setMetadata(key, value) {
    return this.put('metadata', { key, value });
  }

  async getMetadata(key) {
    const result = await this.get('metadata', key);
    return result ? result.value : null;
  }

  async setLastSync(type) {
    return this.setMetadata(`lastSync_${type}`, new Date().toISOString());
  }

  async getLastSync(type) {
    return this.getMetadata(`lastSync_${type}`);
  }
}

// Exportar instancia singleton
const offlineStorage = new OfflineStorage();
export default offlineStorage;
