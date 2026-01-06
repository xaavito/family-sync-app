import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/services/api';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!token.value);

  const setAuth = (newToken, newUser) => {
    token.value = newToken;
    user.value = newUser;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    api.setAuthToken(newToken);
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      setAuth(response.data.token, response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', { username, email, password });
      setAuth(response.data.token, response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    api.setAuthToken('');
  };

  // Inicializar token en api si existe
  if (token.value) {
    api.setAuthToken(token.value);
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    register,
    logout,
  };
});
