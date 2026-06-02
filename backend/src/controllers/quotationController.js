import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { generateInvoiceNumber } from '../utils/invoice.js';
import { saveToHistory } from './saleController.js';
import { logger } from '../utils/logger.js';

const recordSaleInCashRegister = async (tx, saleData, userId, paymentMethod) => {
  try {
    let openRegister = await tx.cashRegister.findFirst({
      where: { openedBy: userId, isOpen: true }
    });

    if (!openRegister) {
      openRegister = await tx.cashRegister.findFirst({
        where: { isOpen: true }
      });
    }

    if (!openRegister) return null;

    await tx.cashTransaction.create({
      data: {
        type: 'INCOME',
        amount: saleData.paidAmount,
        description: `Venta desde Cotización #${saleData.reference} [${paymentMethod}]`,
        reference: saleData.invoiceNumber,
        cashRegisterId: openRegister.id,
        userId: userId
      }
    });

    // Solo el EFECTIVO (CASH) o el abono inicial a crédito (CREDIT) alteran el monto FÍSICO de la caja
    if (paymentMethod === 'CASH' || paymentMethod === 'CREDIT') {
      await tx.cashRegister.update({
        where: { id: openRegister.id },
        data: { currentAmount: { increment: saleData.paidAmount } }
      });
    }

    return openRegister.id;
  } catch (error) {
    logger.error('Error recording sale in register:', { error });
    return null;
  }
};

const upsertCostAnalysis = async (tx, { productId, categoryName, quantity, revenue, costAmount }) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const existing = await tx.costAnalysis.findFirst({
    where: { productId, period }
  });

  if (existing) {
    await tx.costAnalysis.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + quantity,
        revenue: existing.revenue + revenue,
        costAmount: existing.costAmount + costAmount,
        periodYear: year,
        periodMonth: month,
        category: categoryName || existing.category,
      }
    });
  } else {
    await tx.costAnalysis.create({
      data: {
        productId,
        category: categoryName,
        period,
        periodYear: year,
        periodMonth: month,
        quantity,
        revenue,
        costAmount,
      }
    });
  }
};

