const db = require('../config/database');
const pushService = require('../services/pushService');

// Obtener todas las listas de compras
const getLists = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sl.*, u.username as created_by_name 
       FROM shopping_lists sl 
       LEFT JOIN users u ON sl.created_by = u.id 
       ORDER BY sl.created_at DESC`
    );
    res.json({ lists: result.rows });
  } catch (error) {
    console.error('Error al obtener listas:', error);
    res.status(500).json({ error: 'Error al obtener listas' });
  }
};

// Crear una nueva lista
const createList = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId;

    const result = await db.query(
      'INSERT INTO shopping_lists (name, created_by) VALUES ($1, $2) RETURNING *',
      [name || 'Nueva Lista', userId]
    );

    res.status(201).json({ list: result.rows[0] });
  } catch (error) {
    console.error('Error al crear lista:', error);
    res.status(500).json({ error: 'Error al crear lista' });
  }
};

// Obtener items de una lista
const getListItems = async (req, res) => {
  try {
    const { listId } = req.params;

    const result = await db.query(
      `SELECT si.*, 
              u1.username as added_by_name,
              u2.username as checked_by_name
       FROM shopping_items si
       LEFT JOIN users u1 ON si.added_by = u1.id
       LEFT JOIN users u2 ON si.checked_by = u2.id
       WHERE si.list_id = $1
       ORDER BY si.checked ASC, si.created_at DESC`,
      [listId]
    );

    res.json({ items: result.rows });
  } catch (error) {
    console.error('Error al obtener items:', error);
    res.status(500).json({ error: 'Error al obtener items' });
  }
};

// Agregar item a la lista
const addItem = async (req, res) => {
  try {
    const { listId } = req.params;
    const { name, quantity } = req.body;
    const userId = req.user.userId;

    if (!name) {
      return res.status(400).json({ error: 'El nombre del item es requerido' });
    }

    const result = await db.query(
      `INSERT INTO shopping_items (list_id, name, quantity, added_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [listId, name, quantity || '', userId]
    );

    // Obtener nombre del usuario
    const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
    const userName = userResult.rows[0]?.username || 'Alguien';
    
    // Enviar notificación push a otros usuarios
    pushService.notifyItemAdded(listId, name, userName, userId).catch(err => {
      console.error('Error al enviar notificación:', err);
    });

    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error('Error al agregar item:', error);
    res.status(500).json({ error: 'Error al agregar item' });
  }
};

// Actualizar item (marcar como completado, cambiar nombre, etc.)
const updateItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, quantity, checked } = req.body;
    const userId = req.user.userId;

    let query = 'UPDATE shopping_items SET ';
    const values = [];
    let valueIndex = 1;

    if (name !== undefined) {
      query += `name = $${valueIndex}, `;
      values.push(name);
      valueIndex++;
    }

    if (quantity !== undefined) {
      query += `quantity = $${valueIndex}, `;
      values.push(quantity);
      valueIndex++;
    }

    if (checked !== undefined) {
      query += `checked = $${valueIndex}, `;
      values.push(checked);
      valueIndex++;
      
      if (checked) {
        query += `checked_by = $${valueIndex}, `;
        values.push(userId);
        valueIndex++;
      }
    }

    query += `updated_at = CURRENT_TIMESTAMP WHERE id = $${valueIndex} RETURNING *`;
    values.push(itemId);

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Si se marcó como completado, enviar notificación
    if (checked === true) {
      const userResult = await db.query('SELECT username FROM users WHERE id = $1', [userId]);
      const userName = userResult.rows[0]?.username || 'Alguien';
      
      pushService.notifyItemChecked(
        result.rows[0].list_id, 
        result.rows[0].name, 
        userName, 
        userId
      ).catch(err => {
        console.error('Error al enviar notificación:', err);
      });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar item:', error);
    res.status(500).json({ error: 'Error al actualizar item' });
  }
};

// Eliminar item
const deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const result = await db.query(
      'DELETE FROM shopping_items WHERE id = $1 RETURNING *',
      [itemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    res.json({ message: 'Item eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar item:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
};

// Eliminar todos los items marcados de una lista
const clearCheckedItems = async (req, res) => {
  try {
    const { listId } = req.params;

    await db.query(
      'DELETE FROM shopping_items WHERE list_id = $1 AND checked = true',
      [listId]
    );

    res.json({ message: 'Items marcados eliminados exitosamente' });
  } catch (error) {
    console.error('Error al limpiar items:', error);
    res.status(500).json({ error: 'Error al limpiar items' });
  }
};

// Obtener categorías
const getCategories = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM item_categories ORDER BY name'
    );
    res.json({ categories: result.rows });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};

module.exports = {
  getLists,
  createList,
  getListItems,
  addItem,
  updateItem,
  deleteItem,
  clearCheckedItems,
  getCategories,
};
