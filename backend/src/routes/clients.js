import { Router } from 'express';
import {
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  recordPayment,
} from '../controllers/clientController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllClients);
router.get('/:id', getClientById);
router.post('/', requirePermission('manage_clients'), validate(schemas.client), createClient);
router.put('/:id', requirePermission('manage_clients'), validate(schemas.client), updateClient);
router.delete('/:id', requirePermission('manage_clients'), deleteClient);
router.post('/:id/payment', requirePermission('record_payments'), recordPayment);

export default router;
