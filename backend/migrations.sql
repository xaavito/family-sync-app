-- Migration script para actualizar esquema de base de datos existente
-- Ejecutar este script cuando el init.sql no se ejecuta (volumen ya existía)

-- Tabla de suscripciones push (si no existe)
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

-- Verificar que todas las tablas necesarias existan
DO $$
BEGIN
    -- Verificar users
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        RAISE EXCEPTION 'Tabla users no existe. Ejecutar init.sql completo';
    END IF;
    
    -- Verificar shopping_lists
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'shopping_lists') THEN
        RAISE EXCEPTION 'Tabla shopping_lists no existe. Ejecutar init.sql completo';
    END IF;
    
    -- Verificar shopping_items
    IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'shopping_items') THEN
        RAISE EXCEPTION 'Tabla shopping_items no existe. Ejecutar init.sql completo';
    END IF;
    
    RAISE NOTICE 'Todas las tablas necesarias existen ✓';
END $$;
