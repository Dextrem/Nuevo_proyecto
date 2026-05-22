import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.post('/', requirePermission('manage_categories'), validate(schemas.category), createCategory);
router.put('/:id', requirePermission('manage_categories'), validate(schemas.category), updateCategory);
router.delete('/:id', requirePermission('manage_categories'), deleteCategory);

export default router;
