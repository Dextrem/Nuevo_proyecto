import { Router } from 'express';
import {
  getSequences,
  createSequence,
  updateSequence,
  deleteSequence,
  getFiscalStatus,
  getSalesFiscalReport,
  getPurchasesFiscalReport,
} from '../controllers/fiscalController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

router.get('/status', getFiscalStatus);
router.get('/report/sales', getSalesFiscalReport);
router.get('/report/purchases', getPurchasesFiscalReport);
router.get('/sequences', getSequences);
router.post('/sequences', requirePermission('manage_settings'), createSequence);
router.put('/sequences/:id', requirePermission('manage_settings'), updateSequence);
router.delete('/sequences/:id', requirePermission('manage_settings'), deleteSequence);

export default router;
