import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { generateInvoiceNumber } from '../utils/invoice.js';
import bcrypt from 'bcryptjs';

const findOpenRegister = async (db, userId) => {
  let register = await db.cashRegister.findFirst({
    where: { openedBy: userId, isOpen: true }
  });
  if (!register) {
    register = await db.cashRegister.findFirst({
      where: { isOpen: true }
    });
  }
  return register;
};

export const saveToHistory = async (tx, { type, description, amount, categoryName, reference, clientName, supplierName, userName, details }) => {
  await tx.transactionHistory.create({
    data: {
      type,
      description,
      amount,
      categoryName,
      reference,
      clientName,
      supplierName,
      userName,
      details: details || {}
    }
  });
};

const recordSaleInCashRegister = async (tx, saleData, userId) => {
  try {
    const openRegister = await findOpenRegister(tx, userId);

    if (!openRegister) {
      return null;
    }

    const newAmount = openRegister.currentAmount + saleData.paidAmount;

    await tx.cashTransaction.create({
      data: {
        type: 'INCOME',
        amount: saleData.paidAmount,
        description: `Venta #${saleData.invoiceNumber}`,
        reference: saleData.invoiceNumber,
        cashRegisterId: openRegister.id,
        userId: userId
      }
    });

    await tx.cashRegister.update({
      where: { id: openRegister.id },
      data: { currentAmount: newAmount }
    });

    return { registerId: openRegister.id, amountAdded: saleData.paidAmount, registerName: openRegister.name };
  } catch (error) {
    console.error('Error recording sale in cash register:', error);
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

const generateNCF = async (type) => {
  if (!type) return null;

  return await prisma.$transaction(async (tx) => {
    const [sequence] = await tx.$queryRawUnsafe(
      'SELECT * FROM fiscal_sequences WHERE type = $1 FOR UPDATE',
      type
    );

    if (!sequence || !sequence.active) {
      throw new Error(`Secuencia fiscal tipo ${type} no configurada o inactiva`);
    }

    if (sequence.current > sequence.limit) {
      throw new Error(`Secuencia fiscal tipo ${type} agotada. Favor renovar en DGII.`);
    }

    const ncf = `${sequence.prefix}${sequence.type}${String(sequence.current).padStart(8, '0')}`;
    
    await tx.fiscalSequence.update({
      where: { id: sequence.id },
      data: { current: sequence.current + 1 }
    });

    return ncf;
  });
};

export const getAllSales = async (req, res) => {
  try {
    const { startDate, endDate, clientId, status, invoiceNumber, paymentMethod } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        // Normalizar a inicio del día en UTC para consistencia
        const sDate = new Date(startDate);
        sDate.setUTCHours(0, 0, 0, 0);
        where.createdAt.gte = sDate;
      }
      if (endDate) {
        // Normalizar a fin del día en UTC
        const eDate = new Date(endDate);
        eDate.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = eDate;
      }
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    }

    if (invoiceNumber) {
      // Búsqueda inteligente: Por número de factura O nombre de cliente
      where.OR = [
        { invoiceNumber: { contains: invoiceNumber, mode: 'insensitive' } },
        { client: { name: { contains: invoiceNumber, mode: 'insensitive' } } }
      ];
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: {
            select: { id: true, name: true },
          },
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
      prisma.sale.count({ where }),
    ]);

    res.json({
      data: sales,
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
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
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

    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    res.json(sale);
  } catch (error) {
    console.error('Error al obtener venta:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createSale = async (req, res) => {
  try {
    const { clientId, paymentMethod, paidAmount, discount = 0, shippingCost = 0, items, dueDate, ncfType, hasWarranty, warrantyData } = req.body;

    let ncf = null;
    if (ncfType) {
      // Si el tipo es Crédito Fiscal (01), validar que el cliente tenga RNC
      if (ncfType === '01') {
        if (!clientId) {
          return res.status(400).json({ error: 'Para Crédito Fiscal debe seleccionar un cliente' });
        }
        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client || !client.rnc) {
          return res.status(400).json({ error: 'El cliente seleccionado no tiene un RNC válido para Crédito Fiscal' });
        }
      }
      ncf = await generateNCF(ncfType);
    }

    if (paymentMethod === 'CREDIT') {
      if (!dueDate) {
        return res.status(400).json({ 
          error: 'Para ventas a crédito debe especificar la fecha de pago' 
        });
      }

      const selectedDate = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      
      if (isNaN(selectedDate.getTime())) {
        return res.status(400).json({ 
          error: 'Fecha de pago inválida' 
        });
      }
      
      if (selectedDate < today) {
        return res.status(400).json({ 
          error: 'La fecha de pago no puede ser menor a hoy' 
        });
      }
      
      if (selectedDate > maxDate) {
        return res.status(400).json({ 
          error: 'La fecha de pago no puede ser mayor a 30 días' 
        });
      }
    }

    const invoiceNumber = await generateInvoiceNumber();

    // VALIDACIÓN DE CAJA ABIERTA (Obligatoria para todas las ventas)
    const openRegister = await findOpenRegister(prisma, req.user.id);

    if (!openRegister) {
      return res.status(400).json({ 
        error: 'No hay cajas abiertas disponibles',
        requiresCashRegister: true,
        message: 'No hay cajas abiertas. Por favor, abre una caja desde el módulo de Cajas antes de realizar cualquier venta.'
      });
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalTax = items.reduce((sum, item) => sum + (item.tax * item.quantity), 0);
    const totalDiscount = items.reduce((sum, item) => sum + (item.discount || 0), 0);
    const total = subtotal + totalTax - totalDiscount - discount + shippingCost;

    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map(item => item.productId) },
      },
      include: {
        category: { select: { name: true } },
      },
    });

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ 
          error: `Producto no encontrado: ${item.productId}` 
        });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Stock insuficiente para: ${product.name}. Stock actual: ${product.stock}` 
        });
      }
    }

    const sale = await prisma.$transaction(async (tx) => {
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          subtotal,
          tax: totalTax,
          discount,
          shippingCost,
          total,
          paidAmount: paymentMethod === 'CREDIT' ? Math.min(paidAmount, total) : total,
          change: paymentMethod === 'CASH' ? Math.max(0, paidAmount - total) : 0,
          paymentMethod,
          dueDate: dueDate ? new Date(dueDate) : null,
          clientId,
          userId: req.user.id,
          status: paymentMethod === 'CREDIT' ? 'PENDING' : 'COMPLETED',
          ncf,
          ncfType,
          hasWarranty: hasWarranty || false,
          warrantyData: warrantyData || undefined,
          items: {
            create: items.map(item => {
              const prod = products.find(p => p.id === item.productId);
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: item.price,
                cost: prod?.cost || 0,
                tax: item.tax,
                discount: item.discount || 0,
                total: (item.price * item.quantity) + (item.tax * item.quantity) - (item.discount || 0),
              };
            }),
          },
        },
        include: {
          client: {
            select: { id: true, name: true, balance: true },
          },
          user: {
            select: { id: true, name: true, username: true },
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, stock: true },
              },
            },
          },
        },
      });

      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto no encontrado: ${item.productId}`);
        }
        if (product.stock < item.quantity) {
          throw new Error(`Stock insuficiente para: ${product.name}. Stock actual: ${product.stock}, requerido: ${item.quantity}`);
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'OUT',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: product.stock - item.quantity,
            reference: invoiceNumber,
            description: `Salida por Venta`,
            userId: req.user.id,
          },
        });
      }

      // Actualizar CostAnalysis mensual para cada producto
      for (const item of items) {
        const prod = products.find(p => p.id === item.productId);
        const lineCost = (prod?.cost || 0) * item.quantity;
        const lineRevenue = (item.price * item.quantity) + (item.tax * item.quantity) - (item.discount || 0);
        await upsertCostAnalysis(tx, {
          productId: item.productId,
          categoryName: prod?.category?.name || null,
          quantity: item.quantity,
          revenue: lineRevenue,
          costAmount: lineCost,
        });
      }

      if (clientId && paymentMethod === 'CREDIT') {
        const pendingAmount = total - paidAmount;

        if (pendingAmount > 0) {
          await tx.client.update({
            where: { id: clientId },
            data: {
              balance: { increment: pendingAmount },
            },
          });
        }
      }

      // REGISTRO DE FLUJO DE DINERO (CAJA Y TRANSACCIONES)
      if (paidAmount > 0) {
        const openRegister = await findOpenRegister(tx, req.user.id);

        const incomeAmount = paymentMethod === 'CREDIT' ? Math.min(paidAmount, total) : total;

        // 1. Registro en el Historial General y Contabilidad
        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: incomeAmount,
            description: paymentMethod === 'CREDIT' 
              ? `Abono inicial Venta a crédito #${invoiceNumber}` 
              : `Venta #${invoiceNumber} (${paymentMethod})`,
            reference: invoiceNumber,
            userId: req.user.id,
          },
        });

        await saveToHistory(tx, {
          type: paymentMethod === 'CREDIT' ? 'VENTA_CREDITO' : 'SALE',
          description: paymentMethod === 'CREDIT' 
            ? `Venta a crédito #${invoiceNumber}` 
            : `Venta #${invoiceNumber} (${paymentMethod})`,
          amount: total,
          categoryName: 'Ventas',
          reference: invoiceNumber,
          clientName: clientId ? (await tx.client.findUnique({ where: { id: clientId } }))?.name : null,
          userName: req.user.name || req.user.username,
          details: { 
            paymentMethod, 
            receivedAmount: paidAmount, 
            paidAmount: incomeAmount,
            change: paymentMethod === 'CASH' ? Math.max(0, paidAmount - total) : 0,
            ncf,
            ncfType
          }
        });

        // 2. Registro en el turno de Caja activo (si existe)
        if (openRegister) {
          await tx.cashTransaction.create({
            data: {
              type: 'INCOME',
              amount: incomeAmount,
              description: `Venta #${invoiceNumber} [${paymentMethod}]`,
              reference: invoiceNumber,
              cashRegisterId: openRegister.id,
              userId: req.user.id
            }
          });

          // Solo el EFECTIVO (CASH) o el abono inicial a crédito (que asumimos efectivo) alteran el monto FÍSICO de la caja
          if (paymentMethod === 'CASH' || paymentMethod === 'CREDIT') {
            await tx.cashRegister.update({
              where: { id: openRegister.id },
              data: { currentAmount: { increment: incomeAmount } }
            });
          }

          await tx.sale.update({
            where: { id: newSale.id },
            data: { cashRegisterId: openRegister.id }
          });

          newSale.cashRegisterInfo = { 
            registerId: openRegister.id, 
            amountAdded: incomeAmount, 
            registerName: openRegister.name 
          };
        }
      }

      // Actualizar estado final de la venta
      await tx.sale.update({
        where: { id: newSale.id },
        data: {
          status: paymentMethod === 'CREDIT' 
            ? (paidAmount >= total ? 'COMPLETED' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING')) 
            : 'COMPLETED'
        }
      });

      return newSale;
    });

    res.status(201).json({ 
      message: 'Venta creada exitosamente',
      sale 
    });
  } catch (error) {
    console.error('Error al crear venta:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV !== 'production' ? error.message : undefined,
      code: error.code
    });
  }
};

