import api from './api';

class PushNotificationService {
  constructor() {
    this.vapidPublicKey = null;
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /**
   * Verificar si las notificaciones push están soportadas
   */
  isNotificationSupported() {
    return this.isSupported;
  }

  /**
   * Verificar permiso actual de notificaciones
   */
  getPermissionStatus() {
    if (!this.isSupported) {
      return 'unsupported';
    }
    return Notification.permission;
  }

  /**
   * Obtener la clave pública VAPID del servidor
   */
  async getVapidPublicKey() {
    if (this.vapidPublicKey) {
      return this.vapidPublicKey;
    }

    try {
      const response = await api.get('/notifications/vapid-public-key');
      this.vapidPublicKey = response.data.publicKey;
      return this.vapidPublicKey;
    } catch (error) {
      console.error('Error al obtener clave VAPID:', error);
      throw new Error('No se pudo obtener la clave de notificaciones del servidor');
    }
  }

  /**
   * Solicitar permiso para mostrar notificaciones
   */
  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Las notificaciones push no están soportadas en este navegador');
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      throw new Error('Los permisos de notificación fueron denegados previamente');
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Convertir clave VAPID de base64 a Uint8Array
   */
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Suscribirse a notificaciones push
   */
  async subscribe() {
    try {
      // Verificar soporte
      if (!this.isSupported) {
        throw new Error('Las notificaciones push no están soportadas');
      }

      // Solicitar permiso
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Permiso de notificaciones denegado');
      }

      // Obtener clave VAPID
      const vapidPublicKey = await this.getVapidPublicKey();

      // Esperar a que el service worker esté listo
      const registration = await navigator.serviceWorker.ready;

      // Verificar si ya hay una suscripción activa
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Crear nueva suscripción
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
        });
      }

      // Enviar suscripción al servidor
      await api.post('/notifications/subscribe', {
        endpoint: subscription.endpoint,
        keys: {
          auth: arrayBufferToBase64(subscription.getKey('auth')),
          p256dh: arrayBufferToBase64(subscription.getKey('p256dh'))
        },
        deviceName: this.getDeviceName()
      });

      console.log('✅ Suscrito a notificaciones push');
      return true;
    } catch (error) {
      console.error('Error al suscribirse a notificaciones:', error);
      throw error;
    }
  }

  /**
   * Desuscribirse de notificaciones push
   */
  async unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Eliminar suscripción del navegador
        await subscription.unsubscribe();

        // Eliminar suscripción del servidor
        await api.post('/notifications/unsubscribe', {
          endpoint: subscription.endpoint
        });

        console.log('✅ Desuscrito de notificaciones push');
      }

      return true;
    } catch (error) {
      console.error('Error al desuscribirse:', error);
      throw error;
    }
  }

  /**
   * Verificar si el usuario está suscrito
   */
  async isSubscribed() {
    try {
      if (!this.isSupported) {
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      return subscription !== null;
    } catch (error) {
      console.error('Error al verificar suscripción:', error);
      return false;
    }
  }

  /**
   * Enviar notificación de prueba
   */
  async sendTestNotification() {
    try {
      await api.post('/notifications/test');
      console.log('✅ Notificación de prueba enviada');
      return true;
    } catch (error) {
      console.error('Error al enviar notificación de prueba:', error);
      throw error;
    }
  }

  /**
   * Obtener nombre del dispositivo
   */
  getDeviceName() {
    const ua = navigator.userAgent;
    let deviceName = 'Dispositivo';

    if (/Android/i.test(ua)) {
      deviceName = 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
      deviceName = 'iOS';
    } else if (/Windows/i.test(ua)) {
      deviceName = 'Windows';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      deviceName = 'Mac';
    } else if (/Linux/i.test(ua)) {
      deviceName = 'Linux';
    }

    // Agregar tipo de navegador
    if (/Chrome/i.test(ua)) {
      deviceName += ' - Chrome';
    } else if (/Firefox/i.test(ua)) {
      deviceName += ' - Firefox';
    } else if (/Safari/i.test(ua)) {
      deviceName += ' - Safari';
    } else if (/Edge/i.test(ua)) {
      deviceName += ' - Edge';
    }

    return deviceName;
  }
}

/**
 * Convertir ArrayBuffer a base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Exportar instancia singleton
const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
