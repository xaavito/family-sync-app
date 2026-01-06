<template>
  <div class="login-container">
    <div class="login-card">
      <h1 class="logo">👨‍👩‍👧‍👦</h1>
      <h2>Family Sync</h2>
      <p class="subtitle">Sincroniza con tu familia</p>

      <form @submit.prevent="handleSubmit" class="login-form">
        <div v-if="error" class="error-message">{{ error }}</div>

        <div class="form-group">
          <input
            v-model="form.email"
            type="email"
            class="input"
            placeholder="Email"
            required
          />
        </div>

        <div v-if="isRegister" class="form-group">
          <input
            v-model="form.username"
            type="text"
            class="input"
            placeholder="Nombre de usuario"
            required
          />
        </div>

        <div class="form-group">
          <input
            v-model="form.password"
            type="password"
            class="input"
            placeholder="Contraseña"
            required
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" :disabled="loading">
          {{ loading ? 'Procesando...' : (isRegister ? 'Registrarse' : 'Iniciar Sesión') }}
        </button>
      </form>

      <div class="toggle-mode">
        <button @click="isRegister = !isRegister" class="link-btn">
          {{ isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const isRegister = ref(false);
const loading = ref(false);
const error = ref('');

const form = ref({
  email: '',
  username: '',
  password: '',
});

const handleSubmit = async () => {
  loading.value = true;
  error.value = '';

  try {
    if (isRegister.value) {
      await authStore.register(form.value.username, form.value.email, form.value.password);
    } else {
      await authStore.login(form.value.email, form.value.password);
    }
    router.push('/shopping');
  } catch (err) {
    error.value = err.response?.data?.error || 'Error al procesar la solicitud';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.logo {
  font-size: 64px;
  text-align: center;
  margin-bottom: 10px;
}

h2 {
  text-align: center;
  color: var(--gray-900);
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: var(--gray-600);
  margin-bottom: 32px;
}

.login-form {
  margin-bottom: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.btn-block {
  width: 100%;
  padding: 14px;
  font-size: 18px;
}

.error-message {
  background: #fee;
  color: var(--danger);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  text-align: center;
  font-size: 14px;
}

.toggle-mode {
  text-align: center;
}

.link-btn {
  background: none;
  border: none;
  color: var(--primary);
  cursor: pointer;
  font-size: 14px;
  padding: 8px;
}

.link-btn:hover {
  text-decoration: underline;
}
</style>
