# Family Sync App 👨‍👩‍👧‍👦

Aplicación para sincronizar listas de compras y calendarios de Google entre parejas/familia, hosteada en Raspberry Pi.

## 🚀 Características

- 📝 Listas de compras compartidas en tiempo real
- 📅 Sincronización con Google Calendar
- 📱 PWA (Progressive Web App) - funciona en iOS y Android
- 🔐 Autenticación segura con JWT
- 🐳 Docker & Docker Compose para fácil despliegue
- 💾 PostgreSQL como base de datos
- 🍓 Optimizado para Raspberry Pi

## 📋 Requisitos

- Raspberry Pi (3/4/5) con Raspberry Pi OS
- Docker y Docker Compose instalados
- Cuenta de Google Cloud Platform (para Calendar API)
- Puerto 3000 y 5432 disponibles

## 🛠️ Instalación en Raspberry Pi

### 1. Instalar Docker (si no está instalado)

```bash
curl -sSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt-get install -y docker-compose
```

### 2. Clonar o copiar el proyecto

```bash
cd /home/pi
# Copiar el proyecto aquí
```

### 3. Configurar Google Calendar API

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto
3. Habilitar Google Calendar API
4. Crear credenciales OAuth 2.0
5. Descargar el archivo JSON de credenciales
6. Guardar como `backend/google-credentials.json`
7. Agregar URI de redirección:
   - Para red local: `http://192.168.68.60:3000/api/google/callback`
   - Para acceso externo: `https://javiermartingonzalez.com/api/calendar/callback`

### 4. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores
```

### 5. Iniciar la aplicación

```bash
docker-compose up -d
```

### 6. Acceder desde dispositivos móviles

- En tu navegador móvil: `http://ip-de-tu-raspberry:3000`
- Agregar a pantalla de inicio para experiencia tipo app nativa
- En iOS: Safari → Compartir → Agregar a pantalla de inicio
- En Android: Chrome → Menú → Agregar a pantalla de inicio

## 📱 Acceso Remoto

### Acceso Local (Red WiFi)
- En tu navegador: `http://192.168.68.60:8080` (con Nginx) o `http://192.168.68.60:3000` (sin Nginx)
- Asegúrate de estar en la misma red WiFi que la Raspberry Pi

### Acceso Externo (Desde Internet)

**Con tu dominio Cloudflare: `https://javiermartingonzalez.com`**

Ver guía completa en **[EXTERNAL_ACCESS.md](EXTERNAL_ACCESS.md)** que incluye:
- ✅ Nginx como Proxy Reverso (recomendado)
- ✅ Cloudflare Tunnel + SSL automático
- ✅ Tailscale VPN (acceso familiar privado)
- ✅ Configuración paso a paso

**Características del acceso externo:**
- 🔒 HTTPS automático con certificado SSL de Cloudflare
- 🛡️ Protección DDoS incluida
- 🌍 CDN global
- 🚫 Sin necesidad de port forwarding
- ✅ Funciona detrás de CGNAT/ISP restrictivos

## 🔧 Comandos útiles

```bash
# Ver logs
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Detener servicios
docker-compose down

# Actualizar aplicación
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Backup de base de datos
docker exec family-sync-db pg_dump -U familyuser familydb > backup.sql

# Restaurar base de datos
cat backup.sql | docker exec -i family-sync-db psql -U familyuser -d familydb
```

## 📊 Estructura del Proyecto

```
family-sync-app/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── controllers/  # Controladores de rutas
│   │   ├── models/       # Modelos de base de datos
│   │   ├── routes/       # Definición de rutas
│   │   ├── middleware/   # Middleware (auth, etc)
│   │   └── config/       # Configuraciones
│   ├── Dockerfile
│   └── package.json
├── frontend/             # PWA Vue.js
│   ├── src/
│   │   ├── components/   # Componentes Vue
│   │   ├── views/        # Vistas/páginas
│   │   ├── services/     # Servicios API
│   │   └── store/        # Vuex store
│   ├── public/
│   ├── Dockerfile
│   └── package.json
└── docker-compose.yml    # Orquestación de servicios
```

## 🔐 Seguridad

- Las contraseñas se almacenan hasheadas con bcrypt
- JWT para autenticación
- Variables de entorno para secretos
- CORS configurado
- Rate limiting en endpoints críticos

## 🐛 Troubleshooting

### No puedo conectar desde el celular
- Verifica que estés en la misma red WiFi
- Asegúrate de usar la IP local del Pi (no localhost)
- Verifica que el firewall no esté bloqueando el puerto 3000

### Error de Google Calendar API
- Verifica que las credenciales estén correctamente configuradas
- Asegura que la URI de redirección coincida exactamente
- Revisa que la API esté habilitada en Google Cloud Console

### Base de datos no inicia
- Verifica que el puerto 5432 no esté en uso
- Revisa los logs: `docker-compose logs db`
- Asegura que hay suficiente espacio en disco

## 📄 Licencia

MIT

## 👨‍💻 Desarrollo

Para desarrollo local:

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run serve
```

## 🤝 Contribuir

Pull requests son bienvenidos!
