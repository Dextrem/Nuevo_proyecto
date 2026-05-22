import express from 'express';
import {
  getCashRegisters,
  getCashRegister,
  openCashRegister,
  addTransaction,
  closeCashRegister,
  getOpenRegisters,
  getCurrentUserRegister
} from '../controllers/cashRegisterController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all cash registers
router.get('/', getCashRegisters);

// Get open registers
router.get('/open', getOpenRegisters);

// Get current user's register
router.get('/current', getCurrentUserRegister);

// Get specific register
router.get('/:id', getCashRegister);

// Open new cash register
router.post('/open', openCashRegister);

// Add transaction to register
router.post('/transaction', addTransaction);

// Close cash register
router.put('/:id/close', closeCashRegister);

export default router;