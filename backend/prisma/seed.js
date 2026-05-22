import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  prisma.$on('query', (e) => {
    console.log('[Prisma Query]', e.query);
  });

  console.log('Iniciando seed de base de datos...');

  const adminPassword = await bcrypt.hash('admin', 12);

  // Fallback to raw SQL upsert to avoid Prisma client schema validation issues
  const existing = await prisma.$queryRaw`
    SELECT "id", "username" FROM "users" WHERE "username" = 'admin'
  `;

  if (existing && existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE "users"
      SET "password" = ${adminPassword}, "role" = 'ADMIN', "active" = true,
          "mustChangePassword" = true, "updatedAt" = now()
      WHERE "username" = 'admin'
    `;
    console.log('✓ Usuario admin actualizado: admin');
  } else {
    const newId = (await import('crypto')).randomUUID();
    await prisma.$executeRaw`
      INSERT INTO "users" ("id","username","email","password","name","role","permissions","active","mustChangePassword","createdAt","updatedAt")
      VALUES (${newId}, 'admin', 'admin@finandex.com', ${adminPassword}, 'Administrador', 'ADMIN', ${JSON.stringify({
        manage_users: true,
        manage_products: true,
        manage_categories: true,
        manage_clients: true,
        manage_suppliers: true,
        manage_accounting: true,
        manage_inventory: true,
        process_sales: true,
        record_payments: true,
        view_reports: true,
        manage_settings: true,
        manage_budgets: true,
      })}::jsonb, true, true, now(), now())
    `;
    console.log('✓ Usuario admin creado: admin');
  }

  const categories = [
    { name: 'General', description: 'Productos generales' },
    { name: 'Bebidas', description: 'Bebidas y líquidos' },
    { name: 'Alimentos', description: 'Alimentos y snacks' },
    { name: 'Limpieza', description: 'Productos de limpieza' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log('✓ Categorías creadas');

  await prisma.settings.upsert({
    where: { id: 'default-settings' },
    update: {},
    create: {
      id: 'default-settings',
      companyName: 'Dextremix Finance',
      currency: 'DOP',
      currencySymbol: 'RD$',
      taxRate: 0.18,
      interestRate: 0.02,
      theme: 'light',
      primaryColor: '#4F46E5',
    },
  });

  console.log('✓ Configuración por defecto creada');
  console.log('\n✓ Seed completado exitosamente!');
  console.log('\nCredenciales de acceso:');
  console.log('  Usuario: admin');
  console.log('  Contraseña: admin');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
