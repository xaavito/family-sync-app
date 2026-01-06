# 🔔 Notificaciones Push - Family Sync App

Las notificaciones push permiten que los usuarios reciban actualizaciones en tiempo real cuando otros miembros de la familia modifican la lista de compras.

## 🎯 Características

### ✅ Tipos de Notificaciones

**Lista de Compras:**
- ✅ Cuando alguien agrega items
- ✅ Cuando alguien marca items como comprados
- ✅ Notificaciones agrupadas (cada 5 segundos)

**Ejemplos:**
- "María agregó 3 items"
- "Juan marcó 2 items"
- "María agregó 3 items • Juan marcó 2 items"

## 🚀 Setup Inicial

### 1. Generar VAPID Keys

Las VAPID keys son necesarias para identificar tu servidor ante los navegadores:

```bash
cd backend
npx web-push generate-vapid-keys
```

Esto generará algo como:
```
===

vapidPublicKey:
BPyj...(tu-clave-publica)...

vapidPrivateKey:
Ab3f....(tu-clave-privada)...

===
```

### 2. Configurar Variables de Entorno

Edita `backend/.env`:

```env
VAPID_PUBLIC_KEY=BPyj...(tu-clave-publica)...
VAPID_PRIVATE_KEY=Ab3f...(tu-clave-privada)...
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

**IMPORTANTE:** 
- Nunca compartas la clave privada
- Usa el email real del administrador
- No subas las claves a git

### 3. Instalar Dependencia

```bash
cd backend
npm install web-push
```

### 4. Reiniciar Servicios

```bash
docker-compose down
docker-compose up -d --build
```

## 📱 Uso desde la App

### Activar Notificaciones

1. Abre la app en tu dispositivo
2. Ve a la pestaña **Perfil** (👤)
3. Activa el toggle **"Notificaciones Push"**
4. Acepta el permiso en el navegador
5. ¡Listo! Empezarás a recibir notificaciones

### Probar Notificaciones

1. En Perfil, toca **"Probar Notificación"**
2. Deberías recibir una notificación de prueba
3. Si no la recibes, revisa los permisos del navegador

### Desactivar Notificaciones

1. Ve a Perfil
2. Desactiva el toggle
3. Ya no recibirás notificaciones

## 🌐 Compatibilidad

### ✅ Totalmente Soportado

- **Chrome/Edge** (Desktop y Android): ✅ Full support
- **Firefox** (Desktop y Android): ✅ Full support
- **Safari iOS 16.4+**: ✅ Sí (requiere agregar a pantalla de inicio)
- **Samsung Internet**: ✅ Full support

### ⚠️ Limitaciones

- **Safari Desktop**: ❌ Soporte limitado/experimental
- **iOS Safari**: ⚠️ Solo funciona si la app está agregada a pantalla de inicio (PWA instalada)

### Verificar Soporte

La app detecta automáticamente si el navegador soporta notificaciones y muestra:
- **"Activadas/Desactivadas"** → Soportado
- **"No soportadas"** → Navegador no compatible

## 🛠️ Arquitectura Técnica

### Backend

```
shoppingController.js
    ↓ (al agregar/marcar item)
pushService.js → queueNotification()
    ↓ (agrupa por 5 segundos)
sendBatchedNotifications()
    ↓
web-push library → Envía al navegador
```

### Frontend

```
ProfileView.vue → Toggle ON
    ↓
pushNotifications.js → subscribe()
    ↓
Service Worker → Registra pushManager
    ↓
Backend → Guarda suscripción en BD
    ↓
Backend envía push → Service Worker recibe
    ↓
Muestra notificación
```

## 📊 Base de Datos

### Tabla: `push_subscriptions`

```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER (FK users)
endpoint        TEXT (único endpoint del navegador)
auth_key        TEXT (clave de autenticación)
p256dh_key      TEXT (clave de encriptación)
device_name     VARCHAR(100) (ej: "Android - Chrome")
created_at      TIMESTAMP
last_used_at    TIMESTAMP (última notificación enviada)
```

### Consultas Útiles

```sql
-- Ver suscripciones activas
SELECT u.username, ps.device_name, ps.last_used_at 
FROM push_subscriptions ps
JOIN users u ON ps.user_id = u.id;

-- Contar suscripciones por usuario
SELECT user_id, COUNT(*) as devices
FROM push_subscriptions
GROUP BY user_id;

-- Limpiar suscripciones viejas (>90 días sin usar)
DELETE FROM push_subscriptions
WHERE last_used_at < NOW() - INTERVAL '90 days';
```

## 🔐 Seguridad

### Buenas Prácticas

1. **VAPID Keys:**
   - Mantén la clave privada segura
   - No la subas a repositorios públicos
   - Usa variables de entorno

2. **Endpoints:**
   - Los endpoints son únicos por dispositivo
   - Expiran automáticamente (el navegador los renueva)
   - Se eliminan automáticamente si retornan 410

3. **Rate Limiting:**
   - Las notificaciones se agrupan cada 5 segundos
   - Evita enviar spam
   - Respeta los límites del navegador

4. **Privacidad:**
   - No envíes datos sensibles en el payload
   - Los datos van encriptados por HTTPS
   - Solo usuarios autenticados pueden suscribirse

## 🐛 Troubleshooting

### No recibo notificaciones

**1. Verificar permisos:**
```javascript
// En consola del navegador
console.log('Permission:', Notification.permission);
// Debe ser "granted"
```

**2. Verificar suscripción:**
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Subscription:', sub);
  });
});
```

