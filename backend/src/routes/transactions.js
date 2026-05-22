import { Router } from 'express';
import {
  getAllTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
} from '../controllers/transactionController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllTransactions);
router.get('/summary', getTransactionSummary);
router.post('/', requirePermission('manage_accounting'), validate(schemas.transaction), createTransaction);
router.put('/:id', requirePermission('manage_accounting'), validate(schemas.transaction), updateTransaction);
router.delete('/:id', requirePermission('manage_accounting'), deleteTransaction);

export default router;
