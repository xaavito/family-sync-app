# 🌍 Acceso Externo a Family Sync App

Si tu ISP no permite acceso directo a tu IP pública (CGNAT, conexión compartida, etc.), aquí hay soluciones **gratuitas** para acceder a tu Raspberry Pi desde fuera de tu red local.

## 🏗️ Arquitectura Recomendada: Nginx como Proxy Reverso

Antes de usar cualquier túnel, **es altamente recomendable** configurar Nginx como proxy reverso. Esto te da:

- ✅ Centralización del tráfico (un solo punto de entrada)
- ✅ SSL/TLS terminado en un solo lugar
- ✅ Balanceo de carga si agregas más servicios
- ✅ Compresión gzip automática
- ✅ Cacheo de contenido estático
- ✅ Rate limiting y seguridad adicional
- ✅ Logs centralizados

### 📦 Opción A: Nginx en Docker (Recomendado)

Agregar Nginx al docker-compose existente:

#### 1. Crear configuración de Nginx

```bash
mkdir -p nginx
nano nginx/nginx.conf
```

**Archivo `nginx/nginx.conf`:**

```nginx
events {
    worker_connections 1024;
}

http {
    # Configuración básica
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logs
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml font/truetype font/opentype 
               application/vnd.ms-fontobject image/svg+xml;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;
    
    upstream backend {
        server backend:3001;
    }
    
    upstream frontend {
        server frontend:80;
    }
    
    server {
        listen 80;
        server_name _;
        
        # Aumentar límites para cargas
        client_max_body_size 10M;
        
        # Frontend - Contenido estático
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Backend API con rate limiting
        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts más largos para APIs
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # Login con rate limiting estricto
        location /api/auth/login {
            limit_req zone=login_limit burst=3 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        # Health check
        location /health {
            access_log off;
            return 200 "OK\n";
            add_header Content-Type text/plain;
        }
    }
}
```

#### 2. Actualizar docker-compose.yml

```yaml
version: '3.8'

services:
  # Base de datos PostgreSQL
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: familydb
      POSTGRES_USER: familyuser
      POSTGRES_PASSWORD: familypass123
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - app-network
    restart: unless-stopped

  # Backend Node.js
  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://familyuser:familypass123@db:5432/familydb
      JWT_SECRET: tu-secret-muy-seguro-aqui
      NODE_ENV: production
      PORT: 3001
    depends_on:
      - db
    networks:
      - app-network
    restart: unless-stopped

  # Frontend Vue.js
  frontend:
    build: ./frontend
    networks:
      - app-network
    restart: unless-stopped

  # Nginx Proxy Reverso (NUEVO)
  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"  # Puerto 8080 externo → 80 interno
      # - "8443:443"  # Descomentar si usas HTTPS
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      # - ./nginx/ssl:/etc/nginx/ssl:ro  # Si usas certificados SSL
    depends_on:
      - backend
      - frontend
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  app-network:
    driver: bridge
```

#### 3. Reiniciar con Nginx

```bash
# Reconstruir y levantar
docker-compose down
docker-compose up -d --build

# Verificar que todo esté corriendo
docker-compose ps

# Ver logs de nginx
docker-compose logs nginx -f
```

Ahora toda la aplicación está disponible en **http://192.168.68.60** (puerto 80).

---

### 🔒 Opción B: Nginx con SSL/HTTPS

Para agregar HTTPS con certificado autofirmado (red local):

#### 1. Generar certificado SSL

```bash
# Crear directorio para certificados
mkdir -p nginx/ssl

# Generar certificado autofirmado
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/nginx.key \
  -out nginx/ssl/nginx.crt \
  -subj "/CN=192.168.68.60"
```

#### 2. Actualizar nginx.conf

```nginx
# Agregar servidor HTTPS
server {
    listen 443 ssl http2;
    server_name _;
    
    ssl_certificate /etc/nginx/ssl/nginx.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx.key;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Resto de la configuración igual...
}

# Redirigir HTTP a HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}
```

#### 3. Descomentar puerto 443 en docker-compose.yml

```yaml
nginx:
  ports:
    - "80:80"
    - "443:443"
```

---

## 🚀 Soluciones de Túnel (Después de configurar Nginx)

