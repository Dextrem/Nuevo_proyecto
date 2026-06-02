import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

const onTokenRefreshed = (token) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = sessionStorage.getItem('refreshToken');
      const isLoginRoute = originalRequest.url?.includes('/auth/login');
      const isLoginPage = window.location.pathname === '/login';
      const isAuthRoute = originalRequest.url?.includes('/auth');

      // On login attempts, don't redirect — let the error reach the login form
      if (isLoginRoute) {
        return Promise.reject(error);
      }

      // If we cannot refresh, force logout with feedback
      if (!refreshToken || isLoginPage || isAuthRoute) {
        // Already on login page — just return error silently (no redirect loop)
        if (isLoginPage) {
          return Promise.reject(error);
        }
        // Auth routes — let the error propagate normally
        if (isAuthRoute) {
          return Promise.reject(error);
        }
        // No refresh token — redirect to login without misleading "session expired" alert
        if (!refreshToken) {
          sessionStorage.clear();
          window.location.replace('/login');
          return Promise.reject(error);
        }
      }

      // Mark request to avoid infinite loops
      originalRequest._retry = true;

      // If a refresh is already in progress, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api(originalRequest));
            } else {
              reject(new Error('Token refresh failed'));
            }
          });
        });
      }

      // Start token refresh
      isRefreshing = true;
      try {
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken } = response.data;
        sessionStorage.setItem('accessToken', accessToken);
        onTokenRefreshed(accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed – clear everything and redirect
        onTokenRefreshed(null);
        sessionStorage.clear();
        if (typeof window.showToast === 'function') {
          window.showToast('Sesión expiró, por favor inicie sesión nuevamente.', 'error');
        } else {
          alert('Sesión expiró, por favor inicie sesión nuevamente.');
        }
        window.location.replace('/login');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authService = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  register: (data) => api.post('/auth/register', data),
  getProfile: () => api.get('/auth/profile'),
  refreshToken: (refreshToken) =>
    api.post('/auth/refresh', { refreshToken }),
  verifyAdmin: (username, password) => 
    api.post('/auth/verify-admin', { username, password }),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const userService = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getSummary: () => api.get('/products/summary'),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  updateStock: (id, data) => api.patch(`/products/${id}/stock`, data),
  getKardex: (id) => api.get(`/products/${id}/kardex`),
  uploadImage: (id, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.post(`/products/${id}/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export const categoryService = {
  getAll: () => api.get('/categories'),
  getById: (id) => api.get(`/categories/${id}`),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

export const clientService = {
  getAll: (params) => api.get('/clients', { params }),
  getById: (id) => api.get(`/clients/${id}`),
  create: (data) => api.post('/clients', data),
  update: (id, data) => api.put(`/clients/${id}`, data),
  delete: (id) => api.delete(`/clients/${id}`),
  recordPayment: (id, data) => api.post(`/clients/${id}/payment`, data),
};

export const supplierService = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getInvoices: (id, params) => api.get(`/suppliers/${id}/invoices`, { params }),
  createInvoice: (id, data) => api.post(`/suppliers/${id}/invoices`, data),
  updateInvoice: (id, invoiceId, data) => api.put(`/suppliers/${id}/invoices/${invoiceId}`, data),
  deleteInvoice: (id, invoiceId) => api.delete(`/suppliers/${id}/invoices/${invoiceId}`),
  recordPayment: (id, data) => api.post(`/suppliers/${id}/payment`, data),
};

export const transactionService = {
  getAll: (params) => api.get('/transactions', { params }),
  getSummary: (params) => api.get('/transactions/summary', { params }),
  create: (data) => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id) => api.delete(`/transactions/${id}`),
};

export const saleService = {
  getAll: (params) => api.get('/sales', { params }),
  getDaily: () => api.get('/sales/daily'),
  getById: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  cancel: (id, data) => api.patch(`/sales/${id}/cancel`, data),
  getAccountsReceivable: (params) => api.get('/sales/accounts-receivable', { params }),
  getCreditSalesSummary: (params) => api.get('/sales/credit-summary', { params }),
  updatePayment: (id, data) => api.patch(`/sales/${id}/payment`, data),
  incrementPrint: (id) => api.patch(`/sales/${id}/print`),
  getPendingPayments: () => api.get('/sales/pending-payments'),
  approvePendingPayment: (id) => api.post(`/sales/pending-payments/${id}/approve`),
  rejectPendingPayment: (id) => api.post(`/sales/pending-payments/${id}/reject`),
};

export const quotationService = {
  getAll: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  delete: (id) => api.delete(`/quotations/${id}`),
  convertToSale: (id, data) => api.post(`/quotations/${id}/convert`, data),
};

export const reportService = {
  getDashboard: () => api.get('/reports/dashboard'),
  getSalesReport: (params) => api.get('/reports/sales', { params }),
  getSalesByProductReport: (params) => api.get('/reports/sales-by-product', { params }),
  getInventoryReport: (params) => api.get('/reports/inventory', { params }),
  getFinancialReport: (params) => api.get('/reports/financial', { params }),
};

export const financialReportService = {
  getAccountsReceivable: () => api.get('/financial-reports/accounts-receivable'),
  getAccountsPayable: () => api.get('/financial-reports/accounts-payable'),
  getAccounting: (params) => api.get('/financial-reports/accounting', { params }),
  getCompanyStatus: () => api.get('/financial-reports/company-status'),
};

export const cashRegisterService = {
  getAll: () => api.get('/cash-registers'),
  getOpen: () => api.get('/cash-registers/open'),
  getCurrent: () => api.get('/cash-registers/current'),
  getById: (id) => api.get(`/cash-registers/${id}`),
  open: (data) => api.post('/cash-registers/open', data),
  addTransaction: (data) => api.post('/cash-registers/transaction', data),
  close: (id, data) => api.put(`/cash-registers/${id}/close`, data),
};

export const settingsService = {
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  reset: () => api.post('/settings/reset'),
};

export const backupService = {
  export: () => api.get('/backup/export'),
  import: (data) => api.post('/backup/import', data),
  schedule: () => api.post('/backup/schedule'),
};

export const costService = {
  getReport: (params) => api.get('/costs', { params }),
  getProductAnalysis: (productId, params) => api.get(`/costs/product/${productId}`, { params }),
  getProfitLoss: (params) => api.get('/costs/profit-loss', { params }),
  getByCategory: (params) => api.get('/costs/by-category', { params }),
  getTrend: (params) => api.get('/costs/trend', { params }),
};

export const budgetService = {
  getAll: (params) => api.get('/budgets', { params }),
  getById: (id) => api.get(`/budgets/${id}`),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  delete: (id) => api.delete(`/budgets/${id}`),
  getSummary: (year, month) => api.get('/budgets/summary', { params: { year, month } }),
};

export const transactionHistoryService = {
  getAll: (params) => api.get('/transactions-history', { params }),
  exportCSV: (params) => api.get('/transactions-history/export/csv', { params, responseType: 'blob' }),
  exportJSON: (params) => api.get('/transactions-history/export/json', { params, responseType: 'blob' }),
};

export const commissionService = {
  getAll: (params) => api.get('/commissions', { params }),
  calculate: (data) => api.post('/commissions/calculate', data),
  updateStatus: (id, status) => api.patch(`/commissions/${id}/status`, { status }),
  getSummary: () => api.get('/commissions/summary'),
  getActiveCashiers: (params) => api.get('/commissions/active-cashiers', { params }),
};

export const monthlyClosingService = {
  getAll: (params) => api.get('/monthly-closings', { params }),
  getStatus: (year, month) => api.get('/monthly-closings/status', { params: { year, month } }),
  create: (data) => api.post('/monthly-closings', data),
  getReport: (year, month) => api.get(`/monthly-closings/report/${year}/${month}`),
  getCompanyStatus: () => api.get('/monthly-closings/company-status'),
  getOpeningBalances: (year, month) => api.get('/monthly-closings/opening-balances', { params: { year, month } }),
};

export const fiscalService = {
  getSequences: () => api.get('/fiscal/sequences'),
  createSequence: (data) => api.post('/fiscal/sequences', data),
  updateSequence: (id, data) => api.put(`/fiscal/sequences/${id}`, data),
  deleteSequence: (id) => api.delete(`/fiscal/sequences/${id}`),
  getStatus: () => api.get('/fiscal/status'),
  getSalesReport: (params) => api.get('/fiscal/report/sales', { params }),
  getPurchasesReport: (params) => api.get('/fiscal/report/purchases', { params }),
};

export const purchaseService = {
  getAll: (params) => api.get('/purchases', { params }),
  create: (data) => api.post('/purchases', data),
};

export const warrantyService = {
  getAll: (params) => api.get('/warranties', { params }),
  create: (data) => api.post('/warranties', data),
  delete: (id, data) => api.delete(`/warranties/${id}`, { data }),
};

export default api;
