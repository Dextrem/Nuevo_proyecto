import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getAllTransactionsHistory } from '../controllers/transactionHistoryController.js';

const router = Router();

router.get('/', authenticateToken, getAllTransactionsHistory);

export default router;
