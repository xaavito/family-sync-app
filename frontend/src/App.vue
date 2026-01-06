<template>
  <div id="app">
    <div v-if="authStore.isAuthenticated" class="app-container">
      <nav class="bottom-nav">
        <router-link to="/shopping" class="nav-item">
          <span class="nav-icon">🛒</span>
          <span class="nav-label">Compras</span>
        </router-link>
        <router-link to="/calendar" class="nav-item">
          <span class="nav-icon">📅</span>
          <span class="nav-label">Calendario</span>
        </router-link>
        <router-link to="/profile" class="nav-item">
          <span class="nav-icon">👤</span>
          <span class="nav-label">Perfil</span>
        </router-link>
      </nav>
    </div>
    
    <main class="main-content" :class="{ 'with-nav': authStore.isAuthenticated }">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from '@/stores/auth';

const authStore = useAuthStore();
</script>

<style>
:root {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --success: #10b981;
  --danger: #ef4444;
  --warning: #f59e0b;
  --gray-50: #f9fafb;
  --gray-100: #f3f4f6;
  --gray-200: #e5e7eb;
  --gray-300: #d1d5db;
  --gray-600: #4b5563;
  --gray-800: #1f2937;
  --gray-900: #111827;
}

body {
  margin: 0;
  padding: 0;
  background: var(--gray-100);
}

.app-container {
  position: relative;
  min-height: 100vh;
}

.main-content {
  padding-bottom: 80px;
  min-height: 100vh;
}

.main-content.with-nav {
  padding-bottom: 80px;
}

.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  display: flex;
  justify-content: space-around;
  padding: 8px 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  z-index: 100;
  safe-area-inset-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  text-decoration: none;
  color: var(--gray-600);
  transition: color 0.2s;
  flex: 1;
}

.nav-item.router-link-active {
  color: var(--primary);
}

.nav-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.nav-label {
  font-size: 12px;
  font-weight: 500;
}

/* Utility classes */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: white;
}

.btn-primary:hover {
  background: var(--primary-dark);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-success {
  background: var(--success);
  color: white;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--gray-300);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--primary);
}
</style>
