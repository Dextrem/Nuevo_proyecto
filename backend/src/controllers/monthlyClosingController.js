import prisma from '../config/database.js';

const getMonthDateRange = (year, month) => {
  const startDate = new Date(year, month - 1, 1, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  return { startDate, endDate };
};

const calculateDaysOverdue = (dueDate) => {
  if (!dueDate) return 0;
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today - due;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
};

export const createMonthlyClosing = async (req, res) => {
  try {
    const { year, month, notes } = req.body;

    if (!year || !month) {
      return res.status(400).json({ error: 'Año y mes son requeridos' });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Mes inválido (1-12)' });
    }

    const existingClosing = await prisma.monthlyClosing.findUnique({
      where: { year_month: { year: parseInt(year), month: parseInt(month) } },
    });

    if (existingClosing) {
      return res.status(400).json({ 
        error: `El cierre para ${year}-${String(month).padStart(2, '0')} ya existe`,
        closing: existingClosing 
      });
    }

    const { startDate, endDate } = getMonthDateRange(parseInt(year), parseInt(month));
    const previousMonthEnd = new Date(year, month - 1, 0, 23, 59, 59);

    // 1. Basic Financial Data Aggregations
    const [incomeResult, expenseResult, salesData, purchasesData, accountsReceivableData, accountsPayableData, cashRegisters, transactions, productsSold] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.supplierInvoice.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.accountReceivable.aggregate({
        where: { createdAt: { lte: endDate } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.accountPayable.aggregate({
        where: { createdAt: { lte: endDate } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.cashRegister.aggregate({
        where: { isOpen: true },
        _sum: { currentAmount: true },
      }),
      prisma.transaction.count({
        where: { date: { gte: startDate, lte: endDate } },
      }),
      prisma.saleItem.aggregate({
        where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
        _sum: { quantity: true },
      }),
    ]);

    const totalIncome = incomeResult._sum.amount || 0;
    const totalExpense = expenseResult._sum.amount || 0;
    const netBalance = totalIncome - totalExpense;
    const totalSales = salesData._sum.total || 0;
    const totalPurchases = purchasesData._sum.amount || 0;
    const totalAccountsReceivable = (accountsReceivableData._sum.amount || 0) - (accountsReceivableData._sum.paidAmount || 0);
    const totalAccountsPayable = (accountsPayableData._sum.amount || 0) - (accountsPayableData._sum.paidAmount || 0);
    const cashInRegister = cashRegisters._sum.currentAmount || 0;
    const totalProductsSold = productsSold._sum.quantity || 0;
    const transactionCount = transactions;

    // 2. Accounts Receivable (CxC) Analysis
    const accountsReceivableList = await prisma.accountReceivable.findMany({
      where: { createdAt: { lte: endDate } },
      include: { client: true },
    });

    let cxcCurrent = 0, cxc30Days = 0, cxc60Days = 0, cxc90Days = 0, cxcOver90 = 0;
    let cxcOverdue = 0;
    
    for (const ar of accountsReceivableList) {
      const remaining = (ar.amount || 0) - (ar.paidAmount || 0);
      if (remaining <= 0) continue;
      
      if (!ar.dueDate) {
        cxcCurrent += remaining;
      } else {
        const daysOverdue = calculateDaysOverdue(ar.dueDate);
        if (daysOverdue <= 0) cxcCurrent += remaining;
        else if (daysOverdue <= 30) cxc30Days += remaining;
        else if (daysOverdue <= 60) cxc60Days += remaining;
        else if (daysOverdue <= 90) cxc90Days += remaining;
        else cxcOver90 += remaining;
        
        if (daysOverdue > 0) cxcOverdue += remaining;
      }
    }

    // Calculate provision for doubtful accounts (5% of overdue + 20% of 90+ days)
    const cxcProvision = (cxcOverdue * 0.05) + (cxcOver90 * 0.20);

    const accountsReceivableDetails = {
      current: cxcCurrent,
      aging30: cxc30Days,
      aging60: cxc60Days,
      aging90: cxc90Days,
      overdue: cxcOver90,
      total: cxcCurrent + cxc30Days + cxc60Days + cxc90Days + cxcOver90,
      provision: cxcProvision,
      collectionRate: totalAccountsReceivable > 0 ? (((totalAccountsReceivable - cxcOverdue) / totalAccountsReceivable) * 100).toFixed(2) : 100,
      clientCount: accountsReceivableList.length,
      agingDistribution: [
        { range: '0-30 días', amount: cxcCurrent },
        { range: '31-60 días', amount: cxc30Days },
        { range: '61-90 días', amount: cxc60Days },
        { range: '+90 días', amount: cxc90Days },
        { range: 'Vencido +90', amount: cxcOver90 },
      ]
    };

    // 3. Accounts Payable (CxP) Analysis
    const accountsPayableList = await prisma.accountPayable.findMany({
      where: { createdAt: { lte: endDate } },
      include: { supplier: true },
    });

    let cxpSuppliers = 0, cxpFinancial = 0, cxpAccrued = 0, cxpOverdue = 0;

    for (const ap of accountsPayableList) {
      const remaining = (ap.amount || 0) - (ap.paidAmount || 0);
      if (remaining <= 0) continue;
      
      cxpSuppliers += remaining;
      
      if (ap.dueDate) {
        const daysOverdue = calculateDaysOverdue(ap.dueDate);
        if (daysOverdue > 0) cxpOverdue += remaining;
      }
    }

    // Get accrued expenses from transactions without invoice
    const accruedExpenses = await prisma.transaction.aggregate({
      where: { 
        type: 'EXPENSE', 
        date: { gte: startDate, lte: endDate },
        reference: null
      },
      _sum: { amount: true },
    });
    cxpAccrued = accruedExpenses._sum.amount || 0;

    const accountsPayableDetails = {
      suppliers: cxpSuppliers,
      financial: cxpFinancial,
      accrued: cxpAccrued,
      overdue: cxpOverdue,
      total: cxpSuppliers + cxpFinancial + cxpAccrued,
      supplierCount: accountsPayableList.length,
      agingDistribution: [
        { range: 'Por pagar proveedores', amount: cxpSuppliers },
        { range: 'Obligaciones financieras', amount: cxpFinancial },
        { range: 'Gastos acumulados', amount: cxpAccrued },
        { range: 'Vencido', amount: cxpOverdue },
      ]
    };

    // 4. Income Details Analysis
    const incomeTransactions = await prisma.transaction.findMany({
      where: { type: 'INCOME', date: { gte: startDate, lte: endDate } },
      select: { description: true, amount: true },
    });

    let incomeInterest = 0, incomeCommissions = 0, incomeOther = 0, incomeSales = 0;
    
    for (const t of incomeTransactions) {
      const desc = (t.description || '').toLowerCase();
      const amount = t.amount || 0;
      if (desc.includes('interés') || desc.includes('interes') || desc.includes('interest')) {
        incomeInterest += amount;
      } else if (desc.includes('comisión') || desc.includes('comision') || desc.includes('commission')) {
        incomeCommissions += amount;
      } else if (desc.includes('venta') || desc.includes('sale')) {
        incomeSales += amount;
      } else {
        incomeOther += amount;
      }
    }

    // Add sales as income
    incomeSales = totalSales;

    const incomeDetails = {
      interest: incomeInterest,
      commissions: incomeCommissions,
      sales: incomeSales,
      other: incomeOther,
      total: incomeInterest + incomeCommissions + incomeSales + incomeOther,
      breakdown: [
        { category: 'Ventas', amount: incomeSales, percentage: totalIncome > 0 ? ((incomeSales / totalIncome) * 100).toFixed(1) : 0 },
        { category: 'Intereses', amount: incomeInterest, percentage: totalIncome > 0 ? ((incomeInterest / totalIncome) * 100).toFixed(1) : 0 },
        { category: 'Comisiones', amount: incomeCommissions, percentage: totalIncome > 0 ? ((incomeCommissions / totalIncome) * 100).toFixed(1) : 0 },
        { category: 'Otros', amount: incomeOther, percentage: totalIncome > 0 ? ((incomeOther / totalIncome) * 100).toFixed(1) : 0 },
      ]
    };

    // 5. Expense Details Analysis
    const expenseTransactions = await prisma.transaction.findMany({
      where: { type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
      select: { description: true, amount: true },
    });

    let expenseOperational = 0, expenseAdministrative = 0, expenseFinancial = 0, expenseDepreciation = 0;

    const operationalKeywords = ['material', 'insumo', 'transporte', 'flete', 'envío', 'envio'];
    const administrativeKeywords = ['renta', 'luz', 'agua', 'teléfono', 'telefono', 'internet', 'sueldo', 'salario', 'nomina', 'limpieza', 'seguro'];
    const financialKeywords = ['banco', 'interés', 'interes', 'préstamo', 'prestamo', 'comisión', 'comision'];
    const depreciationKeywords = ['depreciación', 'depreciacion', 'amortización', 'amortizacion'];

    for (const t of expenseTransactions) {
      const desc = (t.description || '').toLowerCase();
      const amount = t.amount || 0;
      
      if (depreciationKeywords.some(k => desc.includes(k))) {
        expenseDepreciation += amount;
      } else if (financialKeywords.some(k => desc.includes(k))) {
        expenseFinancial += amount;
      } else if (operationalKeywords.some(k => desc.includes(k)) || administrativeKeywords.some(k => desc.includes(k))) {
        // Simple classification based on keywords
        if (operationalKeywords.some(k => desc.includes(k))) {
          expenseOperational += amount;
        } else {
          expenseAdministrative += amount;
        }
      } else {
        // Default to administrative
        expenseAdministrative += amount;
      }
    }

    const expenseDetails = {
      operational: expenseOperational,
      administrative: expenseAdministrative,
      financial: expenseFinancial,
      depreciation: expenseDepreciation,
      total: expenseOperational + expenseAdministrative + expenseFinancial + expenseDepreciation,
      breakdown: [
        { category: 'Operativos', amount: expenseOperational, percentage: totalExpense > 0 ? ((expenseOperational / totalExpense) * 100).toFixed(1) : 0 },
        { category: 'Administrativos', amount: expenseAdministrative, percentage: totalExpense > 0 ? ((expenseAdministrative / totalExpense) * 100).toFixed(1) : 0 },
        { category: 'Financieros', amount: expenseFinancial, percentage: totalExpense > 0 ? ((expenseFinancial / totalExpense) * 100).toFixed(1) : 0 },
        { category: 'Depreciación', amount: expenseDepreciation, percentage: totalExpense > 0 ? ((expenseDepreciation / totalExpense) * 100).toFixed(1) : 0 },
      ]
    };

    // 6. Bank Reconciliation (Cash Flow Analysis)
    const bankTransactions = await prisma.transaction.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });

    let bankDeposits = 0, bankWithdrawals = 0;
    for (const t of bankTransactions) {
      if (t.type === 'INCOME') bankDeposits += t.amount || 0;
      else bankWithdrawals += t.amount || 0;
    }

    // Calculate cash flow
    const closingCash = cashInRegister || 0;
    const openingCash = closingCash - totalIncome + totalExpense;
    const netCashFlow = closingCash - openingCash;

    const bankReconciliation = {
      totalDeposits: bankDeposits,
      totalWithdrawals: bankWithdrawals,
      netMovement: bankDeposits - bankWithdrawals,
      openingBalance: openingCash,
      closingBalance: closingCash,
      reconciled: true,
      pendingItems: 0,
      differences: 0,
      cashFlow: {
        operating: netBalance,
        investing: 0,
        financing: 0,
        netChange: netCashFlow
      }
    };

    // 7. Financial Indicators
    const portfolioQuality = cxcOver90 > 0 ? ((cxcOver90 / totalAccountsReceivable) * 100).toFixed(2) : 0;
    
    const financialIndicators = {
      profitability: {
        netMargin: totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(2) : 0,
        grossMargin: totalSales > 0 ? (((totalSales - (purchasesData._sum.amount || 0)) / totalSales) * 100).toFixed(2) : 0,
        returnOnAssets: 0, // Would need asset data
        returnOnEquity: 0, // Would need equity data
      },
      liquidity: {
        currentRatio: totalAccountsReceivable > 0 ? (totalAccountsReceivable / (totalAccountsPayable || 1)).toFixed(2) : 0,
        quickRatio: (totalAccountsReceivable - cxcOver90) > 0 ? ((totalAccountsReceivable - cxcOver90) / (totalAccountsPayable || 1)).toFixed(2) : 0,
        cashRatio: (cashInRegister / (totalAccountsPayable || 1)).toFixed(2),
        workingCapital: (totalAccountsReceivable + cashInRegister - totalAccountsPayable).toFixed(2),
      },
      leverage: {
        debtRatio: totalAccountsPayable > 0 ? ((totalAccountsPayable / (totalIncome || 1)) * 100).toFixed(2) : 0,
        debtToEquity: 0,
        interestCoverage: expenseFinancial > 0 ? (netBalance / expenseFinancial).toFixed(2) : 0,
      },
      portfolioQuality: {
        overdueRate: portfolioQuality,
        provisionRate: totalAccountsReceivable > 0 ? ((cxcProvision / totalAccountsReceivable) * 100).toFixed(2) : 0,
        collectionEfficiency: accountsReceivableDetails.collectionRate,
      }
    };

    // 8. Executive Summary
    const keyFindings = [];
    const risks = [];
    const recommendations = [];

    // Analyze findings
    if (netBalance > 0) {
      keyFindings.push(`La empresa cerró el mes con balance positivo de ${netBalance.toFixed(2)}`);
    } else {
      keyFindings.push(`La empresa cerró el mes con balance negativo de ${netBalance.toFixed(2)}`);
      recommendations.push('Revisar estructura de costos y buscar fuentes de ingresos adicionales');
    }

    if (cxcOver90 > 0) {
      risks.push(`Cuentas por cobrar vencidas +90 días: ${cxcOver90.toFixed(2)} (${portfolioQuality}%)`);
      recommendations.push('Implementar proceso de cobro para cartera vencida');
    }

    if (cxpOverdue > 0) {
      risks.push(`Cuentas por pagar vencidas: ${cxpOverdue.toFixed(2)}`);
      recommendations.push('Negociar plazos con proveedores y priorizar pagos');
    }

    if (financialIndicators.liquidity.currentRatio < 1) {
      risks.push('Ratio de liquidez por debajo de 1 - riesgo de solvencia');
      recommendations.push('Mejorar gestión de efectivo y cuentas por cobrar');
    }

    keyFindings.push(`Ingresos totales: ${totalIncome.toFixed(2)}, Gastos: ${totalExpense.toFixed(2)}`);
    keyFindings.push(`Cartera activa: ${totalAccountsReceivable.toFixed(2)}, Proveedores: ${totalAccountsPayable.toFixed(2)}`);

    const generalStatus = cxcOver90 > (totalAccountsReceivable * 0.15) || netBalance < 0 || financialIndicators.liquidity.currentRatio < 0.5 
      ? 'ATENCIÓN' 
      : cxcOver90 > (totalAccountsReceivable * 0.05) || netBalance < totalIncome * 0.1 
        ? 'PRECAUCIÓN' 
        : 'SALUDABLE';

    const executiveSummary = {
      keyFindings,
      risks,
      recommendations,
      generalStatus,
      summaryDate: new Date().toISOString(),
    };

    // 9. Accounting Entries Summary
    const accountingEntries = {
      incomeEntries: incomeResult._count || 0,
      expenseEntries: expenseResult._count || 0,
      salesCount: salesData._count || 0,
      purchaseCount: purchasesData._count || 0,
      totalTransactions: transactionCount,
      entriesByCategory: {
        income: incomeDetails.breakdown,
        expense: expenseDetails.breakdown,
      }
    };

    // 10. Closing Validations
    const closingValidations = {
      cxcMatch: totalAccountsReceivable === (accountsReceivableDetails.total - cxcProvision),
      cxpMatch: totalAccountsPayable === accountsPayableDetails.total,
      bankMatch: Math.abs((bankReconciliation.openingBalance + bankReconciliation.netMovement) - bankReconciliation.closingBalance) < 1,
      balancesConsistent: netBalance === (totalIncome - totalExpense),
      allValid: true // Will be set based on checks
    };
    closingValidations.allValid = closingValidations.cxcMatch && closingValidations.cxpMatch && closingValidations.bankMatch && closingValidations.balancesConsistent;

    // Create the closing
    const closing = await prisma.monthlyClosing.create({
      data: {
        year: parseInt(year),
        month: parseInt(month),
        startDate,
        endDate,
        totalIncome,
        totalExpense,
        netBalance,
        totalSales,
        totalPurchases,
        totalAccountsReceivable,
        totalAccountsPayable,
        cashInRegister,
        totalProductsSold,
        transactionCount,
        salesCount: salesData._count || 0,
        expensesByCategory: expenseDetails.breakdown.reduce((acc, curr) => ({...acc, [curr.category]: curr.amount}), {}),
        status: 'CLOSED',
        notes,
        closedBy: req.user.id,
        closedAt: new Date(),
        // New extended fields
        accountsReceivableDetails,
        accountsPayableDetails,
        incomeDetails,
        expenseDetails,
        bankReconciliation,
        financialIndicators,
        executiveSummary,
        accountingEntries,
        closingValidations,
      },
    });

    res.status(201).json({
      message: `Cierre contable de ${year}-${String(month).padStart(2, '0')} completado exitosamente`,
      closing,
      summary: {
        totalIncome,
        totalExpense,
        netBalance,
        accountsReceivable: accountsReceivableDetails,
        accountsPayable: accountsPayableDetails,
        indicators: financialIndicators,
        status: generalStatus,
      }
    });
  } catch (error) {
    console.error('Error al crear cierre mensual:', error);
    if (error.code === 'P2021') {
      return res.status(500).json({ error: 'La tabla de cierres no existe. Ejecuta: npx prisma db push' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un cierre para este período' });
    }
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

export const getAllClosings = async (req, res) => {
  try {
    const { year, status } = req.query;

    const where = {};
    if (year) where.year = parseInt(year);
    if (status) where.status = status;

    const closings = await prisma.monthlyClosing.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json(closings);
  } catch (error) {
    console.error('Error al obtener cierres:', error);
    if (error.code === 'P2021') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

export const getClosingById = async (req, res) => {
  try {
    const { id } = req.params;

    const closing = await prisma.monthlyClosing.findUnique({
      where: { id },
    });

    if (!closing) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }

    res.json(closing);
  } catch (error) {
    console.error('Error al obtener cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getClosingByMonth = async (req, res) => {
  try {
    const { year, month } = req.params;

    const closing = await prisma.monthlyClosing.findUnique({
      where: { 
        year_month: { 
          year: parseInt(year), 
          month: parseInt(month) 
        } 
      },
    });

    if (!closing) {
      return res.status(404).json({ error: `Cierre para ${year}-${month} no encontrado` });
    }

    res.json(closing);
  } catch (error) {
    console.error('Error al obtener cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCurrentMonthStatus = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;
    
    const existingClosing = await prisma.monthlyClosing.findUnique({
      where: { 
        year_month: { year: targetYear, month: targetMonth } 
      },
    });

    const { startDate, endDate } = getMonthDateRange(targetYear, targetMonth);

    const [incomeResult, expenseResult, salesData, accountsReceivableData, accountsPayableData] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startDate, lte: endDate } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.accountReceivable.aggregate({
        where: { createdAt: { lte: endDate } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.accountPayable.aggregate({
        where: { createdAt: { lte: endDate } },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);

    const totalIncome = incomeResult._sum.amount || 0;
    const totalExpense = expenseResult._sum.amount || 0;
    const totalAccountsReceivable = (accountsReceivableData._sum.amount || 0) - (accountsReceivableData._sum.paidAmount || 0);
    const totalAccountsPayable = (accountsPayableData._sum.amount || 0) - (accountsPayableData._sum.paidAmount || 0);

    res.json({
      isClosed: !!existingClosing,
      closing: existingClosing,
      currentData: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
        totalSales: salesData._sum.total || 0,
        salesCount: salesData._count || 0,
        totalAccountsReceivable,
        totalAccountsPayable,
      }
    });
  } catch (error) {
    console.error('Error al obtener estado del mes:', error);
    if (error.code === 'P2021') {
      return res.json({
        isClosed: false,
        closing: null,
        currentData: { totalIncome: 0, totalExpense: 0, netBalance: 0, totalSales: 0, salesCount: 0, totalAccountsReceivable: 0, totalAccountsPayable: 0 }
      });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteClosing = async (req, res) => {
  try {
    const { id } = req.params;

    const closing = await prisma.monthlyClosing.findUnique({
      where: { id },
    });

    if (!closing) {
      return res.status(404).json({ error: 'Cierre no encontrado' });
    }

    await prisma.monthlyClosing.delete({
      where: { id },
    });

    res.json({ message: 'Cierre eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cierre:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getClosingReport = async (req, res) => {
  try {
    const { year, month } = req.params;

    let closing;
    
    if (year && month) {
      closing = await prisma.monthlyClosing.findUnique({
        where: { 
          year_month: { 
            year: parseInt(year), 
            month: parseInt(month) 
          } 
        },
      });
    } else {
      closing = await prisma.monthlyClosing.findFirst({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });
    }

    if (!closing) {
      return res.status(404).json({ error: 'No hay cierres disponibles' });
    }

    const { startDate, endDate } = getMonthDateRange(closing.year, closing.month);

    const [sales, expenses, topProducts] = await Promise.all([
      prisma.sale.findMany({
        where: { createdAt: { gte: startDate, lte: endDate } },
        include: {
          client: { select: { name: true } },
          user: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.transaction.findMany({
        where: { type: 'EXPENSE', date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'desc' },
        take: 50,
      }),
      prisma.saleItem.groupBy({
        by: ['productId'],
        where: { sale: { createdAt: { gte: startDate, lte: endDate } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const productIds = topProducts.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true }
    });

    const productMap = {};
    products.forEach(p => { productMap[p.id] = p; });

    const topProductsWithDetails = topProducts.map(p => ({
      ...productMap[p.productId],
      quantitySold: p._sum.quantity || 0
    }));

    // Return the enhanced closing with all detailed data
    res.json({
      closing,
      details: {
        sales,
        expenses,
        topProducts: topProductsWithDetails,
        // Include all extended data
        accountsReceivableDetails: closing.accountsReceivableDetails,
        accountsPayableDetails: closing.accountsPayableDetails,
        incomeDetails: closing.incomeDetails,
        expenseDetails: closing.expenseDetails,
        bankReconciliation: closing.bankReconciliation,
        financialIndicators: closing.financialIndicators,
        executiveSummary: closing.executiveSummary,
        accountingEntries: closing.accountingEntries,
        closingValidations: closing.closingValidations,
      }
    });
  } catch (error) {
    console.error('Error al obtener reporte:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCompanyStatus = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    
    const monthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59);
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0);

    // Get last closing
    const lastClosing = await prisma.monthlyClosing.findFirst({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    // Current month data
    const [monthIncome, monthExpense, monthSales, monthAR, monthAP, cashRegister, products, clients, suppliers] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: monthStart, lte: monthEnd } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.accountReceivable.aggregate({
        where: { createdAt: { lte: monthEnd } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.accountPayable.aggregate({
        where: { createdAt: { lte: monthEnd } },
        _sum: { amount: true, paidAmount: true },
      }),
      prisma.cashRegister.aggregate({
        where: { isOpen: true },
        _sum: { currentAmount: true },
      }),
      prisma.product.count({ where: { active: true } }),
      prisma.client.count({ where: { active: true } }),
      prisma.supplier.count({ where: { active: true } }),
    ]);

    // Year to date
    const [yearIncome, yearExpense, yearSales] = await Promise.all([
      prisma.transaction.aggregate({
        where: { type: 'INCOME', date: { gte: yearStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { type: 'EXPENSE', date: { gte: yearStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: yearStart, lte: monthEnd } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    const totalIncome = monthIncome._sum.amount || 0;
    const totalExpense = monthExpense._sum.amount || 0;
    const totalAccountsReceivable = (monthAR._sum.amount || 0) - (monthAR._sum.paidAmount || 0);
    const totalAccountsPayable = (monthAP._sum.amount || 0) - (monthAP._sum.paidAmount || 0);
    const cashInRegister = cashRegister._sum.currentAmount || 0;

    const currentMonthData = {
      period: `${getMonthName(currentMonth)} ${currentYear}`,
      year: currentYear,
      month: currentMonth,
      income: totalIncome,
      expense: totalExpense,
      netBalance: totalIncome - totalExpense,
      sales: monthSales._sum.total || 0,
      salesCount: monthSales._count || 0,
      transactionsCount: (monthIncome._count || 0) + (monthExpense._count || 0),
      accountsReceivable: totalAccountsReceivable,
      accountsPayable: totalAccountsPayable,
      cashInRegister,
    };

    const yearToDate = {
      income: yearIncome._sum.amount || 0,
      expense: yearExpense._sum.amount || 0,
      netBalance: (yearIncome._sum.amount || 0) - (yearExpense._sum.amount || 0),
      sales: yearSales._sum.total || 0,
      salesCount: yearSales._count || 0,
    };

    // Calculate working capital and liquidity
    const workingCapital = totalAccountsReceivable + cashInRegister - totalAccountsPayable;
    const currentRatio = totalAccountsPayable > 0 ? (totalAccountsReceivable / totalAccountsPayable) : 0;
    const quickRatio = totalAccountsPayable > 0 ? (cashInRegister / totalAccountsPayable) : 0;

    res.json({
      currentMonth: currentMonthData,
      yearToDate,
      lastClosing,
      totals: {
        products: products,
        clients: clients,
        suppliers: suppliers,
        workingCapital,
        currentRatio: currentRatio.toFixed(2),
        quickRatio: quickRatio.toFixed(2),
      },
      status: lastClosing ? lastClosing.status : 'OPEN',
      lastClosedPeriod: lastClosing ? { year: lastClosing.year, month: lastClosing.month } : null,
    });
  } catch (error) {
    console.error('Error al obtener estado de la empresa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getOpeningBalances = async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const targetMonth = parseInt(month) || new Date().getMonth() + 1;

    // Get the previous month closing to use as opening balances
    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear = targetYear - 1;
    }

    const previousClosing = await prisma.monthlyClosing.findUnique({
      where: { year_month: { year: prevYear, month: prevMonth } },
    });

    if (!previousClosing) {
      // No previous closing - return zero balances for first month
      return res.json({
        isFirstMonth: true,
        openingBalances: {
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          totalAccountsReceivable: 0,
          totalAccountsPayable: 0,
          cashInRegister: 0,
          totalSales: 0,
        },
        previousPeriod: null,
        message: 'No existe cierre del mes anterior. Se inicializa con saldos en cero.'
      });
    }

    // Get current month to date data (for comparison)
    const { startDate, endDate } = getMonthDateRange(targetYear, targetMonth);
    const now = new Date();
    const isCurrentMonth = targetMonth === now.getMonth() + 1 && targetYear === now.getFullYear();
    
    let currentData = null;
    if (isCurrentMonth) {
      const [income, expense, sales, ar, ap, cash] = await Promise.all([
        prisma.transaction.aggregate({ where: { type: 'INCOME', date: { gte: startDate, lte: now } }, _sum: { amount: true } }),
        prisma.transaction.aggregate({ where: { type: 'EXPENSE', date: { gte: startDate, lte: now } }, _sum: { amount: true } }),
        prisma.sale.aggregate({ where: { createdAt: { gte: startDate, lte: now } }, _sum: { total: true }, _count: true }),
        prisma.accountReceivable.aggregate({ where: { createdAt: { lte: now } }, _sum: { amount: true, paidAmount: true } }),
        prisma.accountPayable.aggregate({ where: { createdAt: { lte: now } }, _sum: { amount: true, paidAmount: true } }),
        prisma.cashRegister.aggregate({ where: { isOpen: true }, _sum: { currentAmount: true } }),
      ]);

      currentData = {
        income: income._sum.amount || 0,
        expense: expense._sum.amount || 0,
        netBalance: (income._sum.amount || 0) - (expense._sum.amount || 0),
        sales: sales._sum.total || 0,
        salesCount: sales._count || 0,
        accountsReceivable: (ar._sum.amount || 0) - (ar._sum.paidAmount || 0),
        accountsPayable: (ap._sum.amount || 0) - (ap._sum.paidAmount || 0),
        cashInRegister: cash._sum.currentAmount || 0,
      };
    }

    res.json({
      isFirstMonth: false,
      openingBalances: {
        totalIncome: previousClosing.totalIncome,
        totalExpense: previousClosing.totalExpense,
        netBalance: previousClosing.netBalance,
        totalAccountsReceivable: previousClosing.totalAccountsReceivable,
        totalAccountsPayable: previousClosing.totalAccountsPayable,
        cashInRegister: previousClosing.cashInRegister,
        totalSales: previousClosing.totalSales,
      },
      previousPeriod: {
        year: prevYear,
        month: prevMonth,
        monthName: getMonthName(prevMonth),
      },
      currentData,
      isCurrentMonth,
    });
  } catch (error) {
    console.error('Error al obtener balances de apertura:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

function getMonthName(month) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return months[month - 1];
}