Una vez que tienes Nginx configurado, puedes combinarlo con estas soluciones para acceso externo:

### ✨ Opción 1: Cloudflare Tunnel + Dominio (Recomendado - SSL Incluido)

**Ventajas:**
- ✅ Totalmente gratuito
- ✅ **HTTPS automático con tu dominio de Cloudflare** 🔒
- ✅ Certificado SSL gratis y renovación automática
- ✅ No necesita port forwarding
- ✅ Funciona detrás de CGNAT
- ✅ Protección DDoS incluida
- ✅ Muy fácil de configurar

**🎉 Si compraste un dominio en Cloudflare:**
- ¡Ya tienes SSL/HTTPS incluido automáticamente!
- No necesitas configurar certificados en tu servidor
- Cloudflare maneja todo el cifrado
- Tu conexión será `https://tudominio.com` desde el navegador

**Instalación:**

#### 1. Crear cuenta en Cloudflare

1. Ve a [Cloudflare](https://dash.cloudflare.com/sign-up)
2. Crea una cuenta gratuita (no necesitas dominio propio)

#### 2. Instalar Cloudflared en Raspberry Pi

```bash
# Descargar cloudflared para ARM64 (Raspberry Pi 3/4/5)
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb

# Instalar
sudo dpkg -i cloudflared-linux-arm64.deb

# Verificar instalación
cloudflared version
```

#### 3. Autenticar cloudflared

```bash
# Esto abrirá un navegador para autenticarte
cloudflared tunnel login
```

#### 4. Crear un tunnel

```bash
# Crear el tunnel (cambia "family-sync" por el nombre que quieras)
cloudflared tunnel create family-sync

# Esto generará un archivo de credenciales en:
# ~/.cloudflared/<TUNNEL-ID>.json
```

#### 5. Configurar el tunnel

```bash
# Crear archivo de configuración
nano ~/.cloudflared/config.yml
```

Pega este contenido (reemplaza `<TUNNEL-ID>` con el ID que te dio el comando anterior):

```yaml
tunnel: 99cbd0b4-1363-4616-bd56-a559d77ba33b
credentials-file: /home/pi/.cloudflared/99cbd0b4-1363-4616-bd56-a559d77ba33b.json

ingress:
  # Si usas Nginx en puerto 8080 (recomendado)
  - hostname: javiermartingonzalez.com
    service: http://localhost:8080
  # Si NO usas Nginx, cambiar a puerto 3000
  # - hostname: javiermartingonzalez.com
  #   service: http://localhost:3000
  - service: http_status:404
```

#### 6. Crear ruta DNS (con tu dominio)

```bash
# Crear ruta DNS automáticamente
cloudflared tunnel route dns family-sync family-app.javiermartingonzalez.com
```

O si prefieres usar el dominio gratuito de Cloudflare:

```bash
# Ejecutar el tunnel con URL temporal gratuita
cloudflared tunnel run family-sync
```

#### 7. Iniciar el tunnel como servicio

```bash
# Instalar como servicio systemd
sudo cloudflared service install

# Iniciar el servicio
sudo systemctl start cloudflared

# Habilitar inicio automático
sudo systemctl enable cloudflared

# Ver estado
sudo systemctl status cloudflared
```

#### 8. Configurar SSL en Cloudflare (Con tu dominio)

**Si compraste un dominio en Cloudflare:**

1. **Ve al Dashboard de Cloudflare** → Selecciona tu dominio

2. **SSL/TLS → Overview:**
   - Elige el modo de encriptación:
     - **Flexible**: Cloudflare ↔ Visitante (HTTPS), Cloudflare ↔ Tu servidor (HTTP) ✅ **Recomendado para empezar**
     - **Full**: HTTPS en ambos lados (requiere certificado en tu servidor)
     - **Full (strict)**: HTTPS con certificado válido en tu servidor

3. **Para modo "Flexible" (más fácil):**
   - No necesitas configurar nada en tu Raspberry Pi
   - Cloudflare maneja todo el SSL
   - Tu servidor puede seguir en HTTP (puerto 80)
   - Los usuarios verán `https://tudominio.com` ✅

4. **Para modo "Full" (más seguro):**
   - Ve a SSL/TLS → Origin Server
   - Crea un certificado Origin
   - Descarga el certificado y la clave
   - Configúralos en Nginx (ver sección anterior)

5. **Edge Certificates (Opcional pero recomendado):**
   - SSL/TLS → Edge Certificates
   - Habilita "Always Use HTTPS": Redirige HTTP → HTTPS automáticamente
   - Habilita "Automatic HTTPS Rewrites"
   - Habilita "Minimum TLS Version": TLS 1.2

6. **Cloudflare Proxy:**
   - DNS → Verifica que el registro esté en "Proxied" (nube naranja) ✅
   - Esto habilita todas las funciones de seguridad de Cloudflare

**Configuración recomendada:**
```yaml
# ~/.cloudflared/config.yml
tunnel: <TUNNEL-ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: javiermartingonzalez.com
    service: http://localhost:8080
    # Cloudflare maneja el HTTPS, tu servidor puede estar en HTTP (puerto 8080)
  - service: http_status:404
```

#### 9. Actualizar Google OAuth Redirect URI

En [Google Cloud Console](https://console.cloud.google.com/), agrega la nueva URI:
- `https://javiermartingonzalez.com/api/calendar/callback` ← **Tu dominio real**

**También actualiza en `backend/.env`:**
```env
GOOGLE_REDIRECT_URI=https://javiermartingonzalez.com/api/calendar/callback
```

#### 10. Verificar que todo funciona

```bash
# Probar desde terminal
curl -I https://javiermartingonzalez.com

# Deberías ver:
# HTTP/2 200
# server: cloudflare
# ...

# Verificar SSL
curl -v https://javiermartingonzalez.com 2>&1 | grep SSL
```

**¡Listo!** Ahora tienes:
- ✅ Tu dominio funcionando
- ✅ HTTPS automático y gratis
- ✅ Certificado SSL renovado automáticamente por Cloudflare
- ✅ Protección DDoS incluida
- ✅ CDN global de Cloudflare

---

### 🔒 Opción 2: Tailscale VPN (Muy Fácil y Seguro)

**Ventajas:**
- ✅ Totalmente gratuito (hasta 100 dispositivos)
- ✅ VPN zero-config
- ✅ Muy seguro (WireGuard)
- ✅ Funciona detrás de CGNAT
- ✅ Acceso privado solo para ti y tu familia

**Instalación:**

#### 1. Instalar Tailscale en Raspberry Pi

```bash
# Instalar Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Iniciar Tailscale
sudo tailscale up

# Se abrirá una URL para autenticarte
```

#### 2. Instalar Tailscale en tu celular

- **iOS:** [App Store](https://apps.apple.com/app/tailscale/id1470499037)
- **Android:** [Google Play](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

#### 3. Conectar dispositivos

1. Abre la app de Tailscale en tu celular
2. Inicia sesión con la misma cuenta
3. Conecta

#### 4. Acceder a tu Raspberry Pi

Una vez conectado a Tailscale, puedes acceder usando:
- La IP de Tailscale de tu Raspberry Pi (ej: `100.x.x.x`)
- O el nombre del dispositivo: `http://raspberrypi:3000`

```bash
# Ver tu IP de Tailscale
tailscale ip -4
```

**Ventajas adicionales:**
- Solo tú y quien autorices puede acceder
- No expones tu app a Internet público
- Funciona como si estuvieras en la misma red

#### 5. Habilitar MagicDNS (opcional)

```bash
# Habilitar desde el panel de Tailscale
# https://login.tailscale.com/admin/dns

# Luego puedes acceder con:
http://raspberrypi.tu-tailnet.ts.net:3000
```

---

### 🌐 Opción 3: Servius / LocalTunnel (Rápido pero temporal)

Para pruebas rápidas, puedes usar túneles temporales:

#### LocalTunnel

```bash
# Instalar localtunnel globalmente
npm install -g localtunnel

# Crear túnel al puerto 3000
lt --port 3000 --subdomain family-sync

# Te dará una URL como:
# https://family-sync.loca.lt
```

**Desventajas:**
- La URL cambia cada vez que reinicias
- No es permanente
- Solo para pruebas

---

### 📱 Opción 4: ZeroTier (Similar a Tailscale)

Otra alternativa de VPN:

```bash
# Instalar ZeroTier
curl -s https://install.zerotier.com | sudo bash

# Unirse a una red
sudo zerotier-cli join <NETWORK-ID>
```

1. Crea una cuenta en [ZeroTier](https://my.zerotier.com/)
2. Crea una red gratuita
3. Instala ZeroTier en tus dispositivos
4. Únete a la misma red

---

## 🎯 ¿Cuál elegir?

| Solución | Dificultad | Acceso Público | Seguridad | Permanente | Costo |
|----------|-----------|----------------|-----------|------------|-------|
| **Cloudflare Tunnel** | ⭐⭐⭐ | Sí | ⭐⭐⭐⭐ | Sí | Gratis |
| **Tailscale** | ⭐ | No (privado) | ⭐⭐⭐⭐⭐ | Sí | Gratis |
| **LocalTunnel** | ⭐ | Sí | ⭐⭐ | No | Gratis |
| **ZeroTier** | ⭐⭐ | No (privado) | ⭐⭐⭐⭐ | Sí | Gratis |

### Recomendaciones:

- **Para acceso familiar privado:** → **Tailscale** (más fácil)
- **Para compartir con más personas:** → **Cloudflare Tunnel** (más profesional)
- **Para pruebas rápidas:** → **LocalTunnel**

---

## 🔐 Consideraciones de Seguridad

### Si usas Cloudflare Tunnel (acceso público):

1. **Habilitar autenticación fuerte:**
   - Usa contraseñas seguras
   - Considera agregar 2FA en tu backend
   - Limita intentos de login

2. **Rate limiting:**
   - Ya está configurado en el backend
   - Considera agregar más restricciones

3. **HTTPS incluido:**
   - Cloudflare ya provee HTTPS gratis
   - Los certificados se renuevan automáticamente

### Si usas Tailscale/ZeroTier (VPN privada):

- Solo dispositivos autorizados pueden acceder
- No necesitas preocuparte tanto por seguridad adicional
- Es como estar en tu red local

---

## 🛠️ Configuración adicional de Cloudflare (Opcional)

### Agregar autenticación de Cloudflare Access

Para una capa extra de seguridad:

1. Ve a Cloudflare Zero Trust
2. Configura Cloudflare Access
3. Requiere login con Google/GitHub antes de acceder

```bash
# En config.yml, agregar:
tunnel: <TUNNEL-ID>
credentials-file: /home/pi/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: family-app.javiermartingonzalez.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

---

## 📊 Troubleshooting

### Cloudflare Tunnel no conecta

```bash
# Ver logs
sudo journalctl -u cloudflared -f

# Reiniciar servicio
sudo systemctl restart cloudflared

# Verificar conectividad
cloudflared tunnel info family-sync
```

### Tailscale no conecta

```bash
# Ver estado
sudo tailscale status

# Reiniciar
sudo systemctl restart tailscaled

# Ver logs
sudo journalctl -u tailscaled -f
```

### La app no carga con Cloudflare

- Verifica que tu backend esté corriendo
- Chequea el archivo `config.yml`
- Asegúrate de que el puerto 3000 esté accesible localmente
- Revisa los logs de cloudflared

---

## 🎉 Resultado Final

Una vez configurado cualquiera de estos métodos, podrás:

✅ Acceder a tu Family Sync App desde cualquier lugar  
✅ Sin necesidad de IP pública  
✅ Sin port forwarding  
✅ De forma segura y gratuita  
✅ Con HTTPS incluido (Cloudflare)  

---

## 💡 Tips Adicionales

1. **Backups:** Siempre haz backup antes de cambios grandes
2. **Monitoreo:** Revisa logs regularmente
3. **Actualizaciones:** Mantén cloudflared/tailscale actualizado
4. **Documentación:** Guarda las credenciales en un lugar seguro

```bash
# Actualizar cloudflared
sudo cloudflared update

# Actualizar tailscale
sudo apt update && sudo apt upgrade tailscale
```

---

**¿Necesitas ayuda?** Revisa la documentación oficial:
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Tailscale Docs](https://tailscale.com/kb/)
