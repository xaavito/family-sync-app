# 🚀 Guía de Inicio Rápido - Family Sync App

## ⚡ Instalación Rápida en Raspberry Pi

### 1️⃣ Preparar Raspberry Pi

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt-get install -y docker-compose

# Reiniciar para aplicar cambios de grupo
sudo reboot
```

### 2️⃣ Configurar el Proyecto

```bash
# Copiar el proyecto a tu Raspberry Pi
# (Usa scp, git clone, o USB)

cd family-sync-app

# Copiar archivo de ejemplo de variables de entorno
cp backend/.env.example backend/.env

# Editar archivo .env con tus configuraciones
nano backend/.env
```

### 3️⃣ Configurar Google Calendar API

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita **Google Calendar API**
4. Ve a "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth 2.0"
5. Configura la pantalla de consentimiento OAuth si es necesario
6. Tipo de aplicación: **Aplicación web**
7. URI de redirección autorizados: 
   - `http://192.168.68.60:3000/api/calendar/callback`
   - `http://localhost:3000/api/calendar/callback` (para desarrollo)
8. Descarga el archivo JSON de credenciales
9. Guárdalo como `backend/google-credentials.json`
10. Copia el Client ID y Client Secret al archivo `backend/.env`

### 4️⃣ Editar Variables de Entorno

```bash
nano backend/.env
```

Configura estos valores:

```env
# JWT Secret - CAMBIAR por algo seguro
JWT_SECRET=tu-secret-super-seguro-cambiar-esto

# Google OAuth2
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=tu-client-secret
GOOGLE_REDIRECT_URI=http://192.168.68.60:3000/api/calendar/callback

# CORS (opcional, si accedes desde otra IP)
CORS_ORIGIN=*
```

### 5️⃣ Iniciar la Aplicación

```bash
# Construir e iniciar todos los servicios
docker-compose up -d

# Ver logs (opcional)
docker-compose logs -f
```

### 6️⃣ Acceder desde tu Celular

#### Encontrar la IP de tu Raspberry Pi:

```bash
hostname -I
# Ejemplo: 192.168.1.100
```

#### En tu celular/tablet:

1. Abre el navegador (Safari en iOS, Chrome en Android)
2. Ve a: `http://192.168.1.100:3000`
3. Regístrate creando una cuenta
4. **Agregar a pantalla de inicio:**
   - **iOS (Safari)**: Toca el botón "Compartir" → "Agregar a pantalla de inicio"
   - **Android (Chrome)**: Menú (⋮) → "Agregar a pantalla de inicio"

## 🎯 Primer Uso

### Crear tu primer usuario

1. Abre la app en tu navegador
2. Haz clic en "¿No tienes cuenta? Regístrate"
3. Ingresa:
   - Nombre de usuario
   - Email
   - Contraseña
4. Inicia sesión

### Agregar items a la lista de compras

1. Ve a la pestaña "🛒 Compras"
2. Escribe un item en el campo de texto
3. Presiona Enter o el botón "+"
4. Marca items como completados tocando el checkbox
5. Elimina items marcados con "Limpiar marcados"

### Sincronizar Google Calendar

1. Ve a la pestaña "📅 Calendario"
2. Toca "Autorizar Google Calendar"
3. Inicia sesión con tu cuenta de Google
4. Autoriza el acceso al calendario
5. Cierra la ventana emergente
6. Toca el botón "🔄" para sincronizar

### Crear cuenta para tu pareja

1. Tu pareja debe hacer lo mismo: registrarse en la app
2. Ambos pueden ver y editar la misma lista de compras
3. Cada uno puede sincronizar su propio Google Calendar

## 🔧 Comandos Útiles

