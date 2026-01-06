<template>
  <div class="profile-view">
    <header class="header">
      <h1>👤 Perfil</h1>
    </header>

    <div class="container">
      <div class="profile-card">
        <div class="profile-avatar">
          {{ user?.username?.charAt(0).toUpperCase() || '?' }}
        </div>
        <h2>{{ user?.username }}</h2>
        <p class="email">{{ user?.email }}</p>
      </div>

      <div class="menu-list">
        <div class="menu-item clickable" @click="toggleNotifications">
          <span class="menu-icon">🔔</span>
          <div class="menu-content">
            <div class="menu-title">Notificaciones Push</div>
            <div class="menu-subtitle">
              {{ notificationsEnabled ? 'Activadas' : 'Desactivadas' }}
              <span v-if="!notificationsSupported" class="error-text"> - No soportadas</span>
            </div>
          </div>
          <div class="menu-toggle">
            <label class="switch">
              <input 
                type="checkbox" 
                :checked="notificationsEnabled" 
                :disabled="!notificationsSupported || loading"
                @click.stop
              >
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div v-if="notificationsEnabled" class="menu-item clickable" @click="sendTestNotification">
          <span class="menu-icon">🧪</span>
          <div class="menu-content">
            <div class="menu-title">Probar Notificación</div>
            <div class="menu-subtitle">Enviar una notificación de prueba</div>
          </div>
          <span class="menu-arrow">→</span>
        </div>

        <div class="menu-item">
          <span class="menu-icon">ℹ️</span>
          <div class="menu-content">
            <div class="menu-title">Versión</div>
            <div class="menu-subtitle">1.0.0</div>
          </div>
        </div>

        <div class="menu-item">
          <span class="menu-icon">📱</span>
          <div class="menu-content">
            <div class="menu-title">Instalación</div>
            <div class="menu-subtitle">Agregar a pantalla de inicio para mejor experiencia</div>
          </div>
        </div>

        <div class="menu-item">
          <span class="menu-icon">📊</span>
          <div class="menu-content">
            <div class="menu-title">Base de Datos</div>
            <div class="menu-subtitle">PostgreSQL</div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button @click="handleLogout" class="btn btn-danger btn-block">
          Cerrar Sesión
        </button>
      </div>

      <div class="info-section">
        <h3>📖 Instrucciones</h3>
        <div class="info-card">
          <h4>🛒 Listas de Compras</h4>
          <ul>
            <li>Agrega items escribiendo y presionando Enter</li>
            <li>Marca items como completados con el checkbox</li>
            <li>Limpia items marcados con el botón "Limpiar"</li>
            <li>Los cambios se sincronizan automáticamente</li>
          </ul>
        </div>

        <div class="info-card">
          <h4>📅 Calendario</h4>
          <ul>
            <li>Autoriza acceso a tu Google Calendar</li>
            <li>Sincroniza eventos con el botón de actualizar</li>
            <li>Ve eventos de los próximos 30 días</li>
            <li>Los eventos se actualizan en tiempo real</li>
          </ul>
        </div>

        <div class="info-card">
          <h4>🍓 Raspberry Pi</h4>
          <ul>
            <li>Esta app está diseñada para correr en Raspberry Pi</li>
            <li>Usa Docker para fácil instalación</li>
            <li>Accede desde cualquier dispositivo en tu red</li>
            <li>Datos almacenados localmente en PostgreSQL</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { ref, computed, onMounted } from 'vue';
import pushNotificationService from '@/services/pushNotifications';

const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const notificationsSupported = ref(pushNotificationService.isNotificationSupported());
const notificationsEnabled = ref(false);
const loading = ref(false);

// Verificar estado inicial
onMounted(async () => {
  if (notificationsSupported.value) {
    notificationsEnabled.value = await pushNotificationService.isSubscribed();
  }
});

// Toggle de notificaciones
const toggleNotifications = async () => {
  if (!notificationsSupported.value || loading.value) {
    return;
  }

  loading.value = true;

  try {
    if (notificationsEnabled.value) {
      // Desactivar notificaciones
      await pushNotificationService.unsubscribe();
      notificationsEnabled.value = false;
      alert('✅ Notificaciones desactivadas');
    } else {
      // Activar notificaciones
      await pushNotificationService.subscribe();
      notificationsEnabled.value = true;
      alert('✅ Notificaciones activadas! Recibirás notificaciones cuando tu familia actualice la lista.');
    }
  } catch (error) {
    console.error('Error al cambiar notificaciones:', error);
    
    if (error.message.includes('denegado')) {
      alert('❌ Los permisos de notificación fueron denegados. Por favor, actívalos en la configuración del navegador.');
    } else {
      alert('❌ Error al configurar notificaciones. Intenta nuevamente.');
    }
  } finally {
    loading.value = false;
  }
};

// Enviar notificación de prueba
const sendTestNotification = async () => {
  if (loading.value) return;

  loading.value = true;

  try {
    await pushNotificationService.sendTestNotification();
    alert('✅ Notificación de prueba enviada! Deberías recibirla en unos segundos.');
  } catch (error) {
    console.error('Error al enviar notificación de prueba:', error);
    alert('❌ Error al enviar notificación de prueba.');
  } finally {
    loading.value = false;
  }
};

const handleLogout = () => {
  authStore.logout();
  router.push('/login');
};
</script>

<style scoped>
.profile-view {
  min-height: 100vh;
  background: var(--gray-100);
}

.header {
  background: white;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--gray-900);
}

.container {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.profile-card {
  background: white;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--primary);
  color: white;
  font-size: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-weight: bold;
}

.profile-card h2 {
  margin: 0 0 8px 0;
  color: var(--gray-900);
}

.email {
  color: var(--gray-600);
  margin: 0;
}

.menu-list {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid var(--gray-200);
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  font-size: 24px;
  margin-right: 16px;
}

.menu-content {
  flex: 1;
}

.menu-title {
  font-weight: 500;
  color: var(--gray-900);
  margin-bottom: 4px;
}

.menu-subtitle {
  font-size: 14px;
  color: var(--gray-600);
}

.actions {
  margin-bottom: 30px;
}

.btn-block {
  width: 100%;
  padding: 14px;
}

.info-section {
  margin-top: 30px;
}

.info-section h3 {
  color: var(--gray-900);
  margin-bottom: 16px;
  text-align: center;
}

.info-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.info-card h4 {
  margin: 0 0 12px 0;
  color: var(--gray-900);
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
  color: var(--gray-700);
  line-height: 1.6;
}

.info-card li {
  margin-bottom: 8px;
}

.menu-item.clickable {
  cursor: pointer;
  transition: background-color 0.2s;
}

.menu-item.clickable:hover {
  background-color: var(--gray-50);
}

.menu-toggle {
  margin-left: 12px;
}

.menu-arrow {
  font-size: 20px;
  color: var(--gray-400);
  margin-left: 12px;
}

.error-text {
  color: #ef4444;
}

/* Toggle Switch */
.switch {
  position: relative;
  display: inline-block;
  width: 51px;
  height: 28px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 28px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #6366f1;
}

input:focus + .slider {
  box-shadow: 0 0 1px #6366f1;
}

input:checked + .slider:before {
  transform: translateX(23px);
}

input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
