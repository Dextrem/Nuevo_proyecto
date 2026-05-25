import prisma from '../config/database.js';

export const getPurchases = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
    const skip = (page - 1) * limit;

    const [purchases, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        include: {
          supplier: { select: { name: true } },
          items: { include: { product: { select: { name: true, sku: true } } } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchaseOrder.count(),
    ]);
    res.json({
      data: purchases,
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
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};

export const createPurchase = async (req, res) => {
  try {
    const { supplierId, orderNumber, items, notes } = req.body;
    
    if (!supplierId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Proveedor y productos requeridos' });
    }

    const oNumber = orderNumber || `PO-${Date.now()}`;
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear Purchase Order
      const po = await tx.purchaseOrder.create({
        data: {
          supplierId,
          orderNumber: oNumber,
          totalAmount,
          notes,
          status: 'RECEIVED', // Recepción automática por default para este ERP
          userId: req.user.id,
          receivedAt: new Date(),
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitCost: item.unitCost,
              total: item.quantity * item.unitCost
            }))
          }
        }
      });

      // 2. Crear Cuentas Por Pagar / SupplierInvoice (CxP)
      const invoice = await tx.supplierInvoice.create({
        data: {
          supplierId,
          description: `Orden de Compra ${oNumber}`,
          amount: totalAmount,
          notes: notes,
          invoiceNumber: oNumber
        }
      });
      
      await tx.accountPayable.create({
        data: {
          supplierId,
          invoiceNumber: oNumber,
          description: `Mercancía Ingresada por PO ${oNumber}`,
          amount: totalAmount,
          status: 'PENDING'
        }
      });

      // 3. Registrar en Historial Global
      const supplierData = await tx.supplier.findUnique({ where: { id: supplierId } });
      await tx.transactionHistory.create({
        data: {
          type: 'CXP_NUEVA',
          description: `Compra de inventario ${oNumber} a ${supplierData.name}`,
          amount: totalAmount,
          categoryName: 'Cuentas por Pagar',
          supplierName: supplierData.name,
          userName: req.user.name || req.user.username,
          details: { poId: po.id }
        }
      });

      // 4. Actualizar Inventario y crear Kárdex
      for (const item of items) {
        const prod = await tx.product.findUnique({ where: { id: item.productId } });
        
        // Kárdex
        await tx.inventoryMovement.create({
          data: {
            productId: prod.id,
            type: 'IN',
            quantity: item.quantity,
            previousStock: prod.stock,
            newStock: prod.stock + item.quantity,
            reference: oNumber,
            description: `Ingreso por Órden de Compra`,
            userId: req.user.id
          }
        });

        // Actualización stock y costo (promedio ponderado)
        const oldStock = prod.stock;
        const newStock = oldStock + item.quantity;
        const weightedAvgCost = oldStock > 0
          ? ((oldStock * prod.cost) + (item.quantity * item.unitCost)) / newStock
          : item.unitCost;

        await tx.product.update({
          where: { id: prod.id },
          data: {
            stock: newStock,
            cost: Math.round(weightedAvgCost * 100) / 100
          }
        });
      }

      return po;
    });

    res.status(201).json({ message: 'Compra registrada con éxito y enviada a CxP', data: result });
  } catch (error) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'El número de orden ya existe' });
    res.status(500).json({ error: 'Error interno del servidor', details: error.message });
  }
};
