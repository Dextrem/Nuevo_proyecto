import { Router } from 'express';
import {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  convertToSale,
} from '../controllers/quotationController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllQuotations);
router.get('/:id', getQuotationById);
router.post('/', requirePermission('process_sales'), createQuotation);
router.put('/:id', requirePermission('process_sales'), updateQuotation);
router.delete('/:id', requirePermission('process_sales'), deleteQuotation);
router.post('/:id/convert', requirePermission('process_sales'), convertToSale);

export default router;
