import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';

export const getCashRegisters = async (req, res) => {
  try {
    const registers = await prisma.cashRegister.findMany({
      include: {
        openedByUser: { select: { name: true } },
        closedByUser: { select: { name: true } },
        transactions: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(registers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCashRegister = async (req, res) => {
  try {
    const { id } = req.params;
    const register = await prisma.cashRegister.findUnique({
      where: { id },
      include: {
        openedByUser: { select: { name: true } },
        closedByUser: { select: { name: true } },
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!register) {
      return res.status(404).json({ error: 'Cash register not found' });
    }
    res.json(register);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const openCashRegister = async (req, res) => {
  try {
    const { name, openingAmount, authorizerUsername, authorizerPassword } = req.body;
    const userId = req.user.id;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Register name is required' });
    }
    const openingValue = Number(openingAmount);
    if (Number.isNaN(openingValue) || openingValue < 0) {
      return res.status(400).json({ error: 'Opening amount must be a valid non-negative number' });
    }

    // Validate admin credentials if provided
    if (authorizerUsername && authorizerPassword) {
      const authorizer = await prisma.user.findUnique({
        where: { username: authorizerUsername.toLowerCase() }
      });
      if (!authorizer || authorizer.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only administrators can authorize cash register operations' });
      }
      const validPassword = await bcrypt.compare(authorizerPassword, authorizer.password);
      if (!validPassword) {
        return res.status(403).json({ error: 'Invalid administrator credentials' });
      }
    } else {
      // If no authorizer provided, check if user is admin
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Administrator authorization required to open cash register' });
      }
    }

    // Verificar si ya existe alguna caja abierta en el sistema (Modelo de caja única/compartida)
    const existingOpen = await prisma.cashRegister.findFirst({
      where: {
        isOpen: true
      },
      include: {
        openedByUser: { select: { name: true } }
      }
    });

    if (existingOpen) {
      return res.status(400).json({ 
        error: `Ya existe una caja abierta (${existingOpen.name}) por ${existingOpen.openedByUser.name}. Debe cerrarla antes de abrir una nueva.` 
      });
    }

    const register = await prisma.cashRegister.create({
      data: {
        name: name.trim(),
        openingAmount: openingValue,
        currentAmount: openingValue,
        isOpen: true,
        openedAt: new Date(),
        openedBy: userId
      },
      include: {
        openedByUser: { select: { name: true } }
      }
    });

    // Registrar apertura en historial
    try {
      await prisma.transactionHistory.create({
        data: {
          type: 'APERTURA_CAJA',
          description: `Apertura de caja: ${name.trim()} - Monto: ${openingValue}`,
          amount: openingValue,
          userName: req.user?.name || req.user?.username || 'Sistema',
          categoryName: 'Caja',
        },
      });
    } catch (logError) {
      console.error('Error registrando apertura de caja:', logError);
    }

    res.status(201).json(register);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addTransaction = async (req, res) => {
  try {
    const { registerId, type, amount, description, reference } = req.body;
    const userId = req.user.id;

    if (!registerId) {
      return res.status(400).json({ error: 'Register ID is required' });
    }
    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ error: 'Transaction type must be INCOME or EXPENSE' });
    }
    const transactionAmount = Number(amount);
    if (Number.isNaN(transactionAmount) || transactionAmount <= 0) {
      return res.status(400).json({ error: 'Transaction amount must be a valid positive number' });
    }
    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({ error: 'Transaction description is required' });
    }

    // Check if register is open
    const register = await prisma.cashRegister.findUnique({
      where: { id: registerId },
      select: { isOpen: true }
    });

    if (!register || !register.isOpen) {
      return res.status(400).json({ error: 'Cash register is not open' });
    }

    // Create transaction first
    const transaction = await prisma.cashTransaction.create({
      data: {
        type,
        amount: transactionAmount,
        description: description.trim(),
        reference: reference ? String(reference).trim() : null,
        cashRegisterId: registerId,
        userId
      }
    });

    // Update register current amount atomically (no race condition)
    await prisma.cashRegister.update({
      where: { id: registerId },
      data: {
        currentAmount: type === 'INCOME'
          ? { increment: transactionAmount }
          : { decrement: transactionAmount }
      }
    });

    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const closeCashRegister = async (req, res) => {
  try {
    const { id } = req.params;
    const { closingAmount, notes, authorizerUsername, authorizerPassword } = req.body;
    const userId = req.user.id;

    // Validate admin credentials if provided
    if (authorizerUsername && authorizerPassword) {
      const authorizer = await prisma.user.findUnique({
        where: { username: authorizerUsername.toLowerCase() }
      });
      if (!authorizer || authorizer.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only administrators can authorize cash register operations' });
      }
      const validPassword = await bcrypt.compare(authorizerPassword, authorizer.password);
      if (!validPassword) {
        return res.status(403).json({ error: 'Invalid administrator credentials' });
      }
    } else {
      if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Administrator authorization required to close cash register' });
      }
    }

    const closingValue = Number(closingAmount);
    if (Number.isNaN(closingValue)) {
      return res.status(400).json({ error: 'Closing amount must be a valid number' });
    }

    const register = await prisma.cashRegister.findUnique({
      where: { id },
      include: { transactions: true }
    });

    if (!register || !register.isOpen) {
      return res.status(400).json({ error: 'Cash register is not open' });
    }

    // Calculate expected amount (opening + income - expense)
    const income = register.transactions
      .filter(t => t.type === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);
    const expense = register.transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + t.amount, 0);
    const expectedAmount = register.openingAmount + income - expense;

    const difference = closingValue - expectedAmount;

    await prisma.cashRegister.update({
      where: { id },
      data: {
        isOpen: false,
        closingAmount: closingValue,
        closedAt: new Date(),
        closedBy: userId,
        notes: notes ? String(notes).trim() : `Difference: ${difference.toFixed(2)}`
      }
    });

    // Registrar cierre en historial
    try {
      await prisma.transactionHistory.create({
        data: {
          type: 'CIERRE_CAJA',
          description: `Cierre de caja: ${register.name} - Esperado: ${expectedAmount} - Real: ${closingValue} - Diferencia: ${difference}`,
          amount: Math.abs(difference),
          userName: req.user?.name || req.user?.username || 'Sistema',
          categoryName: 'Caja',
        },
      });
    } catch (logError) {
      console.error('Error registrando cierre de caja:', logError);
    }

    res.json({
      message: 'Cash register closed successfully',
      expectedAmount,
      actualAmount: closingValue,
      difference
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getOpenRegisters = async (req, res) => {
  try {
    const registers = await prisma.cashRegister.findMany({
      where: { isOpen: true },
      include: {
        openedByUser: { select: { name: true } },
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });
    res.json(registers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCurrentUserRegister = async (req, res) => {
  try {
    const userId = req.user.id;
    // Priorizar la caja abierta por el usuario, o devolver cualquier caja abierta (compartida)
    let register = await prisma.cashRegister.findFirst({
      where: { openedBy: userId, isOpen: true },
      include: {
        openedByUser: { select: { name: true } },
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!register) {
      register = await prisma.cashRegister.findFirst({
        where: { isOpen: true },
        include: {
          openedByUser: { select: { name: true } },
          transactions: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });
    }
    if (!register) {
      return res.status(404).json({ error: 'No open register for this user' });
    }
    res.json(register);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};