const generateQuotationNumber = async () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  
  const prefix = `COT-${year}${month}${day}-`;
  
  const lastQuotation = await prisma.quotation.findFirst({
    where: {
      quotationNumber: {
        startsWith: prefix,
      },
    },
    orderBy: { quotationNumber: 'desc' },
    select: { quotationNumber: true },
  });

  let sequence = 1;
  if (lastQuotation) {
    const lastSequence = parseInt(lastQuotation.quotationNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

export const getAllQuotations = async (req, res) => {
  try {
    const { startDate, endDate, clientId, status, search } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (search) {
      where.OR = [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        include: {
          client: true,
          user: {
            select: { id: true, name: true, username: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    res.json({
      data: quotations,
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
    logger.error('Error al obtener cotizaciones:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, username: true },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    res.json(quotation);
  } catch (error) {
    logger.error('Error al obtener cotización:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createQuotation = async (req, res) => {
  try {
    const { 
      clientId, 
      notes, 
      validityDays = 30, 
      items,
      clientName,
      clientRnc,
      clientPhone,
      clientAddress,
      clientEmail,
      paymentMethod,
      deliveryTime,
      warranty,
      shippingCost = 0
    } = req.body;

    const quotationNumber = await generateQuotationNumber();

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.tax * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + totalTax - totalDiscount + shippingCost;

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        subtotal,
        tax: totalTax,
        discount: totalDiscount,
        shippingCost,
        total,
        notes,
        validityDays,
        clientId,
        userId: req.user.id,
        clientName,
        clientRnc,
        clientPhone,
        clientAddress,
        clientEmail,
        paymentMethod,
        deliveryTime,
        warranty,
        items: {
          create: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            tax: item.tax,
            discount: item.discount || 0,
            total: (item.price * item.quantity) + (item.tax * item.quantity) - (item.discount || 0),
          })),
        },
      },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, username: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    res.status(201).json({ 
      message: 'Cotización creada exitosamente',
      quotation 
    });
  } catch (error) {
    logger.error('Error al crear cotización:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      clientId, 
      notes, 
      validityDays, 
      status, 
      items,
      clientName,
      clientRnc,
      clientPhone,
      clientAddress,
      clientEmail,
      paymentMethod,
      deliveryTime,
      warranty,
      shippingCost
    } = req.body;

    const existingQuotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingQuotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    let subtotal, totalTax, totalDiscount, total;
    let quotation;

    if (items) {
      subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      totalTax = items.reduce((sum, item) => sum + (item.tax * item.quantity), 0);
      totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
      total = subtotal + totalTax - totalDiscount + (shippingCost ?? existingQuotation.shippingCost);

      quotation = await prisma.$transaction(async (tx) => {
        await tx.quotationItem.deleteMany({
          where: { quotationId: id },
        });

        await tx.quotationItem.createMany({
          data: items.map(item => ({
            quotationId: id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
            tax: item.tax,
            discount: item.discount || 0,
            total: (item.price * item.quantity) + (item.tax * item.quantity) - (item.discount || 0),
          })),
        });

        return tx.quotation.update({
          where: { id },
          data: {
            clientId,
            notes,
            validityDays,
            status,
            subtotal,
            tax: totalTax,
            discount: totalDiscount,
            shippingCost: shippingCost ?? existingQuotation.shippingCost,
            total,
            clientName,
            clientRnc,
            clientPhone,
            clientAddress,
            clientEmail,
            paymentMethod,
            deliveryTime,
            warranty,
          },
        });
      });
    } else {
      quotation = await prisma.quotation.update({
        where: { id },
        data: {
          clientId,
          notes,
          validityDays,
          status,
          clientName,
          clientRnc,
          clientPhone,
          clientAddress,
          clientEmail,
          paymentMethod,
          deliveryTime,
          warranty,
          ...(shippingCost !== undefined && { shippingCost }),
        },
      });
    }

    quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        client: true,
        user: {
          select: { id: true, name: true, username: true },
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
      },
    });

    res.json({ 
      message: 'Cotización actualizada exitosamente',
      quotation 
    });
  } catch (error) {
    logger.error('Error al actualizar cotización:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    await prisma.quotation.delete({
      where: { id },
    });

    res.json({ message: 'Cotización eliminada exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar cotización:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const convertToSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paidAmount = 0, dueDate } = req.body;

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!quotation) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    if (quotation.status === 'CONVERTED') {
      return res.status(400).json({ error: 'Esta cotización ya fue convertida a venta' });
    }

    // Verificar si hay una caja abierta
    const openRegister = await prisma.cashRegister.findFirst({
      where: { isOpen: true }
    });

    if (!openRegister) {
      return res.status(400).json({ error: 'Debes tener una CAJA ABIERTA para poder convertir una cotización en venta.' });
    }

    const invoiceNumber = await generateInvoiceNumber();

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          subtotal: quotation.subtotal,
          tax: quotation.tax,
          discount: quotation.discount,
          shippingCost: quotation.shippingCost,
          total: quotation.total,
          paidAmount: paymentMethod === 'CREDIT' ? Math.min(paidAmount, quotation.total) : quotation.total,
          change: paymentMethod === 'CASH' ? Math.max(0, paidAmount - quotation.total) : 0,
          paymentMethod,
          dueDate: paymentMethod === 'CREDIT' ? (dueDate ? new Date(dueDate) : null) : null,
          clientId: quotation.clientId,
          userId: req.user.id,
          status: paymentMethod === 'CREDIT' ? 'PENDING' : 'COMPLETED',
          items: {
            create: quotation.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              tax: item.tax,
              discount: item.discount,
              total: item.total,
            })),
          },
        },
      });

      // Registrar en el historial de transacciones
      await saveToHistory(tx, {
        type: paymentMethod === 'CREDIT' ? 'VENTA_CREDITO' : 'SALE',
        description: paymentMethod === 'CREDIT' 
          ? `Venta a crédito #${invoiceNumber} (desde Cotización #${quotation.quotationNumber})` 
          : `Venta #${invoiceNumber} (${paymentMethod}) [desde Cotización #${quotation.quotationNumber}]`,
        amount: quotation.total,
        categoryName: 'Ventas',
        reference: invoiceNumber,
        clientName: quotation.clientName || quotation.client?.name || 'Cliente Final',
        userName: req.user.name || req.user.username,
        details: {
          quotationId: quotation.id,
          paymentMethod: paymentMethod,
          receivedAmount: paidAmount,
          paidAmount: paymentMethod === 'CREDIT' ? Math.min(paidAmount, quotation.total) : quotation.total
        }
      });

      for (const item of quotation.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });

        if (!product || product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para: ${product?.name || 'producto desconocido'}. Stock actual: ${product?.stock || 0}, requerido: ${item.quantity}`);
        }
      }

      for (const item of quotation.items) {
        const product = await tx.product.findUnique({ 
          where: { id: item.productId },
          include: { category: true }
        });
        
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: product.stock - item.quantity,
            reference: invoiceNumber,
            description: `Salida por Conversión de Cotización`,
            userId: req.user.id
          }
        });

        // Actualizar CostAnalysis mensual para cada producto
        const lineCost = (product?.cost || 0) * item.quantity;
        const lineRevenue = item.total;
        
        await upsertCostAnalysis(tx, {
          productId: item.productId,
          categoryName: product?.category?.name || null,
          quantity: item.quantity,
          revenue: lineRevenue,
          costAmount: lineCost,
        });
      }

      if (quotation.clientId && paymentMethod === 'CREDIT') {
        const pendingAmount = quotation.total - paidAmount;

        if (pendingAmount > 0) {
          await tx.client.update({
            where: { id: quotation.clientId },
            data: {
              balance: { increment: pendingAmount },
            },
          });
        }
      }

      if (paymentMethod !== 'CREDIT') {
        const actualIncome = quotation.total;
        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: actualIncome,
            description: `Venta desde cotización #${quotation.quotationNumber}`,
            reference: invoiceNumber,
            userId: req.user.id,
          },
        });

        const registerId = await recordSaleInCashRegister(tx, {
          paidAmount: actualIncome,
          invoiceNumber,
          reference: quotation.quotationNumber
        }, req.user.id, paymentMethod);

        if (registerId) {
          await tx.sale.update({
            where: { id: newSale.id },
            data: { cashRegisterId: registerId }
          });
        }
      } else if (paidAmount > 0) {
        // Inicial payment for credit sale
        const initialPayment = Math.min(paidAmount, quotation.total);
        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: initialPayment,
            description: `Abono inicial Venta (Cotización #${quotation.quotationNumber})`,
            reference: invoiceNumber,
            userId: req.user.id,
          },
        });

        const registerId = await recordSaleInCashRegister(tx, {
          paidAmount: initialPayment,
          invoiceNumber,
          reference: quotation.quotationNumber
        }, req.user.id, paymentMethod);

        if (registerId) {
          await tx.sale.update({
            where: { id: newSale.id },
            data: { cashRegisterId: registerId }
          });
        }
      }

      await tx.quotation.update({
        where: { id },
        data: { status: 'CONVERTED' },
      });

      return newSale;
    });

    res.status(201).json({ 
      message: 'Cotización convertida a venta exitosamente',
      sale 
    });
  } catch (error) {
    logger.error('Error al convertir cotización:', { error });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


