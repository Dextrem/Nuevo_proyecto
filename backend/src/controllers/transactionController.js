import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

export const getAllTransactions = async (req, res) => {
  try {
    const { type, startDate, endDate, reference } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (type) {
      where.type = type;
    }

    if (reference) {
      where.reference = { contains: reference, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate + 'T00:00:00');
      }
      if (endDate) {
        where.date.lte = new Date(endDate + 'T23:59:59');
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    logger.error('Error al obtener transacciones:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createTransaction = async (req, res) => {
  try {
    const { type, amount, description, reference, category } = req.body;

    if (!type || !['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'El tipo debe ser INCOME o EXPENSE' });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    if (!description) {
      return res.status(400).json({ error: 'La descripción es requerida' });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const newTransaction = await tx.transaction.create({
        data: {
          type,
          amount,
          description,
          reference,
          category,
          userId: req.user.id,
        },
        include: {
          user: {
            select: { id: true, name: true, username: true },
          },
        },
      });

      await tx.transactionHistory.create({
        data: {
          type: type === 'INCOME' ? 'INGRESO' : 'GASTO',
          description,
          amount,
          categoryName: reference || 'General',
          reference,
          userName: newTransaction.user.name,
          details: { transactionId: newTransaction.id }
        }
      });

      return newTransaction;
    });

    res.status(201).json({ 
      message: 'Transacción creada exitosamente',
      transaction 
    });
  } catch (error) {
    logger.error('Error al crear transacción:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, reference } = req.body;

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        type,
        amount,
        description,
        reference,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    // Registrar en historial de transacciones
    await prisma.transactionHistory.create({
      data: {
        type: 'ACTUALIZAR_TRANSACCION',
        description: `Transacción actualizada: ${description}`,
        amount,
        categoryName: reference || 'General',
        reference,
        userName: req.user.name || req.user.username,
        details: { 
          updatedTransactionId: id,
          type,
          amount 
        }
      }
    });

    res.json({ 
      message: 'Transacción actualizada exitosamente',
      transaction 
    });
  } catch (error) {
    logger.error('Error al actualizar transacción:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { id }
    });

    if (transaction) {
      await prisma.transaction.delete({
        where: { id },
      });

      // Registrar en historial de transacciones
      await prisma.transactionHistory.create({
        data: {
          type: 'ELIMINAR_TRANSACCION',
          description: `Transacción eliminada: ${transaction.description}`,
          amount: transaction.amount,
          categoryName: transaction.reference || 'General',
          reference: transaction.reference,
          userName: req.user.name || req.user.username,
          details: { 
            deletedTransactionId: id,
            description: transaction.description
          }
        }
      });
    }

    res.json({ message: 'Transacción eliminada exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar transacción:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getTransactionSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const [income, expense] = await Promise.all([
      prisma.transaction.aggregate({
        where: { ...where, type: 'INCOME' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { ...where, type: 'EXPENSE' },
        _sum: { amount: true },
        _count: true,
      })
    ]);

    const saleWhere = { paymentMethod: 'CREDIT', status: { in: ['PENDING', 'PARTIAL'] } };
    if (startDate || endDate) {
      saleWhere.dueDate = {};
      if (startDate) saleWhere.dueDate.gte = new Date(startDate);
      if (endDate) saleWhere.dueDate.lte = new Date(endDate);
    }
    const creditSalesList = await prisma.sale.findMany({
      where: saleWhere,
      select: { total: true, paidAmount: true }
    });
    const creditSalesAmount = creditSalesList.reduce((acc, sale) => acc + (sale.total - sale.paidAmount), 0);

    const totalIncome = income._sum.amount || 0;
    const totalExpense = expense._sum.amount || 0;
    const creditSales = creditSalesAmount;
    const cashIncome = totalIncome;
    const balance = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpense,
      balance,
      cashIncome,
      creditSales,
      incomeCount: income._count,
      expenseCount: expense._count,
    });
  } catch (error) {
    logger.error('Error al obtener resumen:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
