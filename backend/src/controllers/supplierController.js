import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';

export const getAllSuppliers = async (req, res) => {
  try {
    const { search, active } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: { invoices: true }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    const supplierIds = suppliers.map(s => s.id);
    const pendingGroups = supplierIds.length > 0
      ? await prisma.supplierInvoice.groupBy({
          by: ['supplierId'],
          where: { supplierId: { in: supplierIds }, paid: false },
          _sum: { amount: true, paidAmount: true },
          _count: { supplierId: true },
        })
      : [];

    const pendingMap = {};
    for (const g of pendingGroups) {
      const totalPending = (g._sum.amount || 0) - (g._sum.paidAmount || 0);
      pendingMap[g.supplierId] = { totalPending, pendingCount: g._count.supplierId };
    }

    const suppliersWithPending = suppliers.map((supplier) => {
      const pending = pendingMap[supplier.id] || { totalPending: 0, pendingCount: 0 };
      return { ...supplier, ...pending };
    });

    res.json({
      data: suppliersWithPending,
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
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' }
        }
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json(supplier);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createSupplier = async (req, res) => {
  try {
    const supplierData = req.body;

     const supplier = await prisma.supplier.create({
       data: supplierData,
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'CREAR_PROVEEDOR',
         description: `Proveedor creado: ${supplier.name}`,
         amount: 0,
         categoryName: 'Proveedores',
         userName: req.user.name || req.user.username,
         details: { 
           createdSupplierId: supplier.id,
           createdSupplierName: supplier.name,
           email: supplier.email,
           phone: supplier.phone
         }
       }
     });

     res.status(201).json({ 
       message: 'Proveedor creado exitosamente',
       supplier 
     });
  } catch (error) {
    console.error('Error al crear proveedor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplierData = req.body;

     const supplier = await prisma.supplier.update({
       where: { id },
       data: supplierData,
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ACTUALIZAR_PROVEEDOR',
         description: `Proveedor actualizado: ${supplier.name}`,
         amount: 0,
         categoryName: 'Proveedores',
         userName: req.user.name || req.user.username,
         details: { 
           updatedSupplierId: supplier.id,
           updatedSupplierName: supplier.name,
           changes: Object.keys(supplierData)
         }
       }
     });

     res.json({ 
       message: 'Proveedor actualizado exitosamente',
       supplier 
     });
  } catch (error) {
    console.error('Error al actualizar proveedor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Solo el Administrador puede eliminar proveedores' 
      });
    }

    const pendingInvoices = await prisma.supplierInvoice.findFirst({
      where: { supplierId: id, paid: false }
    });

    if (pendingInvoices) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un proveedor con facturas pendientes' 
      });
    }

     const supplier = await prisma.supplier.update({
        where: { id },
        data: { active: false },
      });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
        data: {
          type: 'ELIMINAR_PROVEEDOR',
          description: `Proveedor desactivado: ${supplier.name}`,
          amount: 0,
          categoryName: 'Proveedores',
          userName: req.user.name || req.user.username,
          details: { 
            deactivatedSupplierId: id,
            deactivatedSupplierName: supplier.name
          }
        }
      });

     res.json({ message: 'Proveedor desactivado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar proveedor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getSupplierInvoices = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.query;

    const where = { supplierId: id };
    
    if (status === 'pending') {
      where.paid = false;
    } else if (status === 'paid') {
      where.paid = true;
    }

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices);
  } catch (error) {
    console.error('Error al obtener facturas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createSupplierInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceNumber, description, amount, dueDate, document, documentName, notes } = req.body;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    await prisma.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.create({
        data: {
          invoiceNumber,
          description,
          amount: parseFloat(amount),
          dueDate: dueDate ? new Date(dueDate) : null,
          document,
          documentName,
          notes,
          supplierId: id,
        },
      });

      await tx.supplier.update({
        where: { id },
        data: {
          balance: supplier.balance + parseFloat(amount)
        }
      });

      await tx.transactionHistory.create({
        data: {
          type: 'CXP',
          description: `Nueva deuda (CxP) declarada - Factura: ${invoiceNumber || 'S/N'}`,
          amount: parseFloat(amount),
          categoryName: 'Proveedores',
          reference: invoiceNumber,
          supplierName: supplier.name,
          userName: req.user.name || req.user.username,
          details: { invoiceId: invoice.id, description }
        }
      });

      return invoice;
    });

    res.status(201).json({ 
      message: 'Factura creada exitosamente'
    });
  } catch (error) {
    console.error('Error al crear factura:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateSupplierInvoice = async (req, res) => {
  try {
    const { id, invoiceId } = req.params;
    const updateData = req.body;

    if (updateData.dueDate) {
      updateData.dueDate = new Date(updateData.dueDate);
    }

    const invoice = await prisma.supplierInvoice.update({
      where: { id: invoiceId },
      data: updateData,
    });

    res.json({ 
      message: 'Factura actualizada exitosamente',
      invoice 
    });
  } catch (error) {
    console.error('Error al actualizar factura:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteSupplierInvoice = async (req, res) => {
  try {
    const { id, invoiceId } = req.params;

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    if (invoice.paid) {
      return res.status(400).json({ error: 'No se puede eliminar una factura pagada' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.delete({
        where: { id: invoiceId },
      });

      await tx.supplier.update({
        where: { id },
        data: {
          balance: { decrement: invoice.amount - invoice.paidAmount },
        },
      });
    });

    res.json({ message: 'Factura eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar factura:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const recordSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceId, amount, notes } = req.body;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    const invoice = await prisma.supplierInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }

    let openRegister = await prisma.cashRegister.findFirst({
      where: { openedBy: req.user.id, isOpen: true }
    });

    if (!openRegister) {
      openRegister = await prisma.cashRegister.findFirst({
        where: { isOpen: true }
      });
    }

    if (!openRegister) {
      return res.status(400).json({ error: 'Debes ABRIR UNA CAJA antes de emitir pagos a proveedores.' });
    }

    const remainingAmount = invoice.amount - invoice.paidAmount;
    
    if (amount > remainingAmount) {
      return res.status(400).json({ 
        error: 'El monto excede el saldo pendiente de la factura' 
      });
    }

    const newPaidAmount = invoice.paidAmount + amount;
    const isPaid = newPaidAmount >= invoice.amount;

    await prisma.$transaction(async (tx) => {
      await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          paid: isPaid,
          paidDate: isPaid ? new Date() : null,
        },
      });

      await tx.supplier.update({
        where: { id },
        data: {
          balance: supplier.balance - amount,
        },
      });

      await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          amount,
          description: `Pago a proveedor: ${supplier.name} - ${invoice.invoiceNumber || invoice.description}`,
          reference: invoice.invoiceNumber,
          userId: req.user.id,
        },
      });

      await tx.cashTransaction.create({
        data: {
          type: 'EXPENSE',
          amount,
          description: `Abono a Proveedor (CxP): ${supplier.name} - Fac #${invoice.invoiceNumber || 'S/N'}`,
          reference: invoice.invoiceNumber,
          cashRegisterId: openRegister.id,
          userId: req.user.id
        }
      });

      await tx.cashRegister.update({
        where: { id: openRegister.id },
        data: { currentAmount: { decrement: amount } }
      });

      await tx.transactionHistory.create({
        data: {
          type: 'PAGO_CXP',
          description: `Pago a Proveedor (CxP): ${supplier.name} - Fac #${invoice.invoiceNumber || 'S/N'}`,
          amount: amount,
          categoryName: 'Proveedores',
          reference: invoice.invoiceNumber,
          supplierName: supplier.name,
          userName: req.user.name || req.user.username,
          details: { invoiceId: invoice.id, appliedAmount: amount, isPaid }
        }
      });
    });

    res.json({ 
      message: 'Pago registrado exitosamente',
      paidAmount: newPaidAmount,
      remainingAmount: invoice.amount - newPaidAmount,
      isPaid
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
