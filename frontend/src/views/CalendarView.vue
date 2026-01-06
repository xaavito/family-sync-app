<template>
  <div class="calendar-view">
    <header class="header">
      <h1>📅 Calendario</h1>
      <div class="header-actions">
        <span v-if="!isOnline" class="offline-badge">📵 Offline</span>
        <button @click="syncCalendar" class="btn-sync" :disabled="syncing">
          {{ syncing ? '⏳' : '🔄' }}
        </button>
      </div>
    </header>

    <div class="container">
      <div v-if="!isAuthorized" class="auth-card">
        <h3>🔐 Autorización requerida</h3>
        <p>Necesitas autorizar acceso a tu Google Calendar para sincronizar eventos.</p>
        <button @click="authorizeGoogle" class="btn btn-primary">
          Autorizar Google Calendar
        </button>
      </div>

      <div v-else>
        <div v-if="loading" class="loading">Cargando eventos...</div>

        <div v-else-if="events.length === 0" class="empty-state">
          <p>📭 No hay eventos próximos</p>
          <button @click="syncCalendar" class="btn btn-primary">
            Sincronizar ahora
          </button>
        </div>

        <div v-else class="events-list">
          <div v-for="event in events" :key="event.id" class="event-card">
            <div class="event-date">
              <div class="day">{{ formatDay(event.start_time) }}</div>
              <div class="month">{{ formatMonth(event.start_time) }}</div>
            </div>
            <div class="event-content">
              <h3 class="event-title">{{ event.summary }}</h3>
              <p class="event-time">{{ formatTime(event.start_time) }}</p>
              <p v-if="event.location" class="event-location">📍 {{ event.location }}</p>
              <p v-if="event.description" class="event-description">{{ event.description }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import api from '@/services/api';
import syncManager from '@/services/syncManager';

const events = ref([]);
const loading = ref(false);
const syncing = ref(false);
const isAuthorized = ref(false);
const isOnline = ref(navigator.onLine);

// Actualizar estado de conexión
const updateOnlineStatus = () => {
  isOnline.value = navigator.onLine;
};

// Listener de sincronización
const handleSyncEvent = (event) => {
  if (event.category === 'calendar') {
    if (event.type === 'SYNC_START') {
      syncing.value = true;
    } else if (event.type === 'SYNC_SUCCESS') {
      syncing.value = false;
      loadEvents();
    } else if (event.type === 'SYNC_ERROR') {
      syncing.value = false;
      console.error('Error en sincronización:', event.error);
    }
  }
};

const checkAuthStatus = async () => {
  try {
    const response = await api.get('/calendar/auth-status');
    isAuthorized.value = response.data.isAuthorized;
  } catch (error) {
    console.error('Error al verificar estado:', error);
  }
};

const authorizeGoogle = async () => {
  try {
    const response = await api.get('/calendar/auth-url');
    window.open(response.data.authUrl, '_blank', 'width=500,height=600');
    
    // Verificar estado después de 5 segundos
    setTimeout(async () => {
      await checkAuthStatus();
      if (isAuthorized.value) {
        await loadEvents();
      }
    }, 5000);
  } catch (error) {
    console.error('Error al obtener URL de autorización:', error);
  }
};

const syncCalendar = async () => {
  if (!isOnline.value) {
    console.log('Sin conexión, cargando eventos desde caché');
    await loadEvents();
    return;
  }

  syncing.value = true;
  try {
    await api.post('/calendar/sync');
    await syncManager.syncCalendarEvents();
    await loadEvents();
  } catch (error) {
    console.error('Error al sincronizar calendario:', error);
    if (error.response?.data?.needsAuth) {
      isAuthorized.value = false;
    }
  } finally {
    syncing.value = false;
  }
};

const loadEvents = async () => {
  loading.value = true;
  try {
    const loadedEvents = await syncManager.loadCalendarEvents();
    events.value = loadedEvents;
  } catch (error) {
    console.error('Error al cargar eventos:', error);
  } finally {
    loading.value = false;
  }
};

const formatDay = (dateStr) => {
  const date = new Date(dateStr);
  return date.getDate();
};

const formatMonth = (dateStr) => {
  const date = new Date(dateStr);
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return months[date.getMonth()];
};

const formatTime = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

onMounted(async () => {
  await checkAuthStatus();
  if (isAuthorized.value) {
    await loadEvents();
  }
  
  // Escuchar eventos de conexión
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Registrar listener de sincronización
  syncManager.addSyncListener(handleSyncEvent);
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
});
</script>

<style scoped>
.calendar-view {
  min-height: 100vh;
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

.offline-badge {
  font-size: 14px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #fee;
  color: #c33;
}

.btn-sync {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-sync:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.auth-card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
}

.auth-card h3 {
  margin: 0 0 10px 0;
  color: var(--gray-900);
}

.auth-card p {
  color: var(--gray-600);
  margin-bottom: 20px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: var(--gray-600);
}

.empty-state {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 12px;
}

.empty-state p {
  font-size: 18px;
  color: var(--gray-600);
  margin-bottom: 20px;
}

.events-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.event-date {
  background: var(--primary);
  color: white;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  min-width: 60px;
}

.event-date .day {
  font-size: 24px;
  font-weight: bold;
}

.event-date .month {
  font-size: 12px;
  text-transform: uppercase;
}

.event-content {
  flex: 1;
}

.event-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--gray-900);
}

.event-time {
  margin: 0 0 4px 0;
  font-size: 14px;
  color: var(--gray-600);
}

.event-location {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: var(--gray-500);
}

.event-description {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: var(--gray-700);
  line-height: 1.4;
}
</style>
