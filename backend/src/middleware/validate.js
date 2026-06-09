import { z } from 'zod';
import { sanitizeString } from './validation.js';

const sanitizedString = (min, max) => 
  z.string().min(min).max(max).transform(sanitizeString);

const sanitizedOptionalString = (max) => 
  z.string().max(max).optional().transform(val => {
    if (!val || typeof val !== 'string') return undefined;
    const sanitized = sanitizeString(val);
    return sanitized || undefined;
  });

export const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return res.status(400).json({ 
          error: `Datos inválidos: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`, 
          details: errors 
        });
      }
      next(error);
    }
  };
};

export const schemas = {
  register: z.object({
    username: sanitizedString(3, 30),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    name: sanitizedOptionalString(100),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']).optional(),
  }),

  login: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),

  createUser: z.object({
    username: sanitizedString(3, 30),
    email: z.string().email(),
    password: z.string().min(6).max(100),
    name: z.string().min(1, "El nombre es requerido").max(100).transform(sanitizeString),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']).optional(),
    permissions: z.any().optional(),
    passwordExpirationDays: z.any().optional(),
    passwordNeverExpires: z.any().optional(),
  }),

  updateUser: z.object({
    username: sanitizedString(3, 30).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).max(100).optional(),
    name: sanitizedOptionalString(100).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']).optional(),
    permissions: z.any().optional(),
    active: z.boolean().optional(),
    passwordExpirationDays: z.any().optional(),
    passwordNeverExpires: z.any().optional(),
  }),

  category: z.object({
    name: sanitizedString(1, 100),
    description: sanitizedOptionalString(500),
  }),

   product: z.object({
     name: sanitizedString(1, 200),
     description: sanitizedOptionalString(1000).optional().nullable(),
     sku: z.preprocess(val => val === '' ? null : val, sanitizedOptionalString(50).optional().nullable()),
     barcode: z.preprocess(val => val === '' ? null : val, sanitizedOptionalString(50).optional().nullable()),
     price: z.number().positive(),
     cost: z.number().min(0).optional(),
     stock: z.number().int().min(0).optional(),
     minStock: z.number().int().min(0).optional(),
     categoryId: z.preprocess(val => val === '' ? null : val, z.string().uuid().optional().nullable()),
     active: z.boolean().optional(),
     imageUrl: z.string().url().optional().nullable(),
     imagePath: z.string().optional().nullable(),
   }),

  client: z.object({
    name: sanitizedString(1, 200),
    email: z.preprocess(val => val === '' ? null : val, z.string().email().optional().nullable()),
    phone: sanitizedOptionalString(20).optional().nullable(),
    rnc: sanitizedOptionalString(20).optional().nullable(),
    address: sanitizedOptionalString(500).optional().nullable(),
    creditLimit: z.number().min(0).optional(),
    active: z.boolean().optional(),
  }),

  supplier: z.object({
    name: sanitizedString(1, 200),
    email: z.preprocess(val => val === '' ? null : val, z.string().email().optional().nullable()),
    phone: sanitizedOptionalString(20).optional().nullable(),
    rnc: sanitizedOptionalString(20).optional().nullable(),
    address: sanitizedOptionalString(500).optional().nullable(),
    contact: sanitizedOptionalString(100).optional().nullable(),
    balance: z.number().min(0).optional(),
    active: z.boolean().optional(),
  }),

  supplierInvoice: z.object({
    invoiceNumber: sanitizedOptionalString(50).optional().nullable(),
    description: sanitizedString(1, 500),
    amount: z.number().positive(),
    dueDate: z.string().optional().nullable(),
    paid: z.boolean().optional(),
    paidAmount: z.number().min(0).optional(),
    paidDate: z.string().optional().nullable(),
    document: z.string().optional().nullable(),
    documentName: sanitizedOptionalString(200).optional().nullable(),
    notes: sanitizedOptionalString(1000).optional().nullable(),
  }),

  transaction: z.object({
    type: z.enum(['INCOME', 'EXPENSE']),
    amount: z.number().positive(),
    description: sanitizedString(1, 500),
    reference: sanitizedOptionalString(100).optional().nullable(),
  }),

  sale: z.object({
    clientId: z.preprocess(val => val === '' ? null : val, z.string().optional().nullable()),
    paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT', 'TRANSFER']),
    paidAmount: z.number().min(0),
    ncfType: z.string().optional().nullable(),
    discount: z.number().min(0).optional(),
    shippingCost: z.number().min(0).optional(),
    dueDate: z.string().optional().nullable(),
    hasWarranty: z.boolean().optional(),
    warrantyData: z.object({
      days: z.number().int().positive().optional(),
      coverage: z.string().optional().nullable(),
      exclusions: z.string().optional().nullable(),
      issueDate: z.string().optional().nullable(),
      expiryDate: z.string().optional().nullable(),
    }).optional().nullable(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      tax: z.number().min(0),
      discount: z.number().min(0).optional(),
      total: z.number().positive().optional(),
    })).min(1),
  }),

  quotation: z.object({
    clientId: z.preprocess(val => val === '' ? null : val, z.string().optional().nullable()),
    clientName: sanitizedOptionalString(200).optional().nullable(),
    clientRnc: sanitizedOptionalString(20).optional().nullable(),
    clientPhone: sanitizedOptionalString(20).optional().nullable(),
    clientAddress: sanitizedOptionalString(500).optional().nullable(),
    clientEmail: z.preprocess(val => val === '' ? null : val, z.string().email().optional().nullable()),
    paymentMethod: sanitizedOptionalString(20).optional().nullable(),
    deliveryTime: sanitizedOptionalString(100).optional().nullable(),
    warranty: sanitizedOptionalString(500).optional().nullable(),
    notes: sanitizedOptionalString(1000).optional().nullable(),
    validityDays: z.number().int().min(1).max(365).optional(),
    discount: z.number().min(0).optional(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().positive(),
      tax: z.number().min(0),
      discount: z.number().min(0).optional(),
      total: z.number().positive().optional(),
    })).min(1),
  }),

  budget: z.object({
    category: sanitizedString(1, 100),
    type: z.enum(['income', 'expense']).optional(),
    plannedAmount: z.number().positive(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(1).max(12),
  }),

  warranty: z.object({
    clientId: z.preprocess(val => val === '' ? null : val, z.string().optional().nullable()),
    clientName: sanitizedString(1, 200),
    clientRnc: sanitizedOptionalString(20).optional().nullable(),
    clientPhone: sanitizedOptionalString(20).optional().nullable(),
    days: z.number().int().positive(),
    coverage: sanitizedOptionalString(2000).optional().nullable(),
    exclusions: sanitizedOptionalString(2000).optional().nullable(),
    saleId: z.preprocess(val => val === '' ? null : val, z.string().optional().nullable()),
    issueDate: z.string().optional().nullable(),
    expiryDate: z.string().optional(),
  }),

  purchaseOrder: z.object({
    supplierId: z.string(),
    notes: sanitizedOptionalString(1000).optional().nullable(),
    items: z.array(z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitCost: z.number().positive(),
      total: z.number().positive().optional(),
    })).min(1),
  }),

  settings: z.object({
    companyName: sanitizedOptionalString(200).optional(),
    companyRnc: sanitizedOptionalString(20).optional().nullable(),
    companyAddress: sanitizedOptionalString(500).optional().nullable(),
    companyPhone: sanitizedOptionalString(20).optional().nullable(),
    companyEmail: z.preprocess(val => val === '' ? null : val, z.string().email().optional().nullable()),
    logo: z.string().optional().nullable(),
    currency: z.string().max(10).optional(),
    currencySymbol: z.string().max(5).optional(),
    taxRate: z.number().min(0).max(1).optional(),
    interestRate: z.number().min(0).max(1).optional(),
    theme: z.enum(['light', 'dark']).optional(),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    // Commissions
    commissionRate: z.number().min(0).max(1).optional(),
    commissionMinAmount: z.number().min(0).optional(),
    commissionType: z.enum(['BY_SALE', 'ACCUMULATED']).optional(),
    // Security
    sessionTimeoutMinutes: z.number().int().min(5).max(480).optional(),
    maxLoginAttempts: z.number().int().min(1).max(20).optional(),
    lockoutDurationMinutes: z.number().int().min(1).max(1440).optional(),
    defaultPasswordExpDays: z.number().int().min(7).max(365).optional(),
    // POS / Sales
    defaultCreditLimit: z.number().min(0).optional(),
    allowNegativeStock: z.boolean().optional(),
    receiptFooterMessage: sanitizedOptionalString(500).optional().nullable(),
    requireCashRegister: z.boolean().optional(),
    // Inventory
    lowStockAlertEnabled: z.boolean().optional(),
    defaultMinStock: z.number().int().min(0).optional(),
    // Fiscal
    fiscalEnabled: z.boolean().optional(),
    defaultNcfType: z.string().max(5).optional(),
    // Warranty Settings
    warrantyEnabled: z.boolean().optional(),
    warrantyMinAmount: z.number().min(0).optional(),
    warrantyDefaultDays: z.number().int().min(1).max(3650).optional(),
    warrantyCoverageText: z.string().optional().nullable(),
    warrantyExclusionText: z.string().optional().nullable(),
    // Financial Closing Settings
    provisionOverduePercent: z.number().min(0).max(1).optional(),
    provisionOver90Percent: z.number().min(0).max(1).optional(),
    expenseKeywordsOperational: z.string().optional(),
    expenseKeywordsAdministrative: z.string().optional(),
    expenseKeywordsFinancial: z.string().optional(),
    expenseKeywordsDepreciation: z.string().optional(),
    statusThresholdAlertOver90: z.number().min(0).max(1).optional(),
    statusThresholdPrecautionOver90: z.number().min(0).max(1).optional(),
    statusThresholdPrecautionNetIncome: z.number().min(0).max(1).optional(),
    statusThresholdCurrentRatio: z.number().min(0).max(10).optional(),
  }),
};
