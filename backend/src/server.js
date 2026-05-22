import express from 'express';
import compression from 'compression';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';
import prisma from './config/database.js';
import { logger, requestLogger } from './utils/logger.js';

import { generalLimiter } from './middleware/rateLimiter.js';
import { startScheduler } from './services/scheduler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import categoryRoutes from './routes/categories.js';
import productRoutes from './routes/products.js';
import clientRoutes from './routes/clients.js';
import supplierRoutes from './routes/suppliers.js';
import transactionRoutes from './routes/transactions.js';
import saleRoutes from './routes/sales.js';
import quotationRoutes from './routes/quotations.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';
import backupRoutes from './routes/backup.js';
import financialReportsRoutes from './routes/financialReports.js';
import cashRegisterRoutes from './routes/cashRegisters.js';
import costRoutes from './routes/costs.js';
import monthlyClosingRoutes from './routes/monthlyClosings.js';
import commissionRoutes from './routes/commissions.js';
import transactionsHistoryRoutes from './routes/transactionsHistory.js';
import budgetRoutes from './routes/budgets.js';
import purchaseRoutes from './routes/purchases.js';
import fiscalRoutes from './routes/fiscal.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Serve static files from uploads directory
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(requestLogger);
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: false, // Desactivar HSTS para evitar que fuerce HTTPS en IP local
}));
// Helper to check if a hostname/IP is a local/private network address
const isLocalIP = (hostname) => {
  if (hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]') return true;
  
  // Check IPv4 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
  const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const p1 = parseInt(ipv4Match[1], 10);
    const p2 = parseInt(ipv4Match[2], 10);
    if (p1 === 10) return true;
    if (p1 === 172 && p2 >= 16 && p2 <= 31) return true;
    if (p1 === 192 && p2 === 168) return true;
    if (p1 === 169 && p2 === 254) return true;
  }
  
  // Check IPv6 link-local or unique local addresses
  if (hostname.startsWith('fe80:') || hostname.startsWith('[fe80:')) return true;
  if (hostname.startsWith('fc00:') || hostname.startsWith('[fc00:') || hostname.startsWith('fd00:') || hostname.startsWith('[fd00:')) return true;
  
  return false;
};

const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    // Si no hay origin (mismo origen, curl, etc.) se permite
    if (!origin) {
      return callback(null, true);
    }
    
    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname.toLowerCase();
      const serverName = os.hostname().toLowerCase();
      
      if (
        hostname === 'dextremix.local' ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.local') ||
        hostname === serverName ||
        isLocalIP(hostname)
      ) {
        return callback(null, true);
      }
    } catch (e) {}

    // Si está configurado expresamente en .env
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin === '*' || corsOrigin === 'true') {
      return callback(null, true);
    } else if (corsOrigin) {
      const allowed = corsOrigin.split(',').map(o => o.trim().toLowerCase());
      if (allowed.includes(origin.toLowerCase())) {
        return callback(null, true);
      }
    }

    callback(new Error('No permitido por CORS'));
  }
};
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Host security check
app.use((req, res, next) => {
  const host = req.headers.host || '';
  const hostname = host.split(':')[0].toLowerCase();
  const serverName = os.hostname().toLowerCase();
  
  if (
    hostname === 'dextremix.local' || 
    hostname === 'localhost' || 
    hostname === '127.0.0.1' ||
    hostname.endsWith('.local') ||
    hostname === serverName ||
    isLocalIP(hostname)
  ) {
    next();
  } else {
    logger.warn(`⚠️ Intento de acceso no autorizado al host: ${host} desde IP: ${req.ip}`);
    res.status(403).json({ error: 'Acceso denegado: use http://localhost:3000 o http://dextremix.local para acceder.' });
  }
});