```bash
# Ver estado de los servicios
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Detener todo
docker-compose down

# Actualizar aplicación (después de cambios)
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Backup de base de datos
docker exec family-sync-db pg_dump -U familyuser familydb > backup_$(date +%Y%m%d).sql

# Restaurar base de datos
cat backup_20260103.sql | docker exec -i family-sync-db psql -U familyuser -d familydb

# Ver uso de espacio
docker system df

# Limpiar volúmenes sin usar (¡CUIDADO!)
docker system prune -a --volumes
```

## 🌐 Acceso desde Fuera de Casa

### Opción 1: Port Forwarding (Recomendado para usuarios avanzados)

1. Accede a la configuración de tu router
2. Configura port forwarding:
   - Puerto externo: 3000
   - Puerto interno: 3000
   - IP destino: IP de tu Raspberry Pi
3. Usa tu IP pública para acceder: `http://TU-IP-PUBLICA:3000`
4. **IMPORTANTE:** Considera usar HTTPS con Let's Encrypt para seguridad

### Opción 2: Servicio DynDNS

1. Registra un dominio dinámico gratuito (No-IP, DuckDNS, etc.)
2. Configura el cliente DynDNS en tu Raspberry Pi
3. Accede usando tu dominio: `http://tudominio.duckdns.org:3000`

### Opción 3: VPN (Más seguro)

1. Instala WireGuard o OpenVPN en tu Raspberry Pi
2. Conéctate a la VPN desde tu celular cuando estés fuera
3. Accede a la IP local como si estuvieras en casa

## 🆘 Solución de Problemas

### No puedo acceder desde el celular

```bash
# Verifica que los servicios estén corriendo
docker-compose ps

# Verifica que estés en la misma red WiFi
# Prueba hacer ping desde tu celular a la IP del Pi

# Verifica el firewall
sudo ufw status
```

### Error de Google Calendar

- Verifica que las credenciales sean correctas
- Asegura que la URI de redirección coincida exactamente
- Revisa que la Google Calendar API esté habilitada

### Base de datos no inicia

```bash
# Ver logs de la base de datos
docker-compose logs db

# Verificar espacio en disco
df -h

# Reiniciar solo la base de datos
docker-compose restart db
```

### La app se ve lenta

```bash
# Verifica recursos del sistema
htop

# Verifica uso de Docker
docker stats
```

## 📊 Monitoreo

```bash
# Ver uso de CPU y memoria de los contenedores
docker stats

# Ver logs de errores
docker-compose logs --tail=100 | grep -i error

# Ver logs del backend
docker-compose logs backend

# Ver logs de la base de datos
docker-compose logs db
```

## 🔄 Actualizaciones

Para actualizar la aplicación cuando haya nuevas versiones:

```bash
# Detener servicios
docker-compose down

# Hacer backup de la base de datos
docker exec family-sync-db pg_dump -U familyuser familydb > backup_antes_actualizar.sql

# Actualizar código (git pull o copiar archivos nuevos)

# Reconstruir imágenes
docker-compose build --no-cache

# Iniciar servicios
docker-compose up -d

# Verificar que todo funcione
docker-compose logs -f
```

## 💡 Tips

- **Rendimiento:** Raspberry Pi 4 con 4GB RAM es lo recomendado
- **Almacenamiento:** Usa una SD card clase 10 o mejor aún, un SSD USB
- **Red:** Usa cable Ethernet en lugar de WiFi para mejor estabilidad
- **Energía:** Usa el cargador oficial de Raspberry Pi
- **Refrigeración:** Considera un case con ventilador o disipadores

## 🎉 ¡Listo!

Ahora tu Family Sync App está corriendo en tu Raspberry Pi. Tú y tu pareja pueden:

✅ Sincronizar listas de compras en tiempo real  
✅ Ver eventos de Google Calendar compartidos  
✅ Acceder desde cualquier dispositivo en tu red  
✅ Tener todos los datos almacenados localmente  

---

**¿Problemas?** Revisa los logs con `docker-compose logs -f`  
**¿Sugerencias?** Contribuye al proyecto en GitHub
