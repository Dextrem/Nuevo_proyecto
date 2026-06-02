import { Router } from 'express';
import { getPurchases, createPurchase } from '../controllers/purchaseController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('manage_inventory'), getPurchases);
router.post('/', requirePermission('manage_inventory'), validate(schemas.purchaseOrder), createPurchase);

export default router;
