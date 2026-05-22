import { Router } from 'express';
import {
  createMonthlyClosing,
  getAllClosings,
  getClosingById,
  getClosingByMonth,
  getCurrentMonthStatus,
  deleteClosing,
  getClosingReport,
  getCompanyStatus,
  getOpeningBalances,
} from '../controllers/monthlyClosingController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Rutas específicas primero (orden importante)
router.get('/', getAllClosings);
router.get('/status', getCurrentMonthStatus);
router.get('/company-status', getCompanyStatus);
router.get('/opening-balances', getOpeningBalances);
router.get('/report', getClosingReport);
router.get('/report/:year/:month', getClosingReport);

// Rutas dinámicas después
router.get('/:year/:month', getClosingByMonth);
router.get('/:id', getClosingById);

// CRUD
router.post('/', requireRole('ADMIN', 'MANAGER'), createMonthlyClosing);
router.delete('/:id', requireRole('ADMIN'), deleteClosing);

export default router;
