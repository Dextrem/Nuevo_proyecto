import prisma from '../config/database.js';

export const createBackup = async () => {
  try {
    const [
      users,
      categories,
      products,
      clients,
      suppliers,
      supplierInvoices,
      sales,
      saleItems,
      transactions,
      settings,
      cashRegisters,
      cashTransactions,
      quotations,
      quotationItems,
      commissions,
      purchaseOrders,
      purchaseOrderItems,
      inventoryMovements,
      fiscalSequences,
      transactionHistory,
      budgets,
      pendingPayments,
      monthlyClosings,
    ] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true, username: true, email: true, name: true, role: true,
          permissions: true, active: true, createdAt: true,
        },
      }),
      prisma.category.findMany(),
      prisma.product.findMany({
        include: { category: { select: { name: true } } },
      }),
      prisma.client.findMany(),
      prisma.supplier.findMany(),
      prisma.supplierInvoice.findMany(),
      prisma.sale.findMany({
        include: {
          client: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
      prisma.saleItem.findMany(),
      prisma.transaction.findMany({
        include: { user: { select: { name: true } } },
      }),
      prisma.settings.findFirst(),
      prisma.cashRegister.findMany({
        include: {
          openedByUser: { select: { name: true } },
          closedByUser: { select: { name: true } },
        },
      }),
      prisma.cashTransaction.findMany(),
      prisma.quotation.findMany({
        include: { user: { select: { name: true } } },
      }),
      prisma.quotationItem.findMany(),
      prisma.commission.findMany(),
      prisma.purchaseOrder.findMany(),
      prisma.purchaseOrderItem.findMany(),
      prisma.inventoryMovement.findMany(),
      prisma.fiscalSequence.findMany(),
      prisma.transactionHistory.findMany(),
      prisma.budget.findMany(),
      prisma.pendingPayment.findMany(),
      prisma.monthlyClosing.findMany(),
    ]);

    const backup = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      data: {
        users, categories, products, clients, suppliers,
        supplierInvoices, sales, saleItems, transactions, settings,
        cashRegisters, cashTransactions, quotations, quotationItems,
        commissions, purchaseOrders, purchaseOrderItems, inventoryMovements,
        fiscalSequences, transactionHistory, budgets, pendingPayments,
        monthlyClosings,
      },
    };

    return backup;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

