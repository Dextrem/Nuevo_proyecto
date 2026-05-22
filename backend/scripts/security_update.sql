-- =====================================================
-- FINANDEX - Script de Seguridad
-- Agrega campos de seguridad a la tabla users
-- NO afecta datos existentes
-- =====================================================

-- Agregar columna failedLoginAttempts si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'failedLoginAttempts'
    ) THEN
        ALTER TABLE users ADD COLUMN failedLoginAttempts INTEGER DEFAULT 0;
        RAISE NOTICE 'Columna failedLoginAttempts agregada';
    ELSE
        RAISE NOTICE 'Columna failedLoginAttempts ya existe';
    END IF;
END $$;

-- Agregar columna lockUntil si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'lockUntil'
    ) THEN
        ALTER TABLE users ADD COLUMN lockUntil TIMESTAMP;
        RAISE NOTICE 'Columna lockUntil agregada';
    ELSE
        RAISE NOTICE 'Columna lockUntil ya existe';
    END IF;
END $$;

-- Agregar columna lastLoginAttempt si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'lastLoginAttempt'
    ) THEN
        ALTER TABLE users ADD COLUMN lastLoginAttempt TIMESTAMP;
        RAISE NOTICE 'Columna lastLoginAttempt agregada';
    ELSE
        RAISE NOTICE 'Columna lastLoginAttempt ya existe';
    END IF;
END $$;

-- Verificar que las columnas fueron agregadas
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('failedLoginAttempts', 'lockUntil', 'lastLoginAttempt');

-- =====================================================
-- Para revertir este cambio (si es necesario):
-- ALTER TABLE users DROP COLUMN IF EXISTS failedLoginAttempts;
-- ALTER TABLE users DROP COLUMN IF EXISTS lockUntil;
-- ALTER TABLE users DROP COLUMN IF EXISTS lastLoginAttempt;
-- =====================================================
