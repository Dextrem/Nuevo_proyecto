import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';

export const getAllTransactionsHistory = async (req, res) => {
  try {
    const { type, startDate, endDate, category, search } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (category) {
      where.categoryName = category;
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

    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { reference: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
        { supplierName: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      prisma.transactionHistory.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transactionHistory.count({ where }),
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
    logger.error('Error al obtener historial global:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
