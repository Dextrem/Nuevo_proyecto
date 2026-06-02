import { Router } from 'express';
import {
  getAllBudgets,
  getBudgetById,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetSummary,
  getBudgetExecution,
} from '../controllers/budgetController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.get('/summary', authenticateToken, getBudgetSummary);
router.get('/execution', authenticateToken, getBudgetExecution);
router.get('/', authenticateToken, getAllBudgets);
router.get('/:id', authenticateToken, getBudgetById);
router.post('/', authenticateToken, requirePermission('manage_budgets'), validate(schemas.budget), createBudget);
router.put('/:id', authenticateToken, requirePermission('manage_budgets'), validate(schemas.budget), updateBudget);
router.delete('/:id', authenticateToken, requirePermission('manage_budgets'), deleteBudget);

export default router;