**3. Verificar backend:**
```bash
# Ver logs del backend
docker-compose logs backend | grep -i notif

# Verificar VAPID keys
docker-compose exec backend env | grep VAPID
```

**4. Verificar base de datos:**
```sql
-- Ver tus suscripciones
SELECT * FROM push_subscriptions WHERE user_id = 1;
```

### Error "VAPID keys no configuradas"

**Solución:**
1. Genera las keys: `npx web-push generate-vapid-keys`
2. Agrega a `backend/.env`
3. Reinicia: `docker-compose restart backend`

### Error "No se pudo obtener la clave de notificaciones"

**Causas comunes:**
- Backend no está corriendo
- VAPID_PUBLIC_KEY vacía en .env
- Error de red/firewall

**Solución:**
```bash
# Verificar que el backend esté corriendo
curl http://localhost:3001/api/notifications/vapid-public-key

# Debe retornar: {"publicKey":"BPyj..."}
```

### Notificaciones no llegan en iOS

**Requisitos iOS:**
1. Safari 16.4 o superior
2. App agregada a pantalla de inicio
3. Permisos aceptados

**Pasos:**
1. Safari → Compartir → Agregar a pantalla de inicio
2. Abrir la app desde el ícono en pantalla
3. Ir a Perfil → Activar notificaciones
4. Aceptar permiso

### Limpiar y volver a suscribir

```javascript
// En consola del navegador
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    if (sub) {
      sub.unsubscribe().then(() => {
        console.log('Desuscrito. Recarga la página.');
      });
    }
  });
});
```

## 📈 Monitoreo

### Logs útiles

```bash
# Ver todas las notificaciones enviadas
docker-compose logs backend | grep "Notificación enviada"

# Ver errores
docker-compose logs backend | grep -i error | grep -i notif

# Ver suscripciones/desuscripciones
docker-compose logs backend | grep -E "(suscrito|desuscrito)"
```

### Estadísticas

```sql
-- Usuarios con notificaciones activas
SELECT COUNT(DISTINCT user_id) as users_with_notifications
FROM push_subscriptions;

-- Dispositivos por usuario
SELECT 
  u.username, 
  COUNT(ps.id) as num_devices,
  MAX(ps.last_used_at) as last_notification
FROM users u
LEFT JOIN push_subscriptions ps ON u.id = ps.user_id
GROUP BY u.id, u.username;

-- Notificaciones enviadas hoy
SELECT COUNT(*) 
FROM push_subscriptions 
WHERE DATE(last_used_at) = CURRENT_DATE;
```

## 🚦 Testing

### Test Manual

1. **Suscribirse desde 2 dispositivos:**
   - Usuario A en dispositivo 1
   - Usuario A en dispositivo 2

2. **Agregar item como Usuario B:**
   - Ambos dispositivos de Usuario A deben recibir notificación

3. **Probar agrupación:**
   - Agregar 3 items rápidamente
   - Debe llegar 1 sola notificación: "Usuario B agregó 3 items"

4. **Probar desuscripción:**
   - Desactivar notificaciones
   - Agregar item → No debe llegar notificación

### Test con curl

```bash
# Obtener clave pública
curl http://localhost:3001/api/notifications/vapid-public-key

# Enviar notificación de prueba (requiere auth)
curl -X POST http://localhost:3001/api/notifications/test \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json"
```

## 🎨 Personalización

### Cambiar mensaje de notificación

Edita `backend/src/services/pushService.js`:

```javascript
// Línea ~75
messages.push(`${userName} agregó ${itemsAdded} item${itemsAdded > 1 ? 's' : ''}`);

// Puedes cambiar a:
messages.push(`🛒 ${itemsAdded} nuevo${itemsAdded > 1 ? 's' : ''} en la lista`);
```

### Cambiar delay de agrupación

```javascript
// Línea ~20
const BATCH_DELAY = 5000; // 5 segundos

// Cambiar a 10 segundos:
const BATCH_DELAY = 10000;
```

### Agregar vibración personalizada

Edita `frontend/public/service-worker.js`:

```javascript
// Línea ~267
vibrate: [200, 100, 200],

// Cambiar patrón:
vibrate: [100, 50, 100, 50, 100], // Más corto
```

## 💡 Tips

1. **Prueba en diferentes dispositivos:** iOS, Android, Desktop
2. **Verifica permisos:** Algunos usuarios pueden denegar por error
3. **Monitorea logs:** Para detectar problemas temprano
4. **Limpia suscripciones viejas:** Cada 3-6 meses
5. **Educa a los usuarios:** Explica cómo activar notificaciones

## 📚 Referencias

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [web-push library](https://github.com/web-push-libs/web-push)
- [VAPID Keys](https://developers.google.com/web/fundamentals/push-notifications/web-push-protocol)

---

## 🎉 ¡Listo!

Tu Family Sync App ahora tiene notificaciones push funcionando. Los usuarios recibirán actualizaciones en tiempo real cuando su familia modifique la lista de compras.

**Funcionalidades implementadas:**
- ✅ Toggle simple en Perfil
- ✅ Notificaciones agrupadas inteligentes
- ✅ Soporte multi-dispositivo
- ✅ Compatible con iOS PWA y Android
- ✅ Limpieza automática de suscripciones expiradas

¡Disfruta las notificaciones! 🚀
