const webpush = require('web-push');
const db = require('../config/database');

// Configurar VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@familysync.app';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );
  console.log('✅ VAPID keys configuradas para push notifications');
} else {
  console.warn('⚠️  VAPID keys no configuradas. Push notifications deshabilitadas.');
}

// Cola de notificaciones pendientes (para agrupar)
const notificationQueue = new Map();
const BATCH_DELAY = 5000; // 5 segundos para agrupar

/**
 * Agregar notificación a la cola para agrupar
 */
function queueNotification(userId, type, data) {
  if (!notificationQueue.has(userId)) {
    notificationQueue.set(userId, []);
    
    // Programar envío después del delay
    setTimeout(() => {
      sendBatchedNotifications(userId);
    }, BATCH_DELAY);
  }
  
  notificationQueue.get(userId).push({ type, data, timestamp: Date.now() });
}

/**
 * Enviar notificaciones agrupadas
 */
async function sendBatchedNotifications(userId) {
  const notifications = notificationQueue.get(userId);
  if (!notifications || notifications.length === 0) {
    notificationQueue.delete(userId);
    return;
  }
  
  // Agrupar por tipo
  const grouped = notifications.reduce((acc, notif) => {
    if (!acc[notif.type]) {
      acc[notif.type] = [];
    }
    acc[notif.type].push(notif.data);
    return acc;
  }, {});
  
  // Crear mensaje agrupado
  let title = '📋 Family Sync';
  let body = '';
  let icon = '/img/icons/icon-192x192.png';
  
  const itemsAdded = grouped['ITEM_ADDED']?.length || 0;
  const itemsChecked = grouped['ITEM_CHECKED']?.length || 0;
  const itemsDeleted = grouped['ITEM_DELETED']?.length || 0;
  
  const messages = [];
  
  if (itemsAdded > 0) {
    const userName = grouped['ITEM_ADDED'][0].userName || 'Alguien';
    messages.push(`${userName} agregó ${itemsAdded} item${itemsAdded > 1 ? 's' : ''}`);
  }
  
  if (itemsChecked > 0) {
    const userName = grouped['ITEM_CHECKED'][0].userName || 'Alguien';
    messages.push(`${userName} marcó ${itemsChecked} item${itemsChecked > 1 ? 's' : ''}`);
  }
  
  if (itemsDeleted > 0) {
    messages.push(`${itemsDeleted} item${itemsDeleted > 1 ? 's fueron eliminados' : ' fue eliminado'}`);
  }
  
  body = messages.join(' • ');
  
  if (body) {
    await sendPushNotification(userId, {
      title,
      body,
      icon,
      badge: '/img/icons/icon-96x96.png',
      tag: 'shopping-update',
      data: {
        url: '/shopping',
        timestamp: Date.now()
      }
    });
  }
  
  notificationQueue.delete(userId);
}

/**
 * Enviar notificación push a un usuario
 */
async function sendPushNotification(userId, payload) {
  try {
    // Obtener todas las suscripciones del usuario
    const result = await db.query(
      'SELECT * FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) {
      console.log(`Usuario ${userId} no tiene suscripciones push`);
      return;
    }
    
    // Enviar a todas las suscripciones
    const promises = result.rows.map(async (subscription) => {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          auth: subscription.auth_key,
          p256dh: subscription.p256dh_key
        }
      };
      
      try {
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );
        
        // Actualizar last_used_at
        await db.query(
          'UPDATE push_subscriptions SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1',
          [subscription.id]
        );
        
        console.log(`✅ Notificación enviada a suscripción ${subscription.id}`);
      } catch (error) {
        console.error(`Error al enviar notificación a suscripción ${subscription.id}:`, error);
        
        // Si el endpoint expiró (410 Gone), eliminarlo
        if (error.statusCode === 410) {
          await db.query('DELETE FROM push_subscriptions WHERE id = $1', [subscription.id]);
          console.log(`🗑️  Suscripción ${subscription.id} eliminada (expirada)`);
        }
      }
    });
    
    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Error al enviar notificación push:', error);
  }
}

/**
 * Notificar cuando se agrega un item
 */
async function notifyItemAdded(listId, itemName, userName, excludeUserId) {
  try {
    // Obtener todos los usuarios que tienen items en esta lista (excepto quien agregó)
    const result = await db.query(
      `SELECT DISTINCT user_id 
       FROM (
         SELECT added_by as user_id FROM shopping_items WHERE list_id = $1
         UNION
         SELECT checked_by as user_id FROM shopping_items WHERE list_id = $1
       ) users
       WHERE user_id IS NOT NULL AND user_id != $2`,
      [listId, excludeUserId]
    );
    
    // Agregar a cola para cada usuario
    result.rows.forEach(row => {
      queueNotification(row.user_id, 'ITEM_ADDED', {
        itemName,
        userName,
        listId
      });
    });
  } catch (error) {
    console.error('Error al notificar item agregado:', error);
  }
}

/**
 * Notificar cuando se marca un item
 */
async function notifyItemChecked(listId, itemName, userName, excludeUserId) {
  try {
    const result = await db.query(
      `SELECT DISTINCT user_id 
       FROM (
         SELECT added_by as user_id FROM shopping_items WHERE list_id = $1
         UNION
         SELECT checked_by as user_id FROM shopping_items WHERE list_id = $1
       ) users
       WHERE user_id IS NOT NULL AND user_id != $2`,
      [listId, excludeUserId]
    );
    
    result.rows.forEach(row => {
      queueNotification(row.user_id, 'ITEM_CHECKED', {
        itemName,
        userName,
        listId
      });
    });
  } catch (error) {
    console.error('Error al notificar item marcado:', error);
  }
}

/**
 * Notificar cuando se elimina un item
 */
async function notifyItemDeleted(listId, itemName, excludeUserId) {
  try {
    const result = await db.query(
      `SELECT DISTINCT user_id 
       FROM (
         SELECT added_by as user_id FROM shopping_items WHERE list_id = $1
         UNION
         SELECT checked_by as user_id FROM shopping_items WHERE list_id = $1
       ) users
       WHERE user_id IS NOT NULL AND user_id != $2`,
      [listId, excludeUserId]
    );
    
    result.rows.forEach(row => {
      queueNotification(row.user_id, 'ITEM_DELETED', {
        itemName,
        listId
      });
    });
  } catch (error) {
    console.error('Error al notificar item eliminado:', error);
  }
}

/**
 * Enviar notificación de prueba
 */
async function sendTestNotification(userId) {
  return sendPushNotification(userId, {
    title: '🔔 Notificaciones Activadas',
    body: 'Las notificaciones push están funcionando correctamente!',
    icon: '/img/icons/icon-192x192.png',
    badge: '/img/icons/icon-96x96.png',
    tag: 'test-notification',
    data: {
      url: '/',
      test: true
    }
  });
}

module.exports = {
  sendPushNotification,
  notifyItemAdded,
  notifyItemChecked,
  notifyItemDeleted,
  sendTestNotification
};