export const cancelSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorizerUsername, authorizerPassword } = req.body;

    if (!authorizerUsername || !authorizerPassword) {
      return res.status(403).json({ error: 'Se requieren credenciales de supervisor para anular una venta' });
    }

    // Verificar credenciales del autorizador
    const authorizer = await prisma.user.findFirst({
      where: { 
        username: authorizerUsername.toLowerCase(), 
        active: true, 
        role: { in: ['ADMIN', 'MANAGER'] } 
      }
    });

    if (!authorizer) {
      return res.status(403).json({ error: 'Usuario autorizador no encontrado o no tiene permisos de supervisor' });
    }

    const isPasswordValid = await bcrypt.compare(authorizerPassword, authorizer.password);
    if (!isPasswordValid) {
      return res.status(403).json({ error: 'Contraseña de supervisor incorrecta' });
    }

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    if (sale.status === 'CANCELLED') {
      return res.status(400).json({ error: 'La venta ya está cancelada' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Devolver stock e historial de inventario
      const productIds = sale.items.map(i => i.productId);
      const cancelProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });
      const cancelProductMap = {};
      for (const p of cancelProducts) {
        cancelProductMap[p.id] = p;
      }

      for (const item of sale.items) {
        const product = cancelProductMap[item.productId];
        if (!product) continue;

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            previousStock: product.stock,
            newStock: product.stock + item.quantity,
            reference: sale.invoiceNumber,
            description: `Devolución por Anulación de Venta`,
            userId: req.user.id
          }
        });
      }

      // 2. Reversar CostAnalysis mensual
      const saleDate = new Date(sale.saleDate || sale.createdAt);
      const saleYear = saleDate.getFullYear();
      const saleMonth = saleDate.getMonth() + 1;
      const salePeriod = `${saleYear}-${String(saleMonth).padStart(2, '0')}`;

      for (const item of sale.items) {
        const itemCost = (item.cost || 0) * item.quantity;
        const itemRevenue = item.total;

        const existing = await tx.costAnalysis.findFirst({
          where: { productId: item.productId, period: salePeriod }
        });

        if (existing) {
          const newQty = Math.max(0, existing.quantity - item.quantity);
          const newRev = Math.max(0, existing.revenue - itemRevenue);
          const newCost = Math.max(0, existing.costAmount - itemCost);

          if (newQty === 0 && newRev === 0 && newCost === 0) {
            await tx.costAnalysis.delete({ where: { id: existing.id } });
          } else {
            await tx.costAnalysis.update({
              where: { id: existing.id },
              data: { quantity: newQty, revenue: newRev, costAmount: newCost }
            });
          }
        }
      }

      // 3. Reversar deuda del cliente si era crédito
      if (sale.clientId) {
        const client = await tx.client.findUnique({
          where: { id: sale.clientId },
        });

        if (client) {
          const pendingAmount = sale.total - sale.paidAmount;
          
          if (pendingAmount > 0) {
            await tx.client.update({
              where: { id: sale.clientId },
              data: {
                balance: Math.max(0, client.balance - pendingAmount),
              },
            });
          }
        }
      }

      // 4. Reversar efectivo en caja registradora
      if (sale.paidAmount > 0) {
        let targetRegister = null;

        if (sale.cashRegisterId) {
          targetRegister = await tx.cashRegister.findFirst({
            where: { id: sale.cashRegisterId, isOpen: true }
          });
        }

        if (!targetRegister) {
          targetRegister = await findOpenRegister(tx, req.user.id);
        }

        if (targetRegister) {
          await tx.cashTransaction.create({
            data: {
              type: 'EXPENSE',
              amount: sale.paidAmount,
              description: `Devolución por Anulación de Venta #${sale.invoiceNumber}`,
              reference: sale.invoiceNumber,
              cashRegisterId: targetRegister.id,
              userId: req.user.id
            }
          });

          await tx.cashRegister.update({
            where: { id: targetRegister.id },
            data: { currentAmount: { decrement: sale.paidAmount } }
          });
        } else {
          // Si no hay ninguna caja abierta, registramos el egreso en contabilidad general solamente
          await tx.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: sale.paidAmount,
              description: `Anulación Venta #${sale.invoiceNumber} (Sin caja abierta)`,
              reference: sale.invoiceNumber,
              userId: req.user.id
            }
          });
        }
      }

      // 5. Actualizar estado de la venta
      await tx.sale.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 6. Registrar en historial global
      await tx.transactionHistory.create({
        data: {
          type: 'SALE_CANCEL',
          description: `Anulación de Venta #${sale.invoiceNumber} - Autorizado por: ${authorizer.name}`,
          amount: sale.total,
          categoryName: 'Ventas',
          reference: sale.invoiceNumber,
          userName: req.user.name || req.user.username,
          details: { 
            saleId: sale.id, 
            refundedAmount: sale.paidAmount,
            authorizedBy: authorizer.username,
            reason: 'Anulación manual'
          }
        }
      });
    });

    res.json({ message: 'Venta cancelada exitosamente y stock devuelto' });
  } catch (error) {
    console.error('Error al cancelar venta:', error);
    res.status(500).json({ 
      error: 'Error interno al procesar anulación',
      message: error.message,
      code: error.code
    });
  }
};

