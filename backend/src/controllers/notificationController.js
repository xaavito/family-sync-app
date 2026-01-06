const db = require('../config/database');
const pushService = require('../services/pushService');

// Obtener la clave pública VAPID
const getVapidPublicKey = (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  
  if (!publicKey) {
    return res.status(503).json({ 
      error: 'Push notifications no configuradas en el servidor' 
    });
  }
  
  res.json({ publicKey });
};

// Suscribir dispositivo a notificaciones push
const subscribe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { endpoint, keys, deviceName } = req.body;
    
    if (!endpoint || !keys?.auth || !keys?.p256dh) {
      return res.status(400).json({ 
        error: 'Datos de suscripción incompletos' 
      });
    }
    
    // Verificar si ya existe esta suscripción
    const existing = await db.query(
      'SELECT id FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
      [userId, endpoint]
    );
    
    if (existing.rows.length > 0) {
      // Actualizar suscripción existente
      await db.query(
        `UPDATE push_subscriptions 
         SET auth_key = $1, p256dh_key = $2, device_name = $3, last_used_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [keys.auth, keys.p256dh, deviceName || 'Dispositivo', existing.rows[0].id]
      );
      
      return res.json({ 
        message: 'Suscripción actualizada',
        subscriptionId: existing.rows[0].id 
      });
    }
    
    // Crear nueva suscripción
    const result = await db.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, auth_key, p256dh_key, device_name) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id`,
      [userId, endpoint, keys.auth, keys.p256dh, deviceName || 'Dispositivo']
    );
    
    console.log(`✅ Usuario ${userId} suscrito a push notifications`);
    
    res.status(201).json({ 
      message: 'Suscripción creada exitosamente',
      subscriptionId: result.rows[0].id 
    });
  } catch (error) {
    console.error('Error al crear suscripción:', error);
    res.status(500).json({ error: 'Error al crear suscripción' });
  }
};

// Desuscribir dispositivo
const unsubscribe = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint requerido' });
    }
    
    const result = await db.query(
      'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2 RETURNING id',
      [userId, endpoint]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada' });
    }
    
    console.log(`✅ Usuario ${userId} desuscrito de push notifications`);
    
    res.json({ message: 'Desuscripción exitosa' });
  } catch (error) {
    console.error('Error al eliminar suscripción:', error);
    res.status(500).json({ error: 'Error al eliminar suscripción' });
  }
};

// Obtener suscripciones del usuario
const getSubscriptions = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const result = await db.query(
      `SELECT id, device_name, created_at, last_used_at 
       FROM push_subscriptions 
       WHERE user_id = $1 
       ORDER BY last_used_at DESC`,
      [userId]
    );
    
    res.json({ subscriptions: result.rows });
  } catch (error) {
    console.error('Error al obtener suscripciones:', error);
    res.status(500).json({ error: 'Error al obtener suscripciones' });
  }
};

// Enviar notificación de prueba
const sendTest = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Verificar que el usuario tenga suscripciones
    const result = await db.query(
      'SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    
    if (result.rows[0].count === '0') {
      return res.status(404).json({ 
        error: 'No tienes dispositivos suscritos a notificaciones' 
      });
    }
    
    await pushService.sendTestNotification(userId);
    
    res.json({ message: 'Notificación de prueba enviada' });
  } catch (error) {
    console.error('Error al enviar notificación de prueba:', error);
    res.status(500).json({ error: 'Error al enviar notificación de prueba' });
  }
};

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getSubscriptions,
  sendTest
};
