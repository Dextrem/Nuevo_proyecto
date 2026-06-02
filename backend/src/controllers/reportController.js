import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

const getLowStockProducts = async (limit = 5) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, stock: true, minStock: true },
    orderBy: { stock: 'asc' },
  });
  return products.filter(p => p.minStock > 0 && p.stock <= p.minStock).slice(0, limit);
};

export const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      todaySales,
      monthSales,
      products,
      lowStockProducts,
      clients,
      pendingAccounts,
      recentTransactions,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: today, lt: tomorrow },
          status: 'COMPLETED',
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: 'COMPLETED',
        },
        _sum: { total: true },
        _count: true,
      }),
      prisma.product.count({
        where: { active: true },
      }),
      getLowStockProducts(5),
      prisma.client.findMany({
        where: { active: true },
        select: { id: true, name: true, balance: true },
        orderBy: { balance: 'desc' },
        take: 5,
      }),
      prisma.client.aggregate({
        where: { balance: { gt: 0 }, active: true },
        _sum: { balance: true },
      }),
      prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        take: 5,
        include: {
          user: {
            select: { name: true },
          },
        },
      }),
    ]);

    const monthIncome = await prisma.transaction.aggregate({
      where: {
        type: 'INCOME',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    });

    const monthExpense = await prisma.transaction.aggregate({
      where: {
        type: 'EXPENSE',
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      _sum: { amount: true },
    });

    res.json({
      today: {
        sales: todaySales._count || 0,
        amount: todaySales._sum.total || 0,
      },
      month: {
        sales: monthSales._count || 0,
        amount: monthSales._sum.total || 0,
        income: monthIncome._sum.amount || 0,
        expense: monthExpense._sum.amount || 0,
      },
      inventory: {
        total: products,
        lowStock: lowStockProducts,
      },
      accountsReceivable: {
        count: pendingAccounts._count || 0,
        total: pendingAccounts._sum.balance || 0,
        topClients: clients,
      },
      recentTransactions,
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, clientId, groupBy = 'day' } = req.query;

    const where = {
      status: 'COMPLETED',
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setUTCHours(0, 0, 0, 0);
        where.createdAt.gte = sDate;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = eDate;
      }
    }

    if (clientId) {
      where.clientId = clientId;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        client: {
          select: { id: true, name: true },
        },
        user: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let groupedData = {};

    sales.forEach(sale => {
      let key;
      const date = new Date(sale.createdAt);

      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'year') {
        key = String(date.getFullYear());
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          period: key,
          totalSales: 0,
          totalAmount: 0,
          totalItems: 0,
          totalTax: 0,
        };
      }

      groupedData[key].totalSales += 1;
      groupedData[key].totalAmount += sale.total;
      groupedData[key].totalTax += sale.tax;
      groupedData[key].totalItems += sale.items.reduce((sum, item) => sum + item.quantity, 0);
    });

    const report = Object.values(groupedData);

    res.json({
      totalSales: sales.length,
      totalAmount: sales.reduce((sum, sale) => sum + sale.total, 0),
      totalTax: sales.reduce((sum, sale) => sum + sale.tax, 0),
      groupedData: report,
    });
  } catch (error) {
    logger.error('Error al generar reporte de ventas:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getInventoryReport = async (req, res) => {
  try {
    const { categoryId, lowStock } = req.query;

    const where = { active: true };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { name: true },
        },
      },
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });

    if (lowStock === 'true') {
      products = products.filter(p => p.minStock > 0 && p.stock <= p.minStock);
    }

    const totalValue = products.reduce((sum, product) => {
      return sum + (product.price * product.stock);
    }, 0);

    const totalCost = products.reduce((sum, product) => {
      return sum + (product.cost * product.stock);
    }, 0);

    res.json({
      totalProducts: products.length,
      totalValue,
      totalCost,
      potentialProfit: totalValue - totalCost,
      products,
    });
  } catch (error) {
    logger.error('Error al generar reporte de inventario:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSalesByProductReport = async (req, res) => {
  try {
    const { startDate, endDate, categoryId } = req.query;

    const where = {
      sale: {
        status: 'COMPLETED',
      },
    };

    if (startDate || endDate) {
      where.sale.createdAt = {};
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setUTCHours(0, 0, 0, 0);
        where.sale.createdAt.gte = sDate;
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setUTCHours(23, 59, 59, 999);
        where.sale.createdAt.lte = eDate;
      }
    }

    if (categoryId) {
      where.product = { categoryId };
    }

    const saleItems = await prisma.saleItem.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true, categoryId: true, category: { select: { name: true } } },
        },
      },
    });

    const productMap = {};
    for (const item of saleItems) {
      const pid = item.productId;
      if (!productMap[pid]) {
        productMap[pid] = {
          productId: pid,
          productName: item.product?.name || 'Desconocido',
          productSku: item.product?.sku || '',
          categoryName: item.product?.category?.name || '',
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalTax: 0,
          saleCount: 0,
          saleIds: new Set(),
        };
      }
      productMap[pid].totalQuantity += item.quantity;
      productMap[pid].totalRevenue += item.total;
      productMap[pid].totalCost += (item.cost || 0) * item.quantity;
      productMap[pid].totalTax += item.tax;
      productMap[pid].saleIds.add(item.saleId);
    }

    let products = Object.values(productMap).map(p => {
      const profit = p.totalRevenue - p.totalCost;
      return {
        ...p,
        saleCount: p.saleIds.size,
        profit,
        profitMargin: p.totalRevenue > 0 ? profit / p.totalRevenue : 0,
        saleIds: undefined,
      };
    });

    products.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totals = products.reduce((acc, p) => ({
      totalQuantity: acc.totalQuantity + p.totalQuantity,
      totalRevenue: acc.totalRevenue + p.totalRevenue,
      totalCost: acc.totalCost + p.totalCost,
      totalProfit: acc.totalProfit + p.profit,
    }), { totalQuantity: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 });

    res.json({
      totalProducts: products.length,
      ...totals,
      products,
    });
  } catch (error) {
    logger.error('Error al generar reporte de ventas por producto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate, clientId } = req.query;

    const transactionWhere = {};
    const saleWhere = { status: 'COMPLETED' };

    if (startDate || endDate) {
      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setUTCHours(0, 0, 0, 0);
        transactionWhere.date = { gte: sDate };
        saleWhere.createdAt = { gte: sDate };
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setUTCHours(23, 59, 59, 999);
        transactionWhere.date = { ...transactionWhere.date, lte: eDate };
        saleWhere.createdAt = { ...saleWhere.createdAt, lte: eDate };
      }
    }

    if (clientId) {
      saleWhere.clientId = clientId;
    }

    const [income, expense, salesByPayment] = await Promise.all([
      prisma.transaction.groupBy({
        by: ['type'],
        where: { ...transactionWhere, type: 'INCOME' },
        _sum: { amount: true },
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        where: { ...transactionWhere, type: 'EXPENSE' },
        _sum: { amount: true },
      }),
      prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: saleWhere,
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const totalIncome = income[0]?._sum.amount || 0;
    const totalExpense = expense[0]?._sum.amount || 0;
    const balance = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpense,
      balance,
      salesByPaymentMethod: salesByPayment.map(item => ({
        method: item.paymentMethod,
        count: item._count,
        total: item._sum.total || 0,
      })),
    });
  } catch (error) {
    logger.error('Error al generar reporte financiero:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
