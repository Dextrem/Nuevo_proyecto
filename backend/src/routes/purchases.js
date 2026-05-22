import { Router } from 'express';
import { getPurchases, createPurchase } from '../controllers/purchaseController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requirePermission('manage_inventory'), getPurchases);
router.post('/', requirePermission('manage_inventory'), createPurchase);

export default router;
