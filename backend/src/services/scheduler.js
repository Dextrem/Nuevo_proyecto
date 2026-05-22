import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

const checkAging = async () => {
  try {
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 7);

    const [overdue, dueSoon] = await Promise.all([
      prisma.supplierInvoice.findMany({
        where: { paid: false, dueDate: { lt: now } },
      }),
      prisma.supplierInvoice.findMany({
        where: { paid: false, dueDate: { gte: now, lte: soon } },
      }),
    ]);

    if (overdue.length > 0) {
      const overdueAmount = overdue.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
      logger.warn(`CxP: ${overdue.length} facturas vencidas (${overdueAmount.toFixed(2)})`);
    }

    if (dueSoon.length > 0) {
      const dueSoonAmount = dueSoon.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0);
      logger.info(`CxP: ${dueSoon.length} facturas por vencer en 7 días (${dueSoonAmount.toFixed(2)})`);
    }

    // Registrar en historial si hay vencidas
    if (overdue.length > 0) {
      await prisma.transactionHistory.create({
        data: {
          type: 'ALERTA_CXP',
          description: `Alerta automática: ${overdue.length} facturas vencidas`,
          amount: overdue.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0),
          categoryName: 'Alertas',
          userName: 'Sistema',
        },
      }).catch(() => {});
    }
  } catch (error) {
    logger.error('Error en verificación CxP:', error.message);
  }
};

const checkLowStock = async () => {
  try {
    const settings = await prisma.settings.findFirst();
    if (!settings?.lowStockAlertEnabled) return;

    const lowStock = await prisma.product.findMany({
      where: {
        active: true,
        stock: { lte: 0 }, // stock en cero
        NOT: { minStock: 0 }, // excluir productos sin mínimo configurado
      },
      select: { name: true, sku: true, stock: true, minStock: true },
    });

    const lowStockByMin = await prisma.product.findMany({
      where: {
        active: true,
        minStock: { gt: 0 },
        stock: { gt: 0 },
      },
      select: { name: true, sku: true, stock: true, minStock: true },
    }).then(products => products.filter(p => p.stock <= p.minStock));

    lowStock.push(...lowStockByMin);

    if (lowStock.length > 0) {
      logger.warn(`Inventario: ${lowStock.length} productos con stock bajo`);
    }
  } catch (error) {
    logger.error('Error en verificación de stock bajo:', error.message);
  }
};

export const startScheduler = () => {
  logger.info('Iniciando tareas programadas...');

  const runTasks = async () => {
    await checkAging();
    await checkLowStock();
  };

  runTasks();
  setInterval(runTasks, 60 * 60 * 1000);

  logger.info('Tareas programadas activas (intervalo: 60 min)');
};
