const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function crearUsuarioAdmin() {
  try {
    const passwordHash = await bcrypt.hash('admin123', 12);

    const usuario = await prisma.user.create({
      data: {
        username: 'admin2',
        email: 'admin2@finandex.com',
        password: passwordHash,
        name: 'Administrador 2',
        role: 'ADMIN',
        active: true,
        permissions: {
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
        },
      },
    });

    console.log('Usuario creado exitosamente!');
    console.log('Usuario: admin2');
    console.log('Contraseña: admin123');
    console.log('ID:', usuario.id);
  } catch (error) {
    console.error('Error al crear usuario:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

crearUsuarioAdmin();
