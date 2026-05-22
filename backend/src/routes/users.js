import { Router } from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', requireRole('ADMIN', 'MANAGER'), getAllUsers);
router.get('/:id', requireRole('ADMIN', 'MANAGER'), getUserById);
router.post('/', requireRole('ADMIN', 'MANAGER'), validate(schemas.createUser), createUser);
router.put('/:id', requireRole('ADMIN', 'MANAGER'), validate(schemas.updateUser), updateUser);
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), deleteUser);

export default router;
