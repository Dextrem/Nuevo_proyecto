import prisma from './src/config/database.js';

async function updateSchema() {
  try {
    console.log('Actualizando esquema de base de datos...');
    
    // Añadir columnas a la tabla 'users'
    // Nota: Usamos executeRawUnsafe porque Prisma no maneja migraciones automáticas en este entorno portable fácilmente sin CLI
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "passwordExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "passwordNeverExpires" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "passwordExpirationDays" INTEGER NOT NULL DEFAULT 90;
    `);
    
    console.log('Columnas de seguridad añadidas exitosamente.');
    
    // Opcional: Establecer fecha de expiración para usuarios existentes que no la tienen
    await prisma.$executeRawUnsafe(`
      UPDATE "users" 
      SET "passwordExpiresAt" = "createdAt" + interval '90 days'
      WHERE "passwordExpiresAt" IS NULL AND "passwordNeverExpires" = FALSE;
    `);

    console.log('Fechas de expiración inicializadas para usuarios existentes.');
  } catch (error) {
    console.error('Error al actualizar el esquema:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSchema();
