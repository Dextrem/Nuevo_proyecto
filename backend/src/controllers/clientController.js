import prisma from '../config/database.js';
import { parsePaginationParams } from '../utils/pagination.js';

export const getAllClients = async (req, res) => {
  try {
    const { search, active } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { rnc: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (active !== undefined) {
      where.active = active === 'true';
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    res.json({
      data: clients,
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
    console.error('Error al obtener clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        sales: {
          where: { status: 'COMPLETED' },
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, sku: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(client);
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createClient = async (req, res) => {
  try {
    const { name, email, phone, rnc, address, creditLimit } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'El nombre del cliente es requerido' });
    }

     const client = await prisma.client.create({
       data: { name: name.trim(), email, phone, rnc, address, creditLimit: parseFloat(creditLimit) || 0 },
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'CREAR_CLIENTE',
         description: `Cliente creado: ${client.name}`,
         amount: 0,
         categoryName: 'Clientes',
         userName: req.user.name || req.user.username,
         details: { 
           createdClientId: client.id,
           createdClientName: client.name,
           email: client.email,
           phone: client.phone
         }
       }
     });

     res.status(201).json({ 
       message: 'Cliente creado exitosamente',
       client 
     });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, rnc, address, creditLimit } = req.body;

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (email !== undefined) data.email = email;
    if (phone !== undefined) data.phone = phone;
    if (rnc !== undefined) data.rnc = rnc;
    if (address !== undefined) data.address = address;
    if (creditLimit !== undefined) data.creditLimit = parseFloat(creditLimit);

     const client = await prisma.client.update({
       where: { id },
       data,
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ACTUALIZAR_CLIENTE',
         description: `Cliente actualizado: ${client.name}`,
         amount: 0,
         categoryName: 'Clientes',
         userName: req.user.name || req.user.username,
         details: { 
           updatedClientId: client.id,
           updatedClientName: client.name,
           changes: Object.keys(clientData)
         }
       }
     });

     res.json({ 
       message: 'Cliente actualizado exitosamente',
       client 
     });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Solo el Administrador puede eliminar clientes' 
      });
    }

    const client = await prisma.client.findUnique({
      where: { id },
      select: { balance: true },
    });

    if (client && client.balance > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un cliente con saldo pendiente' 
      });
    }

     await prisma.client.update({
       where: { id },
       data: { active: false },
     });

     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ELIMINAR_CLIENTE',
         description: `Cliente desactivado: ${client.name}`,
         amount: 0,
         categoryName: 'Clientes',
         userName: req.user.name || req.user.username,
         details: { 
           deactivatedClientId: id,
           deactivatedClientName: client.name
         }
       }
     });

     res.json({ message: 'Cliente desactivado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, description } = req.body;

    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    if (amount > client.balance) {
      return res.status(400).json({ 
        error: 'El monto excede el saldo del cliente' 
      });
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
      return res.status(400).json({ error: 'Debes ABRIR UNA CAJA antes de recibir pagos de clientes.' });
    }

    const newBalance = client.balance - amount;

    await prisma.pendingPayment.create({
      data: {
        clientId: id,
        amount,
        description: description || `Abono de cliente: ${client.name}`,
        userId: req.user.id,
        status: 'PENDING'
      }
    });

    // Registrar en historial como intento de pago
    await prisma.transactionHistory.create({
      data: {
        type: 'SOLICITUD_PAGO',
        description: description || `Solicitud de abono de cliente: ${client.name}`,
        amount,
        categoryName: 'Cobros',
        clientName: client.name,
        userName: req.user.name || req.user.username,
        details: { clientId: id, amount, status: 'PENDING' }
      }
    });

    res.json({ 
      message: 'Abono registrado y pendiente de aprobación por administración.',
      status: 'PENDING',
      paymentAmount: amount,
    });
  } catch (error) {
    console.error('Error al registrar pago:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
