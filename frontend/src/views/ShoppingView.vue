<template>
  <div class="shopping-view">
    <header class="header">
      <h1>🛒 Lista de Compras</h1>
      <div class="header-actions">
        <span v-if="!isOnline" class="offline-badge">📵 Offline</span>
        <span v-if="pendingSync > 0" class="sync-badge">⏳ {{ pendingSync }}</span>
        <button @click="loadItems" class="btn-refresh" :disabled="syncing">
          {{ syncing ? '⏳' : '🔄' }}
        </button>
      </div>
    </header>

    <div class="container">
      <div class="add-item-form">
        <input
          v-model="newItem"
          @keyup.enter="addItem"
          type="text"
          class="input"
          placeholder="Agregar item..."
        />
        <button @click="addItem" class="btn btn-primary">+</button>
      </div>

      <div v-if="loading" class="loading">Cargando...</div>

      <div v-else class="items-list">
        <div
          v-for="item in items"
          :key="item.id"
          class="item-card"
          :class="{ checked: item.checked }"
        >
          <input
            type="checkbox"
            :checked="item.checked"
            @change="toggleItem(item)"
            class="checkbox"
          />
          <div class="item-content">
            <span class="item-name">{{ item.name }}</span>
            <span v-if="item.quantity" class="item-quantity">{{ item.quantity }}</span>
            <span class="item-meta">{{ item.added_by_name }}</span>
          </div>
          <button @click="deleteItem(item.id)" class="btn-delete">🗑️</button>
        </div>
      </div>

      <div v-if="checkedCount > 0" class="actions">
        <button @click="clearChecked" class="btn btn-danger">
          Limpiar marcados ({{ checkedCount }})
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import syncManager from '@/services/syncManager';

const items = ref([]);
const newItem = ref('');
const loading = ref(false);
const syncing = ref(false);
const isOnline = ref(navigator.onLine);
const pendingSync = ref(0);

const checkedCount = computed(() => items.value.filter(i => i.completed).length);

// Actualizar estado de conexión
const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine;
};

// Listener de sincronización
const handleSyncEvent = (event) => {
  if (event.category === 'shopping') {
    if (event.type === 'SYNC_START') {
      syncing.value = true;
    } else if (event.type === 'SYNC_SUCCESS') {
      syncing.value = false;
      loadItems();
    } else if (event.type === 'SYNC_ERROR') {
      syncing.value = false;
      console.error('Error en sincronización:', event.error);
    }
  }
};

// Cargar items usando syncManager
const loadItems = async () => {
  loading.value = true;
  try {
    const loadedItems = await syncManager.loadShoppingItems();
    items.value = loadedItems;
    
    // Actualizar contador de acciones pendientes
    const status = await syncManager.getSyncStatus();
    pendingSync.value = status.pendingActions;
  } catch (error) {
    console.error('Error al cargar items:', error);
  } finally {
    loading.value = false;
  }
};

const addItem = async () => {
  if (!newItem.value.trim()) return;

  try {
    const item = await syncManager.addShoppingItem(newItem.value);
    items.value.push(item);
    newItem.value = '';
    
    // Actualizar contador
    const status = await syncManager.getSyncStatus();
    pendingSync.value = status.pendingActions;
  } catch (error) {
    console.error('Error al agregar item:', error);
  }
};

const toggleItem = async (item) => {
  try {
    // Actualizar UI inmediatamente (optimistic update)
    item.completed = !item.completed;
    
    // Sincronizar cambio
    await syncManager.toggleShoppingItem(item.id, item.completed);
    
    // Actualizar contador
    const status = await syncManager.getSyncStatus();
    pendingSync.value = status.pendingActions;
  } catch (error) {
    console.error('Error al actualizar item:', error);
    // Revertir cambio si falla
    item.completed = !item.completed;
  }
};

const deleteItem = async (itemId) => {
  try {
    await syncManager.deleteShoppingItem(itemId);
    items.value = items.value.filter(i => i.id !== itemId);
    
    // Actualizar contador
    const status = await syncManager.getSyncStatus();
    pendingSync.value = status.pendingActions;
  } catch (error) {
    console.error('Error al eliminar item:', error);
  }
};

const clearChecked = async () => {
  try {
    const updatedItems = await syncManager.clearCompletedItems();
    items.value = updatedItems;
    
    // Actualizar contador
    const status = await syncManager.getSyncStatus();
    pendingSync.value = status.pendingActions;
  } catch (error) {
    console.error('Error al limpiar items:', error);
  }
};

onMounted(() => {
  // Cargar items iniciales
  loadItems();
  
  // Escuchar eventos de conexión
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Registrar listener de sincronización
  syncManager.addSyncListener(handleSyncEvent);
  
  // Cargar estado inicial
  syncManager.getSyncStatus().then(status => {
    pendingSync.value = status.pendingActions;
  });
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<style scoped>
.shopping-view {
  background: var(--gray-100);
}

.header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--gray-900);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.offline-badge,
.sync-badge {
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--gray-200);
  color: var(--gray-700);
}

.offline-badge {
  background: #fee;
  color: #c33;
}

.sync-badge {
  background: #fef3c7;
  color: #92400e;
}

.btn-refresh {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.add-item-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.add-item-form .input {
  flex: 1;
}

.add-item-form .btn {
  padding: 12px 20px;
  font-size: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--gray-600);
}

.items-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.item-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: all 0.2s;
}

.item-card.checked {
  opacity: 0.6;
}

.item-card.checked .item-name {
  text-decoration: line-through;
}

.checkbox {
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name {
  font-size: 16px;
  color: var(--gray-900);
  font-weight: 500;
}

.item-quantity {
  font-size: 14px;
  color: var(--gray-600);
}

.item-meta {
  font-size: 12px;
  color: var(--gray-500);
}

.btn-delete {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.btn-delete:hover {
  opacity: 1;
}

.actions {
  margin-top: 20px;
  text-align: center;
}
</style>
