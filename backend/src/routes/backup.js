import { Router } from 'express';
import { exportBackup, importBackup, scheduleBackup } from '../controllers/backupController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/export', requireRole('ADMIN'), exportBackup);
router.post('/import', requireRole('ADMIN'), importBackup);
router.post('/schedule', requireRole('ADMIN'), scheduleBackup);

export default router;
