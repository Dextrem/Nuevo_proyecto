import { Router } from 'express';
import {
  getAllSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierInvoices,
  createSupplierInvoice,
  updateSupplierInvoice,
  deleteSupplierInvoice,
  recordSupplierPayment,
} from '../controllers/supplierController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';

const router = Router();

router.use(authenticateToken);

router.get('/', getAllSuppliers);
router.get('/:id', getSupplierById);
router.post('/', requirePermission('manage_suppliers'), validate(schemas.supplier), createSupplier);
router.put('/:id', requirePermission('manage_suppliers'), validate(schemas.supplier), updateSupplier);
router.delete('/:id', requirePermission('manage_suppliers'), deleteSupplier);

router.get('/:id/invoices', getSupplierInvoices);
router.post('/:id/invoices', requirePermission('manage_suppliers'), validate(schemas.supplierInvoice), createSupplierInvoice);
router.put('/:id/invoices/:invoiceId', requirePermission('manage_suppliers'), validate(schemas.supplierInvoice), updateSupplierInvoice);
router.delete('/:id/invoices/:invoiceId', requirePermission('manage_suppliers'), deleteSupplierInvoice);
router.post('/:id/payment', requirePermission('manage_accounting'), recordSupplierPayment);

export default router;
