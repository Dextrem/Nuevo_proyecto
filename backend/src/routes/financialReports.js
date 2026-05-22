import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma from '../config/database.js';
import { sendMail } from '../services/emailService.js';

const router = Router();
router.use(authenticateToken);

router.get('/accounts-receivable', async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { active: true, balance: { gt: 0 } },
      include: {
        sales: {
          where: { paymentMethod: 'CREDIT', status: 'PENDING' },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { balance: 'desc' }
    });

    const totalReceivable = clients.reduce((sum, c) => sum + c.balance, 0);
    const clientsWithDetails = clients.map(client => ({
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      rnc: client.rnc,
      balance: client.balance,
      creditLimit: client.creditLimit,
      availableCredit: client.creditLimit - client.balance,
      sales: client.sales.map(sale => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        date: sale.createdAt,
        total: sale.total,
        paidAmount: sale.paidAmount,
        pending: sale.total - sale.paidAmount
      }))
    }));

    res.json({
      totalReceivable,
      clientCount: clients.length,
      clients: clientsWithDetails
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/accounts-payable', async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { active: true },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { balance: 'desc' }
    });

    const suppliersWithDebt = suppliers.filter(s => s.balance > 0 || s.invoices.some(i => !i.paid));
    
    const totalPayable = suppliersWithDebt.reduce((sum, s) => sum + s.balance, 0);
    const suppliersWithDetails = suppliersWithDebt.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      rnc: supplier.rnc,
      balance: supplier.balance,
      invoices: supplier.invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        description: inv.description,
        date: inv.createdAt,
        dueDate: inv.dueDate,
        amount: inv.amount,
        paidAmount: inv.paidAmount,
        paid: inv.paid,
        paidDate: inv.paidDate,
        document: inv.document ? true : false
      }))
    }));

    const now = new Date();

    const allInvoices = suppliersWithDebt.flatMap(supplier => supplier.invoices);

    const agingBuckets = {
      current: 0,
      "1-30": 0,
      "31-60": 0,
      "61-90": 0,
      "91+": 0,
      overdue: 0,
      dueSoon7: 0,
    };

    allInvoices.forEach((invoice) => {
      const pending = invoice.amount - invoice.paidAmount;
      if (pending <= 0) return;

      if (!invoice.dueDate) {
        agingBuckets.current += pending;
        return;
      }

      const due = new Date(invoice.dueDate);
      const diffDays = Math.floor((now - due) / (1000 * 60 * 60 * 24));

      if (due < now) {
        agingBuckets.overdue += pending;
      }

      if (diffDays <= 0) {
        agingBuckets.current += pending;
      } else if (diffDays <= 30) {
        agingBuckets['1-30'] += pending;
      } else if (diffDays <= 60) {
        agingBuckets['31-60'] += pending;
      } else if (diffDays <= 90) {
        agingBuckets['61-90'] += pending;
      } else {
        agingBuckets['91+'] += pending;
      }

      const aheadDays = Math.floor((due - now) / (1000 * 60 * 60 * 24));
      if (aheadDays >= 0 && aheadDays <= 7) {
        agingBuckets.dueSoon7 += pending;
      }
    });

    res.json({
      totalPayable,
      supplierCount: suppliersWithDebt.length,
      suppliers: suppliersWithDetails,
      aging: agingBuckets,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/accounting', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate + 'T00:00:00');
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59');
    }

    const [transactions, supplierInvoices] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { user: { select: { name: true } } },
        orderBy: { date: 'desc' }
      }),
      prisma.supplierInvoice.findMany({
        where: {
          createdAt: where.date,
          paid: false
        },
        include: { supplier: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const cxpEntries = supplierInvoices.map(inv => ({
      id: `cxp_${inv.id}`,
      type: 'EXPENSE',
      amount: inv.amount - inv.paidAmount,
      description: `CxP: ${inv.description || 'Factura de proveedor'}${inv.invoiceNumber ? ` (${inv.invoiceNumber})` : ''}`,
      reference: inv.invoiceNumber,
      date: inv.createdAt,
      user: inv.supplier ? { name: inv.supplier.name } : { name: 'Proveedor' },
      isCxp: true,
      supplierId: inv.supplierId,
      invoiceId: inv.id
    }));

    const allTransactions = [...transactions, ...cxpEntries].sort((a, b) => new Date(b.date) - new Date(a.date));

    const income = allTransactions.filter(t => t.type === 'INCOME');
    const expenses = allTransactions.filter(t => t.type === 'EXPENSE');

    const totalIncome = income.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

    const incomeByCategory = {};
    const expenseByCategory = {};

    income.forEach(t => {
      const category = t.reference || 'Otros Ingresos';
      incomeByCategory[category] = (incomeByCategory[category] || 0) + t.amount;
    });

    expenses.forEach(t => {
      const category = t.isCxp ? 'Cuentas por Pagar' : (t.description.split(' ')[0] || 'Gastos Varios');
      expenseByCategory[category] = (expenseByCategory[category] || 0) + t.amount;
    });

    res.json({
      transactions: allTransactions,
      summary: {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses,
        transactionCount: allTransactions.length,
        incomeCount: income.length,
        expenseCount: expenses.length
      },
      byCategory: {
        income: Object.entries(incomeByCategory).map(([name, amount]) => ({ name, amount })),
        expenses: Object.entries(expenseByCategory).map(([name, amount]) => ({ name, amount }))
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const now = new Date();
    const soonThreshold = new Date();
    soonThreshold.setDate(now.getDate() + 7);

    const overdueInvoices = await prisma.supplierInvoice.findMany({
      where: {
        paid: false,
        dueDate: { lt: now }
      }
    });

    const dueSoonInvoices = await prisma.supplierInvoice.findMany({
      where: {
        paid: false,
        dueDate: { gte: now, lte: soonThreshold }
      }
    });

    const highBalanceSuppliers = await prisma.supplier.findMany({
      where: {
        balance: { gt: 0 }
      },
      orderBy: { balance: 'desc' },
      take: 5
    });

    const creditSales = await prisma.sale.findMany({
      where: {
        status: 'PENDING',
        paymentMethod: 'CREDIT'
      }
    });

    let overdueSalesCount = 0;
    let overdueSalesAmount = 0;
    let dueSoonSalesCount = 0;
    let dueSoonSalesAmount = 0;

    for (const sale of creditSales) {
      const saleDate = new Date(sale.createdAt);
      const pending = (sale.total - sale.paidAmount) || 0;
      if (pending <= 0) continue;

      const diffDays = Math.floor((now - saleDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 30) {
        overdueSalesCount++;
        overdueSalesAmount += pending;
      }
      if (diffDays <= 7) {
        dueSoonSalesCount++;
        dueSoonSalesAmount += pending;
      }
    }

    res.json({
      overdueCount: overdueInvoices.length,
      dueSoonCount: dueSoonInvoices.length,
      overdueAmount: overdueInvoices.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0),
      dueSoonAmount: dueSoonInvoices.reduce((sum, inv) => sum + (inv.amount - inv.paidAmount), 0),
      highBalanceSuppliers: highBalanceSuppliers.map(s => ({ id: s.id, name: s.name, balance: s.balance })),
      overdueReceivableCount: overdueSalesCount,
      overdueReceivableAmount: overdueSalesAmount,
      dueSoonReceivableCount: dueSoonSalesCount,
      dueSoonReceivableAmount: dueSoonSalesAmount,
      highBalanceClients: await prisma.client.findMany({ where: { balance: { gt: 0 } }, orderBy: { balance: 'desc' }, take: 5 })
    });
  } catch (error) {
    console.error('Error generando notificaciones CxP:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/notifications/send-email', async (req, res) => {
  try {
    const { recipients, subject, message } = req.body;
    const to = recipients || process.env.NOTIFICATION_EMAILS || process.env.SMTP_USER;
    const text = message || 'Notificación automática de CxC / CxP';

    const result = await sendMail({
      to,
      subject: subject || '[Dextremix Finance] Notificación CxC/CxP',
      text,
    });

    res.json({ message: 'Correo enviado', to, result });
  } catch (error) {
    console.error('Error enviando notificación por correo:', error);
    res.status(500).json({ error: 'Error al enviar correo' });
  }
});

router.get('/company-status', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      todaySales,
      monthSales,
      yearSales,
      totalReceivable,
      totalPayable,
      inventoryValue,
      products,
      clientsWithDebt,
      suppliersWithDebt,
      recentTransactions
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: today }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfYear }, status: 'COMPLETED' },
        _sum: { total: true },
        _count: true
      }),
      prisma.client.aggregate({
        where: { active: true, balance: { gt: 0 } },
        _sum: { balance: true }
      }),
      prisma.supplier.aggregate({
        where: { active: true },
        _sum: { balance: true }
      }),
      prisma.product.aggregate({
        where: { active: true },
        _sum: { stock: true }
      }),
      prisma.product.findMany({
        where: { active: true },
        select: { price: true, stock: true, cost: true }
      }),
      prisma.client.count({
        where: { active: true, balance: { gt: 0 } }
      }),
      prisma.supplier.count({
        where: { active: true, balance: { gt: 0 } }
      }),
      prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        include: { user: { select: { name: true } } }
      })
    ]);

    const inventoryTotal = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
    const inventoryCost = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

    const monthIncome = await prisma.transaction.aggregate({
      where: { type: 'INCOME', date: { gte: startOfMonth } },
      _sum: { amount: true }
    });

    const monthExpenses = await prisma.transaction.aggregate({
      where: { type: 'EXPENSE', date: { gte: startOfMonth } },
      _sum: { amount: true }
    });

    const accountsReceivable = totalReceivable._sum.balance || 0;
    const accountsPayable = totalPayable._sum.balance || 0;

    res.json({
      sales: {
        today: { amount: todaySales._sum.total || 0, count: todaySales._count || 0 },
        month: { amount: monthSales._sum.total || 0, count: monthSales._count || 0 },
        year: { amount: yearSales._sum.total || 0, count: yearSales._count || 0 }
      },
      accounting: {
        monthIncome: monthIncome._sum.amount || 0,
        monthExpenses: monthExpenses._sum.amount || 0,
        netBalance: (monthIncome._sum.amount || 0) - (monthExpenses._sum.amount || 0)
      },
      accounts: {
        receivable: accountsReceivable,
        payable: accountsPayable,
        netPosition: accountsReceivable - accountsPayable
      },
      inventory: {
        totalProducts: products.length,
        totalStock: products.reduce((sum, p) => sum + p.stock, 0),
        value: inventoryTotal,
        cost: inventoryCost,
        profit: inventoryTotal - inventoryCost
      },
      clientsWithDebt,
      suppliersWithDebt,
      recentTransactions
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

export default router;
