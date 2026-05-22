import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  resetSettings,
} from '../controllers/settingsController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getSettings);
router.put('/', requireRole('ADMIN'), validate(schemas.settings), updateSettings);
router.post('/reset', requireRole('ADMIN'), resetSettings);

export default router;