app.use(generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/financial-reports', financialReportsRoutes);
app.use('/api/cash-registers', cashRegisterRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/monthly-closings', monthlyClosingRoutes);
app.use('/api/commissions', commissionRoutes);
app.use('/api/transactions-history', transactionsHistoryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/fiscal', fiscalRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  if (err.code === 'P2002') {
    return res.status(400).json({ 
      error: 'Ya existe un registro con estos datos únicos' 
    });
  }
  
  if (err.code === 'P2025') {
    return res.status(404).json({ 
      error: 'Registro no encontrado' 
    });
  }

  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.use((req, res, next) => {
  if (IS_PRODUCTION && !req.path.startsWith('/api')) {
    return next();
  }
  res.status(404).json({ error: 'Ruta no encontrada' });
});

if (IS_PRODUCTION) {
  const frontendPath = path.join(__dirname, '../../frontend/dist');
  // Cache de 1 día para archivos estáticos (JS, CSS, Imágenes)
  app.use(express.static(frontendPath, {
    maxAge: '1d',
    etag: true
  }));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint no encontrado' });
    }
  });
}

const ensureAdminUser = async () => {
  try {
    const adminPassword = await bcrypt.hash('admin', 12);
    const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
    
    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@dextremix.local',
          password: adminPassword,
          name: 'Administrador',
          role: 'ADMIN',
          active: true,
          mustChangePassword: true,
          permissions: {
            manage_users: true, manage_products: true, manage_categories: true,
            manage_clients: true, manage_suppliers: true, manage_accounting: true,
            manage_inventory: true, process_sales: true, record_payments: true,
            view_reports: true, manage_settings: true, manage_budgets: true
          }
        }
      });
      console.log('-------------------------------------------');
      console.log('⚠️  USUARIO ADMIN CREADO. DEBE CAMBIAR LA CONTRASEÑA EN EL PRIMER INICIO.');
      console.log('   Usuario: admin / Contraseña: admin');
      console.log('-------------------------------------------');
    } else {
      console.log('-------------------------------------------');
      console.log('✅ Usuario admin ya existe');
      console.log('-------------------------------------------');
    }
  } catch (error) {
    logger.error('Error al asegurar usuario admin:', error.message);
  }
};

const findFreePort = (startPort, maxAttempts = 10) => {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          const next = port + 1;
          if (next > startPort + maxAttempts) {
            reject(new Error(`No se encontró puerto libre después de ${maxAttempts} intentos`));
          } else {
            tryPort(next);
          }
        } else {
          reject(err);
        }
      });
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, '0.0.0.0');
    };
    tryPort(startPort);
  });
};

const startServer = async () => {
  try {
    const pidFile = path.join(process.env.TEMP || os.tmpdir(), 'finandex_backend.pid');
    try { fs.writeFileSync(pidFile, String(process.pid)); } catch {}

    const portFile = path.join(process.env.TEMP || os.tmpdir(), 'finandex_port.txt');
    const actualPort = await findFreePort(PORT);
    if (actualPort !== PORT) {
      logger.warn(`Puerto ${PORT} ocupado, usando puerto ${actualPort}`);
    }
    try { fs.writeFileSync(portFile, String(actualPort)); } catch {}

    await prisma.$connect();
    logger.info('Conexión a base de datos establecida');
    await ensureAdminUser();
    startScheduler();
    
    app.listen(actualPort, '0.0.0.0', () => {
      logger.info(`Servidor corriendo en http://0.0.0.0:${actualPort}`);
      logger.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`API disponible en: http://localhost:${actualPort}/api`);
    });
  } catch (error) {
    logger.error('Error al iniciar el servidor:', { error: error.message });
    process.exit(1);
  }
};

const cleanup = async () => {
  const pidFile = path.join(process.env.TEMP || os.tmpdir(), 'dextremix_backend.pid');
  const portFile = path.join(process.env.TEMP || os.tmpdir(), 'dextremix_port.txt');
  try { fs.unlinkSync(pidFile); } catch {}
  try { fs.unlinkSync(portFile); } catch {}
  await prisma.$disconnect();
};

process.on('SIGINT', async () => {
  logger.info('Cerrando servidor...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Cerrando servidor...');
  await cleanup();
  process.exit(0);
});

process.on('uncaughtException', async (err) => {
  logger.error('Error no capturado:', err.message);
  await cleanup();
  process.exit(1);
});

startServer();
