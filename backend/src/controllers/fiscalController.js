import prisma from '../config/database.js';
import { logger } from '../utils/logger.js';

const NCF_TYPES = {
  '01': 'Crédito Fiscal',
  '02': 'Consumo',
  '03': 'Débito',
  '04': 'Gastos Menores',
  '11': 'Regímenes Especiales',
  '14': 'Gubernamental',
  '15': 'Gastos del Exterior',
};

export const getSequences = async (req, res) => {
  try {
    const sequences = await prisma.fiscalSequence.findMany({
      where: { active: true },
      orderBy: { type: 'asc' }
    });
    res.json(sequences);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener secuencias' });
  }
};

export const updateSequence = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const sequence = await prisma.fiscalSequence.update({
      where: { id },
      data
    });
    res.json(sequence);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar secuencia' });
  }
};

export const createSequence = async (req, res) => {
  try {
    const data = req.body;
    const sequence = await prisma.fiscalSequence.create({
      data
    });
    res.status(201).json(sequence);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear secuencia' });
  }
};

export const deleteSequence = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.fiscalSequence.delete({ where: { id } });
    res.json({ message: 'Secuencia eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar secuencia' });
  }
};

export const getFiscalStatus = async (req, res) => {
  try {
    const sequences = await prisma.fiscalSequence.findMany({
      orderBy: { type: 'asc' },
    });

    const status = sequences.map(s => {
      const usagePercent = s.limit > 0 ? Math.round((s.current / s.limit) * 100) : 0;
      const remaining = Math.max(0, s.limit - s.current);
      return {
        id: s.id,
        type: s.type,
        name: NCF_TYPES[s.type] || s.name,
        prefix: s.prefix,
        current: s.current,
        limit: s.limit,
        remaining,
        usagePercent,
        active: s.active,
        alert: remaining < 100 ? 'CRITICAL' : remaining < 500 ? 'WARNING' : 'OK',
      };
    });

    const salesWithNCF = await prisma.sale.count({
      where: { ncf: { not: null } },
    });

    const salesWithoutNCF = await prisma.sale.count({
      where: { ncf: null, status: { not: 'CANCELLED' } },
    });

    const settings = await prisma.settings.findFirst();

    res.json({
      sequences: status,
      fiscalEnabled: settings?.fiscalEnabled || false,
      defaultNcfType: settings?.defaultNcfType || '02',
      salesWithNCF,
      salesWithoutNCF,
    });
  } catch (error) {
    logger.error('Error al obtener estado fiscal:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSalesFiscalReport = async (req, res) => {
  try {
    const { startDate, endDate, ncfType } = req.query;

    const where = {
      status: { not: 'CANCELLED' },
      ncf: { not: null },
    };

    if (startDate) {
      where.createdAt = { gte: new Date(startDate + 'T00:00:00') };
    }
    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate + 'T23:59:59') };
    }
    if (ncfType) {
      where.ncfType = ncfType;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        client: { select: { name: true, rnc: true } },
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const groupedByType = {};
    for (const sale of sales) {
      const type = sale.ncfType || '02';
      if (!groupedByType[type]) {
        groupedByType[type] = {
          ncfType: type,
          ncfTypeName: NCF_TYPES[type] || 'Consumo',
          count: 0,
          totalExempt: 0,
          totalTaxable: 0,
          totalItbis: 0,
          totalAmount: 0,
          sales: [],
        };
      }
      const taxable = sale.subtotal;
      const itbis = sale.tax;
      groupedByType[type].count++;
      groupedByType[type].totalExempt += 0;
      groupedByType[type].totalTaxable += taxable;
      groupedByType[type].totalItbis += itbis;
      groupedByType[type].totalAmount += sale.total;
      groupedByType[type].sales.push({
        ncf: sale.ncf,
        invoiceNumber: sale.invoiceNumber,
        date: sale.createdAt,
        clientName: sale.client?.name || 'Consumidor Final',
        clientRnc: sale.client?.rnc || '000000000',
        total: sale.total,
        itbis: sale.itbis || sale.tax,
      });
    }

    const totals = sales.reduce((acc, s) => {
      acc.count++;
      acc.totalAmount += s.total;
      acc.totalItbis += s.tax;
      return acc;
    }, { count: 0, totalAmount: 0, totalItbis: 0 });

    res.json({
      period: { startDate, endDate },
      totals,
      byType: Object.values(groupedByType),
      salesCount: sales.length,
    });
  } catch (error) {
    logger.error('Error al generar reporte fiscal de ventas:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getPurchasesFiscalReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = { paid: true };
    if (startDate) {
      where.paidDate = { gte: new Date(startDate + 'T00:00:00') };
    }
    if (endDate) {
      where.paidDate = { ...where.paidDate, lte: new Date(endDate + 'T23:59:59') };
    }

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: { select: { name: true, rnc: true } },
      },
      orderBy: { paidDate: 'asc' },
    });

    const groupedByRnc = {};
    for (const inv of invoices) {
      const rnc = inv.supplier?.rnc || '000000000';
      if (!groupedByRnc[rnc]) {
        groupedByRnc[rnc] = {
          supplierRnc: rnc,
          supplierName: inv.supplier?.name || 'Proveedor',
          count: 0,
          totalAmount: 0,
          invoices: [],
        };
      }
      groupedByRnc[rnc].count++;
      groupedByRnc[rnc].totalAmount += inv.amount;
      groupedByRnc[rnc].invoices.push({
        invoiceNumber: inv.invoiceNumber,
        date: inv.paidDate,
        amount: inv.amount,
      });
    }

    const totals = invoices.reduce((acc, inv) => {
      acc.count++;
      acc.totalAmount += inv.amount;
      return acc;
    }, { count: 0, totalAmount: 0 });

    res.json({
      period: { startDate, endDate },
      totals,
      bySupplier: Object.values(groupedByRnc),
    });
  } catch (error) {
    logger.error('Error al generar reporte fiscal de compras:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