export const restoreBackup = async (backupData) => {
  try {
    const { data } = backupData;

    if (!data) {
      throw new Error('Formato de backup inválido');
    }

    const tablesToTruncate = [
      'inventory_movements', 'sale_items', 'sales', 'cash_transactions', 'cash_registers',
      'quotation_items', 'quotations', 'purchase_order_items', 'purchase_orders',
      'transactions', 'transactions_history', 'commissions',
      'supplier_invoices', 'accounts_payable', 'accounts_receivable',
      'pending_payments', 'budgets', 'monthly_closings',
      'cost_analysis', 'fiscal_sequences',
      'products', 'categories', 'clients', 'suppliers', 'users', 'settings',
    ];

    await prisma.$transaction(async (tx) => {
      for (const t of tablesToTruncate) {
        try {
          await tx.$executeRawUnsafe(`TRUNCATE TABLE "${t}" CASCADE`);
        } catch (e) {
          // ignore if table doesn't exist or truncate not allowed
        }
      }

      if (data.categories && data.categories.length > 0) {
        for (const category of data.categories) {
          await tx.category.create({
            data: {
              id: category.id,
              name: category.name,
              description: category.description,
              createdAt: category.createdAt,
            },
          });
        }
      }

      if (data.products && data.products.length > 0) {
        const categoryMap = new Map();
        if (data.categories) {
          data.categories.forEach((cat) => {
            categoryMap.set(cat.name, cat.id);
          });
        }

        for (const product of data.products) {
          await tx.product.create({
            data: {
              id: product.id,
              name: product.name,
              description: product.description,
              sku: product.sku,
              barcode: product.barcode,
              price: product.price,
              cost: product.cost || 0,
              stock: product.stock || 0,
              minStock: product.minStock || 0,
              categoryId: product.category?.name ? categoryMap.get(product.category.name) : null,
              active: product.active !== false,
              createdAt: product.createdAt,
            },
          });
        }
      }

      if (data.clients && data.clients.length > 0) {
        for (const client of data.clients) {
          await tx.client.create({
            data: {
              id: client.id,
              name: client.name,
              email: client.email,
              phone: client.phone,
              rnc: client.rnc,
              address: client.address,
              balance: client.balance || 0,
              creditLimit: client.creditLimit || 0,
              active: client.active !== false,
              createdAt: client.createdAt,
            },
          });
        }
      }

      if (data.suppliers && data.suppliers.length > 0) {
        for (const supplier of data.suppliers) {
          await tx.supplier.create({
            data: {
              id: supplier.id,
              name: supplier.name,
              email: supplier.email,
              phone: supplier.phone,
              rnc: supplier.rnc,
              address: supplier.address,
              contact: supplier.contact,
              active: supplier.active !== false,
              createdAt: supplier.createdAt,
            },
          });
        }
      }

      if (data.users && data.users.length > 0) {
        const bcryptModule = await import('bcryptjs');
        const bcrypt = bcryptModule.default || bcryptModule;
        for (const user of data.users) {
          await tx.user.create({
            data: {
              id: user.id,
              username: user.username,
              email: user.email,
              name: user.name,
              role: user.role,
              permissions: user.permissions || {},
              active: user.active !== false,
              createdAt: user.createdAt,
              password: user.password,
            },
          });
        }
      }

      if (data.sales && data.sales.length > 0) {
        const clientMap = new Map();
        const userMap = new Map();
        const productMap = new Map();

        if (data.clients) {
          data.clients.forEach((c) => clientMap.set(c.name, c.id));
        }
        if (data.users) {
          data.users.forEach((u) => userMap.set(u.name, u.id));
        }
        if (data.products) {
          data.products.forEach((p) => productMap.set(p.sku, p.id));
        }

        for (const sale of data.sales) {
          const saleItems = sale.items || [];
          const createdSale = await tx.sale.create({
            data: {
              id: sale.id,
              invoiceNumber: sale.invoiceNumber,
              subtotal: sale.subtotal,
              tax: sale.tax,
              discount: sale.discount || 0,
              interest: sale.interest || 0,
              total: sale.total,
              paidAmount: sale.paidAmount,
              change: sale.change || 0,
              paymentMethod: sale.paymentMethod,
              status: sale.status,
              clientId: sale.client?.name ? clientMap.get(sale.client.name) : null,
              userId: sale.user?.name ? userMap.get(sale.user.name) : null,
              createdAt: sale.createdAt,
            },
          });

          for (const item of saleItems) {
            await tx.saleItem.create({
              data: {
                id: item.id,
                quantity: item.quantity,
                price: item.price,
                tax: item.tax,
                discount: item.discount || 0,
                total: item.total,
                saleId: createdSale.id,
                productId: productMap.get(item.product?.sku) || item.productId,
              },
            });
          }
        }
      }

      if (data.transactions && data.transactions.length > 0) {
        const userMap = new Map();
        if (data.users) {
          data.users.forEach((u) => userMap.set(u.name, u.id));
        }

        for (const transaction of data.transactions) {
          await tx.transaction.create({
            data: {
              id: transaction.id,
              type: transaction.type,
              amount: transaction.amount,
              description: transaction.description,
              reference: transaction.reference,
              date: transaction.date,
              userId: transaction.user?.name ? userMap.get(transaction.user.name) : null,
              createdAt: transaction.createdAt,
            },
          });
        }
      }

      if (data.settings) {
        await tx.settings.create({
          data: {
            id: data.settings.id || 'default-settings',
            companyName: data.settings.companyName,
            companyRnc: data.settings.companyRnc,
            companyAddress: data.settings.companyAddress,
            companyPhone: data.settings.companyPhone,
            companyEmail: data.settings.companyEmail,
            logo: data.settings.logo,
            currency: data.settings.currency || 'DOP',
            currencySymbol: data.settings.currencySymbol || 'RD$',
            taxRate: data.settings.taxRate || 0.18,
            interestRate: data.settings.interestRate || 0.02,
            theme: data.settings.theme || 'light',
            primaryColor: data.settings.primaryColor || '#4F46E5',
          },
        });
      }
    });

    return { success: true, message: 'Backup restaurado exitosamente' };
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
};
