import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import './registerServiceWorker';
import offlineStorage from './services/offlineStorage';

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
