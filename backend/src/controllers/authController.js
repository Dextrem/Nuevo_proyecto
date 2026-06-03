import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import dotenv from 'dotenv';
import { logger } from '../utils/logger.js';
import { sanitizeString } from '../middleware/validation.js';

dotenv.config();

const getSecuritySettings = async () => {
  try {
    const settings = await prisma.settings.findFirst();
    return {
      maxLoginAttempts: settings?.maxLoginAttempts || 5,
      lockoutDurationMinutes: settings?.lockoutDurationMinutes || 15,
      sessionTimeoutMinutes: settings?.sessionTimeoutMinutes || 30,
    };
  } catch { return { maxLoginAttempts: 5, lockoutDurationMinutes: 15, sessionTimeoutMinutes: 30 }; }
};

export const register = async (req, res) => {
  try {
    const { username, email, password, name, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email y password son requeridos' });
    }

    const sanitizedUsername = sanitizeString(username);
    const sanitizedEmail = sanitizeString(email);
    const sanitizedName = sanitizeString(name || '');

    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
      return res.status(400).json({ error: 'El usuario debe tener entre 3 y 30 caracteres' });
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
        error: 'El usuario o email ya existe',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    
    if (complexityScore < 3 || password.length < 8) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 8 caracteres e incluir al menos 3 de: mayúscula, minúscula, número, carácter especial' 
      });
    }

    const commonPasswords = ['password', '123456', '12345678', 'qwerty', 'abc123', 'monkey', '1234567', 'letmein', 'trustno1', 'dragon', 'baseball', 'iloveyou', 'master', 'sunshine', 'ashley', 'football', 'password1', 'password123'];
    if (commonPasswords.includes(password.toLowerCase())) {
      return res.status(400).json({ error: 'Esta contraseña es demasiado común, elige una más segura' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: sanitizedUsername.toLowerCase(),
        email: sanitizedEmail.toLowerCase(),
        password: hashedPassword,
        name: sanitizedName || null,
        role: role || 'CASHIER',
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user,
    });
  } catch (error) {
    logger.error('Error en registro', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Security constants are now loaded dynamically from Settings via getSecuritySettings()

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    logger.debug('Login attempt', { username });

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const user = await prisma.user.findFirst({
      where: {
        username: username.toLowerCase(),
        active: true,
      },
    });

    logger.debug('User lookup result', { exists: !!user, id: user?.id, username: user?.username });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const secSettings = await getSecuritySettings();
    const MAX_LOGIN_ATTEMPTS = secSettings.maxLoginAttempts;
    const LOCKOUT_DURATION_MINUTES = secSettings.lockoutDurationMinutes;

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMinutes = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({ 
        error: `Cuenta bloqueada temporalmente. Intenta en ${remainingMinutes} minutos.` 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      const lockUntil = attempts >= MAX_LOGIN_ATTEMPTS 
        ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
        : null;

      await prisma.$executeRaw`
        UPDATE "users"
        SET "failedLoginAttempts" = ${attempts},
            "lockUntil" = ${lockUntil},
            "lastLoginAttempt" = ${new Date()}
        WHERE "id" = ${user.id}
      `;

      if (lockUntil) {
        return res.status(423).json({ 
          error: `Demasiados intentos fallidos. Cuenta bloqueada por ${LOCKOUT_DURATION_MINUTES} minutos.` 
        });
      }

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - attempts;
      return res.status(401).json({ 
        error: `Credenciales inválidas. Intentos restantes: ${remainingAttempts}` 
      });
    }

    // Verificar expiración de contraseña
    if (!user.passwordNeverExpires && user.passwordExpiresAt && user.passwordExpiresAt < new Date()) {
      return res.status(403).json({ 
        error: 'Tu contraseña ha expirado. Por favor, solicita al administrador un reinicio o cámbiala.',
        passwordExpired: true 
      });
    }

    await prisma.$executeRaw`
      UPDATE "users"
      SET "failedLoginAttempts" = 0,
          "lockUntil" = NULL,
          "lastLoginAttempt" = ${new Date()}
      WHERE "id" = ${user.id}
    `;

    // Verificar si debe cambiar la contraseña
    if (user.mustChangePassword) {
      const tempToken = jwt.sign(
        {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          permissions: user.permissions,
          tokenVersion: user.tokenVersion,
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' } // 5 minutos temporal
      );
      return res.status(403).json({
        error: 'Debes cambiar tu contraseña antes de continuar',
        mustChangePassword: true,
        accessToken: tempToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        }
      });
    }

    const sessionExpiresIn = secSettings.sessionTimeoutMinutes
      ? `${secSettings.sessionTimeoutMinutes}m`
      : (process.env.JWT_EXPIRES_IN || '4h');

    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET,
      { expiresIn: sessionExpiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user.id, tokenVersion: user.tokenVersion },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const sessionMs = secSettings.sessionTimeoutMinutes
      ? secSettings.sessionTimeoutMinutes * 60 * 1000
      : 4 * 60 * 60 * 1000;
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: sessionMs });

    // Registrar login en historial
    try {
      await prisma.transactionHistory.create({
        data: {
          type: 'LOGIN',
          description: `Inicio de sesión: ${user.username}`,
          amount: 0,
          userName: user.name || user.username,
          categoryName: 'Autenticación',
        },
      });
    } catch (logError) {
      logger.error('Error registrando login en historial', { error: logError.message });
    }

    res.json({
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    logger.error('Error en login', { error: error.message });
    if (process.env.NODE_ENV === 'development') logger.debug(error.stack);
    res.status(500).json({ error: 'Error interno del servidor', message: process.env.NODE_ENV === 'development' ? (error.message || String(error)) : undefined });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token requerido' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no válido' });
    }

    // ROTACIÓN: verificar que el tokenVersion coincida
    if (decoded.tokenVersion !== user.tokenVersion) {
      // Posible robo de token - incrementar versión para invalidar todos los tokens
      await prisma.user.update({
        where: { id: user.id },
        data: { tokenVersion: { increment: 1 } },
      });
      return res.status(401).json({ error: 'Token reutilizado. Sesión invalidada por seguridad.' });
    }

    // Incrementar tokenVersion para invalidar el refresh token usado
    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const secSettings = await getSecuritySettings();
    const sessionExpiresIn = secSettings.sessionTimeoutMinutes
      ? `${secSettings.sessionTimeoutMinutes}m`
      : (process.env.JWT_EXPIRES_IN || '4h');

    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
        tokenVersion: user.tokenVersion + 1,
      },
      process.env.JWT_SECRET,
      { expiresIn: sessionExpiresIn }
    );

    const newRefreshToken = jwt.sign(
      { id: user.id, tokenVersion: user.tokenVersion + 1 },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
    );

    const isProduction = process.env.NODE_ENV === 'production';
    const sessionMs = secSettings.sessionTimeoutMinutes
      ? secSettings.sessionTimeoutMinutes * 60 * 1000
      : 4 * 60 * 60 * 1000;
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    };

    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: sessionMs });
    res.cookie('refreshToken', newRefreshToken, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expirado' });
    }
    res.status(401).json({ error: 'Refresh token inválido' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error al obtener perfil', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!newPassword) {
      return res.status(400).json({ error: 'La nueva contraseña es requerida' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumbers = /\d/.test(newPassword);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const complexityScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

    if (complexityScore < 3) {
      return res.status(400).json({
        error: 'La contraseña debe incluir al menos 3 de: mayúscula, minúscula, número, carácter especial'
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Contraseña actual es requerida' });
      }
      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordExpiresAt: user.passwordNeverExpires
          ? null : new Date(Date.now() + (user.passwordExpirationDays || 90) * 24 * 60 * 60 * 1000),
        lastPasswordChange: new Date(),
        tokenVersion: { increment: 1 },
      },
    });

    res.json({ message: 'Contraseña cambiada exitosamente. Vuelve a iniciar sesión.' });
  } catch (error) {
    logger.error('Error al cambiar contraseña', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const verifyAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const adminUser = await prisma.user.findFirst({
      where: { username: username.toLowerCase(), active: true, role: 'ADMIN' }
    });

    if (!adminUser) {
      return res.status(403).json({ error: 'Usuario autorizador no encontrado o no tiene rol de ADMIN' });
    }

    const isPasswordValid = await bcrypt.compare(password, adminUser.password);
    if (!isPasswordValid) {
      return res.status(403).json({ error: 'Contraseña de administrador incorrecta' });
    }

    res.json({ success: true, message: 'Autorizado correctamente' });
  } catch (error) {
    logger.error('Error en verifyAdmin', { error: error.message });
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
