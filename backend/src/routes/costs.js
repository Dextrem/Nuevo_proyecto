import { Router } from 'express';
import {
  getCostsReport,
  getProductCostAnalysis,
  getProfitAndLoss,
  getCostsByCategory,
  getCostTrend
} from '../controllers/costController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getCostsReport);
router.get('/product/:productId', getProductCostAnalysis);
router.get('/profit-loss', getProfitAndLoss);
router.get('/by-category', getCostsByCategory);
router.get('/trend', getCostTrend);

export default router;
