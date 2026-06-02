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
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllQuotations);
router.get('/:id', getQuotationById);
router.post('/', requirePermission('process_sales'), validate(schemas.quotation), createQuotation);
router.put('/:id', requirePermission('process_sales'), validate(schemas.quotation), updateQuotation);
router.delete('/:id', requirePermission('process_sales'), deleteQuotation);
router.post('/:id/convert', requirePermission('process_sales'), convertToSale);

export default router;
