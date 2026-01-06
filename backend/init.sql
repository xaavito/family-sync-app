-- Family Sync App Database Schema

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    google_refresh_token TEXT,
    google_calendar_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de listas de compras
CREATE TABLE IF NOT EXISTS shopping_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL DEFAULT 'Lista de Compras',
    created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de items de compras
CREATE TABLE IF NOT EXISTS shopping_items (
    id SERIAL PRIMARY KEY,
    list_id INTEGER REFERENCES shopping_lists(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    quantity VARCHAR(50),
    checked BOOLEAN DEFAULT FALSE,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    checked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de eventos del calendario (cache local de Google Calendar)
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    google_event_id VARCHAR(255) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    summary VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    location VARCHAR(255),
    calendar_id VARCHAR(255),
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de etiquetas para items de compras
CREATE TABLE IF NOT EXISTS item_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1',
    icon VARCHAR(50)
);

-- Relación muchos a muchos entre items y categorías
CREATE TABLE IF NOT EXISTS item_category_relation (
    item_id INTEGER REFERENCES shopping_items(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES item_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (item_id, category_id)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_shopping_items_list_id ON shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_checked ON shopping_items(checked);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_google_id ON calendar_events(google_event_id);

-- Función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para actualizar updated_at automáticamente
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_lists_updated_at BEFORE UPDATE ON shopping_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_items_updated_at BEFORE UPDATE ON shopping_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar categorías por defecto
INSERT INTO item_categories (name, color, icon) VALUES
    ('Frutas y Verduras', '#10b981', '🥬'),
    ('Carnes', '#ef4444', '🥩'),
    ('Lácteos', '#f59e0b', '🥛'),
    ('Panadería', '#f97316', '🍞'),
    ('Bebidas', '#06b6d4', '🥤'),
    ('Limpieza', '#8b5cf6', '🧹'),
    ('Higiene Personal', '#ec4899', '🧴'),
    ('Despensa', '#eab308', '🥫'),
    ('Congelados', '#3b82f6', '❄️'),
    ('Otros', '#6b7280', '📦')
ON CONFLICT (name) DO NOTHING;

-- Insertar una lista de compras por defecto
INSERT INTO shopping_lists (name, created_by) VALUES
    ('Lista Principal', 1)
ON CONFLICT DO NOTHING;

-- Tabla de suscripciones push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    device_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, endpoint)
);

-- Índice para buscar suscripciones por usuario
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
