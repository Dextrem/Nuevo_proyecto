import { Router } from 'express';
import {
  getDashboardStats,
  getSalesReport,
  getInventoryReport,
  getFinancialReport,
  getSalesByProductReport,
} from '../controllers/reportController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/dashboard', getDashboardStats);
router.get('/sales', getSalesReport);
router.get('/inventory', getInventoryReport);
router.get('/financial', getFinancialReport);
router.get('/sales-by-product', getSalesByProductReport);

export default router;
