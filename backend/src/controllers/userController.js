import bcrypt from 'bcryptjs';
import prisma from '../config/database.js';
import { sanitizeString } from '../middleware/validation.js';
import { parsePaginationParams } from '../utils/pagination.js';
import { logger } from '../utils/logger.js';
export const getAllUsers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req.query);

    const selectFields = {
      id: true, username: true, email: true, name: true, role: true,
      permissions: true, active: true, passwordExpiresAt: true,
      passwordNeverExpires: true, passwordExpirationDays: true,
      mustChangePassword: true, createdAt: true, updatedAt: true,
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: selectFields,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    res.json({
      data: users,
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
    logger.error('Error al obtener usuarios:', { error });
    res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
};
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, name: true, role: true,
        permissions: true, active: true, passwordExpiresAt: true,
        passwordNeverExpires: true, passwordExpirationDays: true,
        mustChangePassword: true, createdAt: true, updatedAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(user);
  } catch (error) {
    logger.error('Error al obtener usuario:', { error });
    res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
};
export const createUser = async (req, res) => {
  try {
    const { username, email, password, name, role, permissions, passwordNeverExpires, passwordExpirationDays } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email y password son requeridos' });
    }
    const sanitizedUsername = sanitizeString(username);
    const sanitizedEmail = sanitizeString(email);
    const sanitizedName = sanitizeString(name || '');
    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 30 caracteres' });
    }
    if (!sanitizedName) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: sanitizedUsername.toLowerCase() },
          { email: sanitizedEmail.toLowerCase() },
        ],
      },
    });
    if (existingUser) {
      return res.status(400).json({ 
        error: 'El usuario o email ya existe' 
      });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const expDays = parseInt(passwordExpirationDays) || 90;
    const passwordExpiresAt = passwordNeverExpires ? null : new Date(Date.now() + expDays * 24 * 60 * 60 * 1000);

     let user;
     try {
       user = await prisma.user.create({
         data: {
           username: sanitizedUsername.toLowerCase(),
           email: sanitizedEmail.toLowerCase(),
           password: hashedPassword,
           name: sanitizedName,
           role: role || 'CASHIER',
           permissions: permissions || {},
           passwordNeverExpires: !!passwordNeverExpires,
           passwordExpirationDays: expDays,
           passwordExpiresAt,
           lastPasswordChange: new Date(),
         },
         select: {
           id: true,
           username: true,
           email: true,
           name: true,
           role: true,
           permissions: true,
           active: true,
           createdAt: true,
         },
       });
     } catch (createError) {
       logger.error('Error in prisma.user.create:', { error: createError });
       throw new Error(`Error al crear base del usuario: ${createError.message}`);
     }
     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'CREAR_USUARIO',
         description: `Usuario creado: ${user.username}`,
         amount: 0,
         categoryName: 'Usuarios',
         userName: (req.user && (req.user.name || req.user.username)) || 'Administrador',
         details: { 
           createdUserId: user.id,
           createdUsername: user.username,
           role: user.role
         }
       }
     });
     res.status(201).json({ 
       message: 'Usuario creado exitosamente',
       user 
     });
  } catch (error) {
    logger.error('Error al crear usuario:', { error });
    res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
};
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const updateData = { ...req.body };
    delete updateData.password;

    const currentUser = await prisma.user.findUnique({ where: { id } });

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    let dataToUpdate = {};

    if (updateData.username) dataToUpdate.username = updateData.username.toLowerCase();
    if (updateData.email) dataToUpdate.email = updateData.email.toLowerCase();
    if (updateData.name) dataToUpdate.name = updateData.name;
    if (updateData.role) dataToUpdate.role = updateData.role;
    if (updateData.permissions !== undefined) dataToUpdate.permissions = updateData.permissions;
    if (updateData.active !== undefined) dataToUpdate.active = updateData.active;

    // Manejo de expiración de contraseña
    let finalPasswordNeverExpires = req.body.passwordNeverExpires !== undefined
      ? !!req.body.passwordNeverExpires : currentUser.passwordNeverExpires;
    let finalPasswordExpirationDays = req.body.passwordExpirationDays !== undefined
      ? parseInt(req.body.passwordExpirationDays) : currentUser.passwordExpirationDays;

    dataToUpdate.passwordNeverExpires = finalPasswordNeverExpires;
    dataToUpdate.passwordExpirationDays = finalPasswordExpirationDays;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      dataToUpdate.password = hashedPassword;
      dataToUpdate.passwordExpiresAt = finalPasswordNeverExpires
        ? null : new Date(Date.now() + (finalPasswordExpirationDays || 90) * 24 * 60 * 60 * 1000);
      dataToUpdate.lastPasswordChange = new Date();
      dataToUpdate.mustChangePassword = false;
    } else if (req.body.passwordExpirationDays !== undefined || req.body.passwordNeverExpires !== undefined) {
      if (finalPasswordNeverExpires) {
        dataToUpdate.passwordExpiresAt = null;
      } else {
        const lastChange = currentUser.lastPasswordChange || new Date();
        dataToUpdate.passwordExpiresAt = new Date(lastChange.getTime() + (finalPasswordExpirationDays || 90) * 24 * 60 * 60 * 1000);
      }
    }

    // Validar duplicados si se cambia username o email
    if (updateData.username || updateData.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: updateData.username?.toLowerCase() || '' },
            { email: updateData.email?.toLowerCase() || '' },
          ],
          NOT: { id },
        },
      });
      if (existingUser) {
        return res.status(400).json({ error: 'El usuario o email ya está en uso' });
      }
    }

    await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

     await prisma.transactionHistory.create({
       data: {
         type: 'ACTUALIZAR_USUARIO',
         description: `Usuario actualizado: ${updateData.username || currentUser.username}`,
         amount: 0,
         categoryName: 'Usuarios',
         userName: (req.user && (req.user.name || req.user.username)) || 'Administrador',
         details: { 
           updatedUserId: id,
           updatedUsername: updateData.username || currentUser.username,
           changes: Object.keys(updateData)
         }
       }
     });

     res.json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    logger.error('Error al actualizar usuario:', { error });
    res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
};
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) {
      return res.status(400).json({ 
        error: 'No puedes eliminar tu propio usuario' 
      });
    }
     await prisma.user.update({
       where: { id },
       data: { active: false },
     });
     // Registrar en historial de transacciones
     await prisma.transactionHistory.create({
       data: {
         type: 'ELIMINAR_USUARIO',
         description: `Usuario desactivado: ${req.user.username || 'unknown'}`,
         amount: 0,
         categoryName: 'Usuarios',
         userName: req.user.name || req.user.username,
         details: { 
           deactivatedUserId: id
         }
       }
     });
     res.json({ message: 'Usuario desactivado exitosamente' });
  } catch (error) {
    logger.error('Error al eliminar usuario:', { error });
    res.status(500).json({ error: "Error interno del servidor", message: error.message });
  }
};
