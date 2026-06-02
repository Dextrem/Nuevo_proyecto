import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

export const getCostsReport = async (req, res) => {
  try {
    const { startDate, endDate, categoryId } = req.query;

    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const productWhere = { active: true };
    if (categoryId) {
      productWhere.categoryId = categoryId;
    }

    const [
      products,
      categories,
      salesData,
      expensesData,
      inventoryStats,
    ] = await Promise.all([
      prisma.product.findMany({
        where: productWhere,
        include: {
          category: { select: { id: true, name: true } },
          saleItems: {
            where: dateFilter.startDate || dateFilter.endDate ? {
              sale: {
                createdAt: dateFilter,
                status: 'COMPLETED'
              }
            } : {
              sale: { status: 'COMPLETED' }
            },
            select: {
              quantity: true,
              price: true,
              cost: true,
              total: true,
            }
          }
        },
        orderBy: { name: 'asc' },
      }),
      prisma.category.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.sale.aggregate({
        where: {
          status: 'COMPLETED',
          ...(dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : {}),
        },
        _sum: {
          subtotal: true,
          tax: true,
          total: true,
          discount: true,
        },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: {
          type: 'EXPENSE',
          ...(dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.product.aggregate({
        where: { active: true },
        _sum: {
          cost: true,
        },
        _count: true,
      }),
    ]);

    const productsWithCostAnalysis = products.map(product => {
      const totalSold = product.saleItems.reduce((sum, item) => sum + item.quantity, 0);
      const totalRevenue = product.saleItems.reduce((sum, item) => sum + item.total, 0);
      const totalCost = product.saleItems.reduce((sum, item) => {
        // Fallback al costo actual si el costo registrado en la venta es 0 o nulo
        const itemUnitCost = (item.cost && item.cost > 0) ? item.cost : (product.cost || 0);
        return sum + (itemUnitCost * item.quantity);
      }, 0);
      const profit = totalRevenue - totalCost;
      const historicalMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
      const historicalUnitCost = totalSold > 0 ? totalCost / totalSold : 0;

      const currentExpectedMargin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        cost: product.cost,
        historicalCost: Math.round(historicalUnitCost * 100) / 100,
        price: product.price,
        stock: product.stock,
        inventoryCost: product.cost * product.stock,
        inventoryValue: product.price * product.stock,
        totalSold,
        totalRevenue,
        totalCost,
        profit,
        margin: historicalMargin.toFixed(2),
        currentMargin: currentExpectedMargin.toFixed(2),
        soldOut: product.stock === 0 && totalSold > 0,
      };
    });

    const totalInventoryCost = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const potentialProfit = totalInventoryValue - totalInventoryCost;

    const soldProducts = productsWithCostAnalysis.filter(p => p.totalSold > 0);
    const totalCostOfGoodsSold = soldProducts.reduce((sum, p) => sum + p.totalCost, 0);
    const totalRevenueFromSales = soldProducts.reduce((sum, p) => sum + p.totalRevenue, 0);
    const grossProfit = totalRevenueFromSales - totalCostOfGoodsSold;
    const grossMargin = totalRevenueFromSales > 0 ? (grossProfit / totalRevenueFromSales) * 100 : 0;

    const totalExpenses = expensesData._sum.amount || 0;
    const netProfit = grossProfit - totalExpenses;
    const netMargin = totalRevenueFromSales > 0 ? (netProfit / totalRevenueFromSales) * 100 : 0;

    const topProfitableProducts = [...productsWithCostAnalysis]
      .filter(p => p.totalSold > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // En contabilidad, los productos con bajo margen se evalúan en base a su estrategia
    // de precios actual, no a la histórica (ya que los costos/precios pudieron ser corregidos).
    const lowMarginProducts = [...productsWithCostAnalysis]
      .filter(p => p.price > 0 && parseFloat(p.currentMargin) < 20)
      .sort((a, b) => parseFloat(a.currentMargin) - parseFloat(b.currentMargin))
      .slice(0, 10);

    res.json({
      summary: {
        totalInventoryCost,
        totalInventoryValue,
        potentialProfit,
        costOfGoodsSold: totalCostOfGoodsSold,
        totalRevenue: totalRevenueFromSales,
        grossProfit,
        grossMargin: grossMargin.toFixed(2),
        totalExpenses,
        netProfit,
        netMargin: netMargin.toFixed(2),
        totalProducts: products.length,
        productsSold: soldProducts.length,
      },
      salesData: {
        totalSales: salesData._count || 0,
        subtotal: salesData._sum?.subtotal || 0,
        tax: salesData._sum?.tax || 0,
        total: salesData._sum?.total || 0,
        discount: salesData._sum?.discount || 0,
      },
      expenses: totalExpenses,
      products: productsWithCostAnalysis,
      categories,
      topProfitableProducts,
      lowMarginProducts,
    });
  } catch (error) {
    logger.error('Error al generar reporte de costos:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getProductCostAnalysis = async (req, res) => {
  try {
    const { productId } = req.params;
    const { months = 12 } = req.query;

    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: { select: { name: true } },
        saleItems: {
          where: {
            sale: {
              createdAt: { gte: startDate },
              status: 'COMPLETED',
            },
          },
          include: {
            sale: {
              select: {
                createdAt: true,
                invoiceNumber: true,
              },
            },
          },
          orderBy: { sale: { createdAt: 'desc' } },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const monthlyData = {};
    let totalQuantity = 0;
    let totalRevenue = 0;
    let totalCost = 0;

    product.saleItems.forEach(item => {
      const month = new Date(item.sale.createdAt).toISOString().slice(0, 7);
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month,
          quantity: 0,
          revenue: 0,
          cost: 0,
          profit: 0,
        };
      }
      const itemUnitCost = item.cost || 0;
      const itemCost = itemUnitCost * item.quantity;
      const itemProfit = item.total - itemCost;
      
      monthlyData[month].quantity += item.quantity;
      monthlyData[month].revenue += item.total;
      monthlyData[month].cost += itemCost;
      monthlyData[month].profit += itemProfit;
      
      totalQuantity += item.quantity;
      totalRevenue += item.total;
      totalCost += itemCost;
    });

    const totalProfit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const historicalUnitCost = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    res.json({
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category?.name,
        cost: product.cost,
        historicalCost: Math.round(historicalUnitCost * 100) / 100,
        price: product.price,
        currentStock: product.stock,
      },
      summary: {
        totalQuantity,
        totalRevenue,
        totalCost,
        totalProfit,
        margin: margin.toFixed(2),
      },
      monthlyData: Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month)),
      recentSales: product.saleItems.slice(0, 20).map(item => ({
        date: item.sale.createdAt,
        invoiceNumber: item.sale.invoiceNumber,
        quantity: item.quantity,
        revenue: item.total,
        unitCost: item.cost || 0,
        cost: (item.cost || 0) * item.quantity,
        profit: item.total - ((item.cost || 0) * item.quantity),
      })),
    });
  } catch (error) {
    logger.error('Error al analizar costos del producto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getProfitAndLoss = async (req, res) => {
  try {
    const { startDate, endDate, compareWithPrevious } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = dateFilter.gte || dateFilter.lte;

    const buildWhere = (prefix) => {
      if (prefix === 'current') {
        return hasDateFilter ? { createdAt: dateFilter } : {};
      }
      if (prefix === 'previous' && hasDateFilter) {
        const range = dateFilter.gte && dateFilter.lte
          ? dateFilter.lte.getTime() - dateFilter.gte.getTime()
          : 0;
        const prevEnd = dateFilter.gte ? new Date(dateFilter.gte.getTime() - 1) : new Date();
        const prevStart = range > 0 ? new Date(prevEnd.getTime() - range) : new Date(0);
        return { createdAt: { gte: prevStart, lte: prevEnd } };
      }
      return {};
    };

    const fetchPeriod = async (prefix) => {
      const saleWhere = { status: 'COMPLETED', ...buildWhere(prefix) };
      const expenseWhere = { type: 'EXPENSE', ...(hasDateFilter ? { date: dateFilter } : {}) };
      if (prefix === 'previous' && hasDateFilter) {
        const range = dateFilter.gte && dateFilter.lte
          ? dateFilter.lte.getTime() - dateFilter.gte.getTime()
          : 0;
        const prevEnd = dateFilter.gte ? new Date(dateFilter.gte.getTime() - 1) : new Date();
        const prevStart = range > 0 ? new Date(prevEnd.getTime() - range) : new Date(0);
        expenseWhere.date = { gte: prevStart, lte: prevEnd };
      }

      const [
        salesAgg,
        salesItems,
        expensesAgg,
        cogsData,
      ] = await Promise.all([
        prisma.sale.aggregate({
          where: saleWhere,
          _sum: { total: true, subtotal: true, tax: true, discount: true },
          _count: true,
        }),
        prisma.saleItem.findMany({
          where: { sale: saleWhere },
          select: { quantity: true, cost: true, total: true },
        }),
        prisma.transaction.aggregate({
          where: expenseWhere,
          _sum: { amount: true },
        }),
        prisma.saleItem.findMany({
          where: { sale: saleWhere },
          include: {
            product: {
              select: { cost: true }
            }
          }
        }),
      ]);

      const totalRevenue = salesAgg._sum?.total || 0;
      const totalSubtotal = salesAgg._sum?.subtotal || 0;
      const totalTax = salesAgg._sum?.tax || 0;
      const totalDiscount = salesAgg._sum?.discount || 0;

      const totalCostOfGoodsSold = cogsData.reduce(
        (sum, item) => {
          const itemUnitCost = (item.cost && item.cost > 0) ? item.cost : (item.product?.cost || 0);
          return sum + (itemUnitCost * item.quantity);
        }, 0
      );
      const grossProfit = totalRevenue - totalCostOfGoodsSold;
      const totalExpenses = expensesAgg._sum?.amount || 0;
      const netProfit = grossProfit - totalExpenses;

      return {
        revenue: {
          total: totalRevenue,
          subtotal: totalSubtotal,
          tax: totalTax,
          discount: totalDiscount,
          salesCount: salesAgg._count || 0,
        },
        costOfGoodsSold: totalCostOfGoodsSold,
        grossProfit,
        grossMargin: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
        totalExpenses,
        netProfit,
        netMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        expenseRatio: totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0,
        cogsRatio: totalRevenue > 0 ? (totalCostOfGoodsSold / totalRevenue) * 100 : 0,
      };
    };

    const current = await fetchPeriod('current');

    let previous = null;
    if (compareWithPrevious !== 'false') {
      previous = await fetchPeriod('previous');
    }

    res.json({
      period: { startDate, endDate },
      current,
      previous,
      variance: previous ? {
        revenueChange: previous.revenue.total > 0
          ? ((current.revenue.total - previous.revenue.total) / previous.revenue.total) * 100 : 0,
        cogsChange: previous.costOfGoodsSold > 0
          ? ((current.costOfGoodsSold - previous.costOfGoodsSold) / previous.costOfGoodsSold) * 100 : 0,
        grossProfitChange: previous.grossProfit > 0
          ? ((current.grossProfit - previous.grossProfit) / previous.grossProfit) * 100 : 0,
        netProfitChange: previous.netProfit > 0
          ? ((current.netProfit - previous.netProfit) / previous.netProfit) * 100 : 0,
        expensesChange: previous.totalExpenses > 0
          ? ((current.totalExpenses - previous.totalExpenses) / previous.totalExpenses) * 100 : 0,
      } : null,
    });
  } catch (error) {
    logger.error('Error al generar Estado de Resultados:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCostsByCategory = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = dateFilter.gte || dateFilter.lte;

    const saleWhere = {
      status: 'COMPLETED',
      ...(hasDateFilter ? { createdAt: dateFilter } : {}),
    };

    const products = await prisma.product.findMany({
      where: {}, // Incluir todos los productos para reportes históricos, no solo activos
      include: {
        category: { select: { id: true, name: true } },
        saleItems: {
          where: { sale: saleWhere },
          select: { quantity: true, cost: true, total: true, price: true },
        },
      },
    });

    const categoryMap = {};

    for (const product of products) {
      const catName = product.category?.name || 'Sin categoría';
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          category: catName,
          categoryId: product.category?.id || null,
          totalCost: 0,
          totalRevenue: 0,
          totalQuantity: 0,
          productCount: 0,
        };
      }
      categoryMap[catName].productCount += 1;

      for (const item of product.saleItems) {
        const itemUnitCost = (item.cost && item.cost > 0) ? item.cost : (product.cost || 0);
        categoryMap[catName].totalCost += itemUnitCost * item.quantity;
        categoryMap[catName].totalRevenue += item.total;
        categoryMap[catName].totalQuantity += item.quantity;
      }
    }

    const categories = Object.values(categoryMap).map(cat => ({
      ...cat,
      profit: cat.totalRevenue - cat.totalCost,
      margin: cat.totalRevenue > 0
        ? ((cat.totalRevenue - cat.totalCost) / cat.totalRevenue * 100).toFixed(2)
        : '0.00',
    }));

    const grandTotalCost = categories.reduce((s, c) => s + c.totalCost, 0);
    const grandTotalRevenue = categories.reduce((s, c) => s + c.totalRevenue, 0);

    const categoriesWithPct = categories.map(cat => ({
      ...cat,
      costPercentage: grandTotalCost > 0 ? (cat.totalCost / grandTotalCost * 100).toFixed(2) : '0.00',
      revenuePercentage: grandTotalRevenue > 0 ? (cat.totalRevenue / grandTotalRevenue * 100).toFixed(2) : '0.00',
    }));

    res.json({
      categories: categoriesWithPct.sort((a, b) => b.totalCost - a.totalCost),
      totals: {
        totalCost: grandTotalCost,
        totalRevenue: grandTotalRevenue,
        totalProfit: grandTotalRevenue - grandTotalCost,
        totalMargin: grandTotalRevenue > 0
          ? ((grandTotalRevenue - grandTotalCost) / grandTotalRevenue * 100).toFixed(2)
          : '0.00',
      },
    });
  } catch (error) {
    logger.error('Error al obtener costos por categoría:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCostTrend = async (req, res) => {
  try {
    const { months = 12 } = req.query;
    const periodCount = parseInt(months) || 12;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - periodCount);

    const salesItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: { gte: startDate, lte: endDate },
          status: 'COMPLETED',
        },
      },
      include: {
        sale: { select: { createdAt: true } },
        product: { select: { cost: true } }
      },
    });

    const expenses = await prisma.transaction.findMany({
      where: {
        type: 'EXPENSE',
        date: { gte: startDate, lte: endDate },
      },
      select: { amount: true, date: true },
    });

    const monthlyMap = {};
    for (let i = 0; i < periodCount; i++) {
      const d = new Date(endDate);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = {
        month: key,
        revenue: 0,
        costOfGoodsSold: 0,
        grossProfit: 0,
        grossMargin: 0,
        expenses: 0,
        netProfit: 0,
        netMargin: 0,
        transactions: 0,
      };
    }

    for (const item of salesItems) {
      const key = new Date(item.sale.createdAt).toISOString().slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += item.total;
        const itemUnitCost = (item.cost && item.cost > 0) ? item.cost : (item.product?.cost || 0);
        monthlyMap[key].costOfGoodsSold += itemUnitCost * item.quantity;
        monthlyMap[key].transactions += 1;
      }
    }

    for (const exp of expenses) {
      const key = new Date(exp.date).toISOString().slice(0, 7);
      if (monthlyMap[key]) {
        monthlyMap[key].expenses += exp.amount;
      }
    }

    const trend = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => {
        m.grossProfit = m.revenue - m.costOfGoodsSold;
        m.grossMargin = m.revenue > 0 ? (m.grossProfit / m.revenue * 100).toFixed(2) : '0.00';
        m.netProfit = m.grossProfit - m.expenses;
        m.netMargin = m.revenue > 0 ? (m.netProfit / m.revenue * 100).toFixed(2) : '0.00';
        return m;
      });

    const totalRevenue = trend.reduce((s, m) => s + m.revenue, 0);
    const totalCost = trend.reduce((s, m) => s + m.costOfGoodsSold, 0);
    const totalExpenses = trend.reduce((s, m) => s + m.expenses, 0);
    const totalGross = totalRevenue - totalCost;
    const totalNet = totalGross - totalExpenses;

    res.json({
      trend,
      totals: {
        revenue: totalRevenue,
        costOfGoodsSold: totalCost,
        grossProfit: totalGross,
        grossMargin: totalRevenue > 0 ? (totalGross / totalRevenue * 100).toFixed(2) : '0.00',
        totalExpenses,
        netProfit: totalNet,
        netMargin: totalRevenue > 0 ? (totalNet / totalRevenue * 100).toFixed(2) : '0.00',
      },
    });
  } catch (error) {
    logger.error('Error al obtener tendencia de costos:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
