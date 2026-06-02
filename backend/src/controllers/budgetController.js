import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

export const getAllBudgets = async (req, res) => {
  try {
    const { year, month, category, type } = req.query;
    const where = {};

    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);
    if (category) where.category = category;
    if (type) where.type = type;

    const budgets = await prisma.budget.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { category: 'asc' }],
    });

    res.json(budgets);
  } catch (error) {
    logger.error('Error al obtener presupuestos:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getBudgetById = async (req, res) => {
  try {
    const { id } = req.params;
    const budget = await prisma.budget.findUnique({ where: { id } });
    if (!budget) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    res.json(budget);
  } catch (error) {
    logger.error('Error al obtener presupuesto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createBudget = async (req, res) => {
  try {
    const { category, type, plannedAmount, year, month } = req.body;

    if (!category || !plannedAmount || !year || !month) {
      return res.status(400).json({ error: 'Categoría, monto, año y mes son requeridos' });
    }

    const budget = await prisma.budget.create({
      data: {
        category,
        type: type || 'expense',
        plannedAmount: parseFloat(plannedAmount),
        year: parseInt(year),
        month: parseInt(month),
      },
    });

    res.status(201).json(budget);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un presupuesto para esta categoría en este período' });
    }
    logger.error('Error al crear presupuesto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const { id } = req.params;
    const { category, type, plannedAmount, year, month } = req.body;

    const data = {};
    if (category) data.category = category;
    if (type) data.type = type;
    if (plannedAmount) data.plannedAmount = parseFloat(plannedAmount);
    if (year) data.year = parseInt(year);
    if (month) data.month = parseInt(month);

    const budget = await prisma.budget.update({
      where: { id },
      data,
    });

    res.json(budget);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un presupuesto para esta categoría en este período' });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    logger.error('Error al actualizar presupuesto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.budget.delete({ where: { id } });
    res.json({ message: 'Presupuesto eliminado' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }
    logger.error('Error al eliminar presupuesto:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getBudgetSummary = async (req, res) => {
  try {
    const { year, month } = req.query;
    const where = {};
    if (year) where.year = parseInt(year);
    if (month) where.month = parseInt(month);

    const budgets = await prisma.budget.findMany({ where });

    const budgetByCategory = {};
    let totalIncome = 0;
    let totalExpense = 0;

    budgets.forEach(b => {
      const key = `${b.type}_${b.category}`;
      budgetByCategory[key] = { planned: (budgetByCategory[key]?.planned || 0) + b.plannedAmount };
      if (b.type === 'income') totalIncome += b.plannedAmount;
      else totalExpense += b.plannedAmount;
    });

    res.json({ budgetByCategory, totalIncome, totalExpense });
  } catch (error) {
    logger.error('Error al obtener resumen de presupuestos:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getBudgetExecution = async (req, res) => {
  try {
    const { year, month } = req.query;
    if (!year || !month) {
      return res.status(400).json({ error: 'Año y mes son requeridos' });
    }

    const y = parseInt(year);
    const m = parseInt(month);

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59, 999);

    const [transactions] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          date: { gte: startDate, lte: endDate },
          status: 'APPROVED',
        },
      }),
    ]);

    const incomeByCategory = {};
    const expenseByCategory = {};
    let totalIncome = 0;
    let totalExpense = 0;

    const categoryKeywords = {
      ventas: ['venta', 'factura', 'cobro', 'abono inicial', 'abono cliente', 'abono aprobado'],
      servicios: ['servicio', 'honorario'],
      alquiler: ['alquiler', 'renta', 'local'],
      sueldos: ['sueldo', 'salario', 'nomina', 'pago personal'],
      servicios_pub: ['luz', 'agua', 'telefono', 'internet', 'claro', 'edesur', 'edenorte'],
      transporte: ['combustible', 'gasolina', 'transporte', 'flete', 'envio'],
      marketing: ['publicidad', 'facebook', 'instagram', 'anuncio', 'marketing'],
      mantenimiento: ['reparacion', 'mantenimiento', 'limpieza'],
      impuestos: ['itbis', 'dgii', 'impuesto', 'tasa'],
    };

    // Procesar transacciones manuales
    transactions.forEach(t => {
      let cat = t.category;
      
      // Categorización inteligente si no tiene categoría asignada
      if (!cat) {
        const desc = (t.description || '').toLowerCase();
        for (const [slug, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(k => desc.includes(k))) {
            cat = slug;
            break;
          }
        }
      }
      
      cat = cat || (t.type === 'INCOME' ? 'otros_ingresos' : 'otros_gastos');

      if (t.type === 'INCOME') {
        incomeByCategory[cat] = (incomeByCategory[cat] || 0) + t.amount;
        totalIncome += t.amount;
      } else {
        expenseByCategory[cat] = (expenseByCategory[cat] || 0) + t.amount;
        totalExpense += t.amount;
      }
    });

    res.json({
      year: y,
      month: m,
      totalIncome,
      totalExpense,
      incomeByCategory,
      expenseByCategory,
      saleCount: 0,
      transactionCount: transactions.length,
    });
  } catch (error) {
    logger.error('Error al obtener ejecución presupuestaria:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
