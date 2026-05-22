import { Router } from 'express';
import prisma from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

export const calculateCommissions = async (req, res) => {
  try {
    const { periodStart, periodEnd, calculationType, userIds } = req.body;

    if (!periodStart || !periodEnd) {
      return res.status(400).json({ error: 'Debe especificar fecha de inicio y fin del período' });
    }

    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    endDate.setHours(23, 59, 59, 999);

    const settings = await prisma.settings.findFirst();
    const commissionRate = settings?.commissionRate || 0.15;
    const minAmount = settings?.commissionMinAmount || 4000;
    const calcType = calculationType || settings?.commissionType || 'BY_SALE';

    const whereUser = { active: true, role: { not: 'ADMIN' } };
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      whereUser.id = { in: userIds };
    }

    const users = await prisma.user.findMany({
      where: whereUser,
      include: {
        sales: {
          where: {
            saleDate: { gte: startDate, lte: endDate },
            status: 'COMPLETED'
          },
          select: { id: true, total: true, saleDate: true }
        }
      }
    });

    const results = [];

    for (const user of users) {
      const totalSales = user.sales.reduce((sum, sale) => sum + sale.total, 0);
      
      let commissionAmount = 0;
      let details = {};

      if (calcType === 'BY_SALE') {
        if (totalSales > minAmount) {
          const excedent = totalSales - minAmount;
          commissionAmount = excedent * commissionRate;
          details = {
            minAmount,
            excedent,
            rate: commissionRate,
            calculation: `(${excedent.toFixed(2)} x ${(commissionRate * 100)}%)`
          };
        }
      } else {
        const avgPerSale = totalSales / (user.sales.length || 1);
        const applicableSales = user.sales.filter(s => s.total > minAmount);
        const applicableTotal = applicableSales.reduce((sum, s) => sum + s.total, 0);
        
        if (applicableTotal > 0) {
          commissionAmount = applicableTotal * commissionRate;
          details = {
            minAmount,
            totalApplicable: applicableTotal,
            rate: commissionRate,
            salesCount: applicableSales.length,
            calculation: `(${applicableTotal.toFixed(2)} x ${(commissionRate * 100)}%)`
          };
        }
      }

      const commission = await prisma.commission.create({
        data: {
          userId: user.id,
          periodStart: startDate,
          periodEnd: endDate,
          totalSales,
          commissionRate,
          commissionAmount,
          calculationType: calcType,
          status: 'PENDING',
          details
        }
      });

      results.push({
        user: { id: user.id, name: user.name, username: user.username },
        totalSales,
        commissionAmount,
        salesCount: user.sales.length,
        commissionId: commission.id
      });
    }

    res.json({
      message: `Comisiones calculadas para ${results.length} vendedores`,
      period: { start: startDate, end: endDate },
      calculationType: calcType,
      results
    });
  } catch (error) {
    console.error('Error calculando comisiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

router.get('/', async (req, res) => {
  try {
    const { status, userId, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (userId) where.userId = userId;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [commissions, total] = await Promise.all([
      prisma.commission.findMany({
        where,
        include: { user: { select: { id: true, name: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.commission.count({ where })
    ]);

    res.json({
      data: commissions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/calculate', requireRole('ADMIN'), calculateCommissions);

router.patch('/:id/status', requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'APPROVED', 'PAID'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const data = { status };
    if (status === 'PAID') {
      data.paidAt = new Date();
    }

    const commission = await prisma.commission.update({
      where: { id },
      data,
      include: { user: { select: { id: true, name: true, username: true } } }
    });

    res.json(commission);
  } catch (error) {
    console.error('Error actualizando estado de comisión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/summary', requireRole('ADMIN'), async (req, res) => {
  try {
    const summary = await prisma.commission.groupBy({
      by: ['status'],
      _sum: { commissionAmount: true },
      _count: true
    });

    const totalPending = summary.find(s => s.status === 'PENDING')?._sum.commissionAmount || 0;
    const totalApproved = summary.find(s => s.status === 'APPROVED')?._sum.commissionAmount || 0;
    const totalPaid = summary.find(s => s.status === 'PAID')?._sum.commissionAmount || 0;

    res.json({
      pending: totalPending,
      approved: totalApproved,
      paid: totalPaid,
      totalUsers: await prisma.user.count({ where: { role: { not: 'ADMIN' }, active: true } })
    });
  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/active-cashiers', requireRole('ADMIN'), async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    
    let startDate, endDate;
    if (periodStart && periodEnd) {
      startDate = new Date(periodStart);
      endDate = new Date(periodEnd);
    } else {
      // Default to current month
      startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      endDate = new Date();
    }
    endDate.setHours(23, 59, 59, 999);

    const activeUsers = await prisma.user.findMany({
      where: {
        role: { not: 'ADMIN' },
        active: true,
        sales: {
          some: {
            saleDate: { gte: startDate, lte: endDate },
            status: 'COMPLETED'
          }
        }
      },
      select: {
        id: true,
        name: true,
        username: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(activeUsers);
  } catch (error) {
    console.error('Error obteniendo cajeros activos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
