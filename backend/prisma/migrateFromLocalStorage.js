import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const migrateData = async () => {
  console.log('Iniciando migración de datos...\n');

  const localData = localStorage.getItem('finandex_db');
  
  if (!localData) {
    console.log('No se encontró datos en localStorage');
    return;
  }

  const data = JSON.parse(localData);

  console.log('✓ Datos cargados de localStorage');

  console.log('\nMigrando categorías...');
  if (data.categories && Array.isArray(data.categories)) {
    for (const category of data.categories) {
      try {
        await prisma.category.upsert({
          where: { name: category.name },
          update: { description: category.description },
          create: {
            name: category.name,
            description: category.description,
          },
        });
      } catch (error) {
        console.error(`Error migrando categoría ${category.name}:`, error);
      }
    }
    console.log(`✓ ${data.categories.length} categorías migradas`);
  }

  console.log('\nMigrando productos...');
  if (data.products && Array.isArray(data.products)) {
    const categories = await prisma.category.findMany();
    
    for (const product of data.products) {
      try {
        const category = categories.find(c => c.name === product.category);
        await prisma.product.upsert({
          where: { sku: product.sku },
          update: {
            name: product.name,
            description: product.description,
            price: product.price,
            cost: product.cost || 0,
            stock: product.stock || 0,
            minStock: product.minStock || 0,
            active: product.active !== false,
            categoryId: category?.id,
          },
          create: {
            name: product.name,
            description: product.description,
            sku: product.sku,
            barcode: product.barcode,
            price: product.price,
            cost: product.cost || 0,
            stock: product.stock || 0,
            minStock: product.minStock || 0,
            active: product.active !== false,
            categoryId: category?.id,
          },
        });
      } catch (error) {
        console.error(`Error migrando producto ${product.name}:`, error);
      }
    }
    console.log(`✓ ${data.products.length} productos migrados`);
  }

  console.log('\nMigrando clientes...');
  if (data.clients && Array.isArray(data.clients)) {
    for (const client of data.clients) {
      try {
        await prisma.client.upsert({
          where: { name: client.name },
          update: {
            email: client.email,
            phone: client.phone,
            rnc: client.rnc,
            address: client.address,
            balance: client.balance || 0,
            creditLimit: client.creditLimit || 0,
            active: client.active !== false,
          },
          create: {
            name: client.name,
            email: client.email,
            phone: client.phone,
            rnc: client.rnc,
            address: client.address,
            balance: client.balance || 0,
            creditLimit: client.creditLimit || 0,
            active: client.active !== false,
          },
        });
      } catch (error) {
        console.error(`Error migrando cliente ${client.name}:`, error);
      }
    }
    console.log(`✓ ${data.clients.length} clientes migrados`);
  }

  console.log('\nMigrando proveedores...');
  if (data.suppliers && Array.isArray(data.suppliers)) {
    for (const supplier of data.suppliers) {
      try {
        await prisma.supplier.upsert({
          where: { name: supplier.name },
          update: {
            email: supplier.email,
            phone: supplier.phone,
            rnc: supplier.rnc,
            address: supplier.address,
            contact: supplier.contact,
            active: supplier.active !== false,
          },
          create: {
            name: supplier.name,
            email: supplier.email,
            phone: supplier.phone,
            rnc: supplier.rnc,
            address: supplier.address,
            contact: supplier.contact,
            active: supplier.active !== false,
          },
        });
      } catch (error) {
        console.error(`Error migrando proveedor ${supplier.name}:`, error);
      }
    }
    console.log(`✓ ${data.suppliers.length} proveedores migrados`);
  }

  console.log('\nMigrando transacciones...');
  if (data.transactions && Array.isArray(data.transactions)) {
    const users = await prisma.user.findMany();
    const adminUser = users[0];

    if (adminUser) {
      for (const transaction of data.transactions) {
        try {
          await prisma.transaction.create({
            data: {
              type: transaction.type,
              amount: transaction.amount,
              description: transaction.description,
              reference: transaction.reference,
              date: new Date(transaction.date),
              userId: adminUser.id,
            },
          });
        } catch (error) {
          console.error(`Error migrando transacción:`, error);
        }
      }
      console.log(`✓ ${data.transactions.length} transacciones migradas`);
    }
  }

  console.log('\nMigrando configuración...');
  if (data.settings) {
    try {
      await prisma.settings.upsert({
        where: { id: 'migrated-settings' },
        update: {
          companyName: data.settings.companyName || 'Mi Empresa',
          companyRnc: data.settings.companyRnc,
          companyAddress: data.settings.companyAddress,
          companyPhone: data.settings.companyPhone,
          companyEmail: data.settings.companyEmail,
          currency: data.settings.currency || 'DOP',
          currencySymbol: data.settings.currencySymbol || 'RD$',
          taxRate: data.settings.taxRate || 0.18,
          interestRate: data.settings.interestRate || 0.02,
          theme: data.settings.theme || 'light',
          primaryColor: data.settings.primaryColor || '#4F46E5',
        },
        create: {
          id: 'migrated-settings',
          companyName: data.settings.companyName || 'Mi Empresa',
          companyRnc: data.settings.companyRnc,
          companyAddress: data.settings.companyAddress,
          companyPhone: data.settings.companyPhone,
          companyEmail: data.settings.companyEmail,
          currency: data.settings.currency || 'DOP',
          currencySymbol: data.settings.currencySymbol || 'RD$',
          taxRate: data.settings.taxRate || 0.18,
          interestRate: data.settings.interestRate || 0.02,
          theme: data.settings.theme || 'light',
          primaryColor: data.settings.primaryColor || '#4F46E5',
        },
      });
      console.log('✓ Configuración migrada');
    } catch (error) {
      console.error('Error migrando configuración:', error);
    }
  }

  console.log('\n✓ Migración completada!');
  console.log('\nAhora puedes usar el backend con tus datos.');
};

migrateData()
  .catch((error) => {
    console.error('Error en migración:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
