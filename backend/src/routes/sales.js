import { Router } from 'express';
import {
  getAllSales,
  getSaleById,
  createSale,
  cancelSale,
  getDailySales,
  getAccountsReceivable,
  updateSalePayment,
  getCreditSalesSummary,
  incrementPrintCount,
  getPendingPayments,
  approvePendingPayment,
  rejectPendingPayment,
} from '../controllers/saleController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllSales);
router.get('/daily', getDailySales);
router.get('/accounts-receivable', getAccountsReceivable);
router.get('/credit-summary', getCreditSalesSummary);
router.get('/pending-payments', requirePermission('manage_accounts_receivable'), getPendingPayments);
router.post('/pending-payments/:id/approve', requirePermission('manage_accounts_receivable'), approvePendingPayment);
router.post('/pending-payments/:id/reject', requirePermission('manage_accounts_receivable'), rejectPendingPayment);
router.get('/:id', getSaleById);
router.post('/', requirePermission('process_sales'), validate(schemas.sale), createSale);
router.patch('/:id/print', incrementPrintCount);
router.patch('/:id/payment', requirePermission('process_sales'), updateSalePayment);
router.patch('/:id/cancel', requirePermission('process_sales'), cancelSale);

export default router;
