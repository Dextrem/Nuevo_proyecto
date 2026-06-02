import { Router } from 'express';
import { getAllWarranties, createWarranty, deleteWarranty } from '../controllers/warrantyController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllWarranties);
router.post('/', requirePermission('process_sales'), validate(schemas.warranty), createWarranty);
router.delete('/:id', requirePermission('process_sales'), deleteWarranty);

export default router;
