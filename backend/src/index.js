require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3001;

// ====== Middleware de Seguridad ======
app.use(helmet());

// ====== CORS ======
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// ====== Rate Limiting ======
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.',
});
app.use('/api/', limiter);

// ====== Body Parser ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== Logging ======
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ====== Rutas ======
app.use('/api', routes);

// ====== Ruta raíz ======
app.get('/', (req, res) => {
  res.json({
    message: '👨‍👩‍👧‍👦 Family Sync API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/*',
      shopping: '/api/shopping/*',
      calendar: '/api/calendar/*',
    },
  });
});

// ====== Manejo de errores 404 ======
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

// ====== Manejo de errores global ======
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ====== Verificar conexión a la base de datos ======
const checkDatabaseConnection = async () => {
  try {
    await db.query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL establecida');
  } catch (error) {
    console.error('❌ Error al conectar a PostgreSQL:', error);
    process.exit(1);
  }
};

// ====== Iniciar servidor ======
const startServer = async () => {
  await checkDatabaseConnection();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔════════════════════════════════════════╗
║   🚀 Family Sync API Server           ║
║                                        ║
║   Port: ${PORT}                       ║
║   Environment: ${process.env.NODE_ENV || 'development'}      ║
║   Database: PostgreSQL                 ║
║                                        ║
║   Ready to sync your family! 👨‍👩‍👧‍👦      ║
╚════════════════════════════════════════╝
    `);

    console.log('proces env', process.env)
  });
};

// ====== Manejo de señales de terminación ======
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  db.pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  db.pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});

startServer();
