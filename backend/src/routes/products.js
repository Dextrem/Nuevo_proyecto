import { Router } from 'express';
import {
  getAllProducts,
  getProductSummary,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getKardex,
  uploadImage,
} from '../controllers/productController.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validate.js';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'products');
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'), false);
    }
  }
});

router.use(authenticateToken);

router.get('/summary', getProductSummary);
router.get('/', getAllProducts);
router.get('/:id', getProductById);
router.post('/', requirePermission('manage_products'), validate(schemas.product), createProduct);
router.put('/:id', requirePermission('manage_products'), validate(schemas.product), updateProduct);
router.delete('/:id', requirePermission('manage_products'), deleteProduct);
router.patch('/:id/stock', requirePermission('manage_inventory'), updateStock);
router.get('/:id/kardex', getKardex);
// Image upload route
router.post('/:id/image', requirePermission('manage_products'), upload.single('image'), uploadImage);

export default router;
