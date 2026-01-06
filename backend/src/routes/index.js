const express = require('express');
const authController = require('../controllers/authController');
const shoppingController = require('../controllers/shoppingController');
const calendarController = require('../controllers/calendarController');
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ====== Rutas de Autenticación ======
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/profile', authMiddleware, authController.getProfile);

// ====== Rutas de Listas de Compras ======
router.get('/shopping/lists', authMiddleware, shoppingController.getLists);
router.post('/shopping/lists', authMiddleware, shoppingController.createList);
router.get('/shopping/lists/:listId/items', authMiddleware, shoppingController.getListItems);
router.post('/shopping/lists/:listId/items', authMiddleware, shoppingController.addItem);
router.patch('/shopping/items/:itemId', authMiddleware, shoppingController.updateItem);
router.delete('/shopping/items/:itemId', authMiddleware, shoppingController.deleteItem);
router.delete('/shopping/lists/:listId/clear', authMiddleware, shoppingController.clearCheckedItems);
router.get('/shopping/categories', authMiddleware, shoppingController.getCategories);

// ====== Rutas de Calendario ======
router.get('/calendar/auth-url', authMiddleware, calendarController.getAuthUrl);
router.get('/calendar/auth-status', authMiddleware, calendarController.getAuthStatus);
router.get('/calendar/callback', calendarController.handleCallback);
router.post('/calendar/sync', authMiddleware, calendarController.syncCalendar);
router.get('/calendar/events', authMiddleware, calendarController.getEvents);

// ====== Rutas de Notificaciones Push ======
router.get('/notifications/vapid-public-key', notificationController.getVapidPublicKey);
router.post('/notifications/subscribe', authMiddleware, notificationController.subscribe);
router.post('/notifications/unsubscribe', authMiddleware, notificationController.unsubscribe);
router.get('/notifications/subscriptions', authMiddleware, notificationController.getSubscriptions);
router.post('/notifications/test', authMiddleware, notificationController.sendTest);

// ====== Ruta de Health Check ======
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Family Sync API is running' });
});

module.exports = router;