export const getDailySales = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'COMPLETED',
      },
      include: {
        items: true,
      },
    });

    const totalSales = sales.length;
    const totalAmount = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = sales.reduce((sum, sale) => sum + sale.items.length, 0);

    res.json({
      date: today.toISOString().split('T')[0],
      totalSales,
      totalAmount,
      totalItems,
      sales,
    });
  } catch (error) {
    console.error('Error al obtener ventas del día:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getAccountsReceivable = async (req, res) => {
  try {
    const { startDate, endDate, invoiceNumber, clientId, status, saleStartDate, saleEndDate } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const skip = (page - 1) * limit;

    const where = {
      paymentMethod: 'CREDIT',
    };

    if (invoiceNumber) {
      where.invoiceNumber = { contains: invoiceNumber };
    }

    if (clientId) {
      where.clientId = clientId;
    }

    if (status) {
      where.status = status;
    } else {
      where.status = { in: ['PENDING', 'PARTIAL'] };
    }

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) {
        where.dueDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.dueDate.lte = new Date(endDate);
      }
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, rnc: true, phone: true } },
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
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    const summary = sales.reduce((acc, sale) => {
      acc.totalPending += sale.total - sale.paidAmount;
      acc.totalSales += sale.total;
      if (sale.status === 'PENDING') acc.countPending += 1;
      if (sale.status === 'PARTIAL') acc.countPartial += 1;
      return acc;
    }, { totalPending: 0, totalSales: 0, countPending: 0, countPartial: 0 });

    res.json({
      sales,
      summary,
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
    console.error('Error al obtener cuentas por cobrar:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateSalePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { paidAmount, paymentDate } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    if (sale.paymentMethod !== 'CREDIT') {
      return res.status(400).json({ error: 'Esta venta no es a crédito' });
    }

    // VALIDACIÓN DE CAJA ABIERTA (Consistente con createSale)
    const openRegister = await findOpenRegister(prisma, req.user.id);

    if (!openRegister) {
      return res.status(400).json({ 
        error: 'No hay cajas abiertas disponibles',
        requiresCashRegister: true,
        message: 'Debes ABRIR CAJA antes de recibir abonos de clientes.' 
      });
    }

    const newPaidAmount = sale.paidAmount + paidAmount;
    const newStatus = newPaidAmount >= sale.total - 0.01 ? 'COMPLETED' : 'PARTIAL';

    const updatedSale = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
        include: {
          client: true,
        },
      });

      if (sale.clientId) {
        await tx.client.update({
          where: { id: sale.clientId },
          data: {
            balance: { decrement: paidAmount },
          },
        });

        const client = await tx.client.findUnique({
          where: { id: sale.clientId },
          select: { name: true },
        });

        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount: paidAmount,
            description: `Cobro a cliente - Factura #${sale.invoiceNumber}`,
            reference: sale.invoiceNumber,
            userId: req.user.id,
          },
        });

        await tx.cashTransaction.create({
          data: {
            type: 'INCOME',
            amount: paidAmount,
            description: `Abono Deuda (CxC) - Cliente: ${client.name} - Factura #${sale.invoiceNumber}`,
            reference: sale.invoiceNumber,
            cashRegisterId: openRegister.id,
            userId: req.user.id
          }
        });

        await tx.cashRegister.update({
          where: { id: openRegister.id },
          data: { currentAmount: { increment: paidAmount } }
        });

        await saveToHistory(tx, {
          type: 'PAGO_CXC',
          description: `Abono a Cuenta por Cobrar - Factura #${sale.invoiceNumber}`,
          amount: paidAmount,
          categoryName: 'Cobros',
          reference: sale.invoiceNumber,
          clientName: client.name,
          userName: req.user.name || req.user.username,
          details: { saleId: sale.id, paidAmount, newStatus }
        });
      }

      return updated;
    });

    res.json({ message: 'Pago registrado', sale: updatedSale });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getPendingPayments = async (req, res) => {
  try {
    const pending = await prisma.pendingPayment.findMany({
      where: { status: 'PENDING' },
      include: {
        client: {
          select: { id: true, name: true, balance: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(pending);
  } catch (error) {
    console.error('Error al obtener abonos pendientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const approvePendingPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const pending = await prisma.pendingPayment.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!pending) {
      return res.status(404).json({ error: 'Abono pendiente no encontrado' });
    }

    if (pending.status !== 'PENDING') {
      return res.status(400).json({ error: 'Este abono ya ha sido procesado' });
    }

    // Validar caja abierta
    const openRegister = await prisma.cashRegister.findFirst({
      where: { isOpen: true }
    });

    if (!openRegister) {
      return res.status(400).json({ error: 'Debe haber al menos una caja abierta para aprobar pagos.' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Actualizar estado del abono
      await tx.pendingPayment.update({
        where: { id },
        data: { 
          status: 'APPROVED',
          approvedBy: req.user.name || req.user.username
        }
      });

      // 2. Distribuir el abono entre las facturas pendientes
      let remainingToApply = pending.amount;
      const pendingSales = await tx.sale.findMany({
        where: {
          clientId: pending.clientId,
          status: { in: ['PENDING', 'PARTIAL'] },
          paymentMethod: 'CREDIT'
        },
        orderBy: { saleDate: 'asc' }
      });

      for (const sale of pendingSales) {
        if (remainingToApply <= 0) break;

        const pendingInInvoice = Math.max(0, sale.total - sale.paidAmount);
        const amountToApply = Math.min(remainingToApply, pendingInInvoice);

        if (amountToApply > 0) {
          const newPaidAmount = sale.paidAmount + amountToApply;
          const newStatus = newPaidAmount >= sale.total - 0.01 ? 'COMPLETED' : 'PARTIAL';

          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus
            }
          });

          remainingToApply -= amountToApply;
        }
      }

      // 3. Actualizar balance general del cliente
      const newBalance = Math.max(0, pending.client.balance - pending.amount);
      await tx.client.update({
        where: { id: pending.clientId },
        data: { balance: newBalance }
      });

      // 4. Registrar en contabilidad general
      await tx.transaction.create({
        data: {
          type: 'INCOME',
          amount: pending.amount,
          description: `Abono aprobado: ${pending.client.name} - ${pending.description || 'S/D'}`,
          userId: req.user.id,
        }
      });

      // 5. Registrar en caja
      await tx.cashTransaction.create({
        data: {
          type: 'INCOME',
          amount: pending.amount,
          description: `Abono cliente (Aprobado): ${pending.client.name}`,
          cashRegisterId: openRegister.id,
          userId: req.user.id
        }
      });

      // 5. Incrementar monto en caja
      await tx.cashRegister.update({
        where: { id: openRegister.id },
        data: { currentAmount: { increment: pending.amount } }
      });

      // 6. Historial
      await saveToHistory(tx, {
        type: 'PAGO_CXC_APROBADO',
        description: `Abono de cliente aprobado por administración`,
        amount: pending.amount,
        categoryName: 'Cobros',
        clientName: pending.client.name,
        userName: req.user.name || req.user.username,
        details: { 
          pendingPaymentId: id, 
          amount: pending.amount, 
          previousBalance: pending.client.balance, 
          newBalance 
        }
      });
    });

    res.json({ message: 'Abono aprobado y registrado en contabilidad' });
  } catch (error) {
    console.error('Error al aprobar abono:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const rejectPendingPayment = async (req, res) => {
  try {
    const { id } = req.params;

    const pending = await prisma.pendingPayment.findUnique({
      where: { id },
      include: { client: true }
    });

    if (!pending) {
      return res.status(404).json({ error: 'Abono pendiente no encontrado' });
    }

    await prisma.pendingPayment.update({
      where: { id },
      data: { status: 'REJECTED' }
    });

    await prisma.transactionHistory.create({
      data: {
        type: 'PAGO_CXC_RECHAZADO',
        description: `Abono de cliente rechazado por administración`,
        amount: pending.amount,
        categoryName: 'Cobros',
        clientName: pending.client.name,
        userName: req.user.name || req.user.username,
        details: { pendingPaymentId: id, amount: pending.amount }
      }
    });

    res.json({ message: 'Abono rechazado' });
  } catch (error) {
    console.error('Error al rechazar abono:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getCreditSalesSummary = async (req, res) => {
  try {
    const { date } = req.query;

    const whereClause = {
      paymentMethod: 'CREDIT',
    };

    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      whereClause.createdAt = {
        gte: targetDate,
        lt: nextDate,
      };
    }

    const sales = await prisma.sale.findMany({
      where: whereClause,
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        paidAmount: true,
        status: true,
        client: {
          select: { name: true }
        },
        saleDate: true,
      },
      orderBy: { saleDate: 'desc' },
    });

    const summary = sales.reduce((acc, sale) => {
      acc.totalSales += sale.total;
      acc.totalPaid += sale.paidAmount;
      acc.totalPending += sale.total - sale.paidAmount;
      acc.countSales += 1;
      if (sale.status === 'COMPLETED') acc.countPaid += 1;
      else acc.countPending += 1;
      return acc;
    }, { totalSales: 0, totalPaid: 0, totalPending: 0, countSales: 0, countPaid: 0, countPending: 0 });

    res.json({ sales, summary });
  } catch (error) {
    console.error('Error al obtener resumen ventas crédito:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const incrementPrintCount = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await prisma.sale.findUnique({
      where: { id },
    });

    if (!sale) {
      return res.status(404).json({ error: 'Venta no encontrada' });
    }

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        printCount: (sale.printCount || 0) + 1,
      },
    });

    res.json({ 
      message: 'Contador de impresión incrementado',
      printCount: updatedSale.printCount 
    });
  } catch (error) {
    console.error('Error al incrementar contador:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
