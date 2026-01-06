import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import offlineStorage from './services/offlineStorage';

// Registrar service worker manualmente
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('✅ Service Worker registrado:', registration);
      })
      .catch(error => {
        console.error('❌ Error al registrar Service Worker:', error);
      });
  });
}

const app = createApp(App);
const pinia = createPinia();

// Inicializar almacenamiento offline
offlineStorage.init()
  .then(() => {
    console.log('✅ Almacenamiento offline inicializado');
  })
  .catch((error) => {
    console.error('❌ Error al inicializar almacenamiento offline:', error);
  });

app.use(pinia);
app.use(router);

app.mount('#app');
