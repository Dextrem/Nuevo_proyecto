import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';
import { parsePaginationParams } from '../utils/pagination.js';

export const getAllWarranties = async (req, res) => {
  try {
    const { startDate, endDate, clientId, createdById, search } = req.query;
    const { page, limit, skip } = parsePaginationParams(req.query);

    const where = {};
    if (startDate || endDate) {
      where.issueDate = {};
      if (startDate) { const d = new Date(startDate); d.setUTCHours(0,0,0,0); where.issueDate.gte = d; }
      if (endDate) { const d = new Date(endDate); d.setUTCHours(23,59,59,999); where.issueDate.lte = d; }
    }
    if (clientId) where.clientId = clientId;
    if (createdById) where.createdById = createdById;
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { clientRnc: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [warranties, total] = await Promise.all([
      prisma.warranty.findMany({
        where,
        include: {
          client: { select: { id: true, name: true, rnc: true } },
          createdBy: { select: { id: true, name: true, username: true } },
          sale: { select: { id: true, invoiceNumber: true, total: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.warranty.count({ where }),
    ]);

    res.json({
      data: warranties,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) {
    console.error('Error al obtener garantías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createWarranty = async (req, res) => {
  try {
    const { clientId, clientName, clientRnc, clientPhone, days, coverage, exclusions, issueDate, expiryDate } = req.body;

    if (!clientName || !days) {
      return res.status(400).json({ error: 'Nombre del cliente y días de garantía son requeridos' });
    }

    if (clientId) {
      const client = await prisma.client.findUnique({ where: { id: clientId } });
      if (!client) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
    }

    const now = new Date();
    const expDate = expiryDate ? new Date(expiryDate) : new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const warranty = await prisma.warranty.create({
      data: {
        clientId: clientId || null,
        clientName,
        clientRnc: clientRnc || null,
        clientPhone: clientPhone || null,
        days,
        coverage: coverage || null,
        exclusions: exclusions || null,
        issueDate: issueDate ? new Date(issueDate) : now,
        expiryDate: expDate,
        createdById: req.user.id,
      },
      include: {
        client: { select: { id: true, name: true, rnc: true } },
        createdBy: { select: { id: true, name: true, username: true } },
      },
    });

    res.status(201).json({ message: 'Garantía creada exitosamente', warranty });
  } catch (error) {
    console.error('Error al crear garantía:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const deleteWarranty = async (req, res) => {
  try {
    const { id } = req.params;
    const { authorizerUsername, authorizerPassword } = req.body;

    if (!authorizerUsername || !authorizerPassword) {
      return res.status(403).json({ error: 'Se requieren credenciales de supervisor para eliminar una garantía' });
    }

    const authorizer = await prisma.user.findFirst({
      where: { username: authorizerUsername.toLowerCase(), active: true, role: { in: ['ADMIN', 'MANAGER'] } },
    });

    if (!authorizer) {
      return res.status(403).json({ error: 'Usuario autorizador no encontrado o no tiene permisos de supervisor' });
    }

    const isPasswordValid = await bcrypt.compare(authorizerPassword, authorizer.password);
    if (!isPasswordValid) {
      return res.status(403).json({ error: 'Contraseña de supervisor incorrecta' });
    }

    const warranty = await prisma.warranty.findUnique({ where: { id } });
    if (!warranty) {
      return res.status(404).json({ error: 'Garantía no encontrada' });
    }

    await prisma.warranty.delete({ where: { id } });

    res.json({ message: 'Garantía eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar garantía:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
