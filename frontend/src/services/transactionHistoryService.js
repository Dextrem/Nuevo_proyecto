import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STORAGE_KEY = 'finandex_transactions_history';

const getStoredTransactions = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveStoredTransactions = (transactions) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
};

const useBackend = () => {
  const token = sessionStorage.getItem('accessToken');
  return !!token;
};

export const transactionHistoryService = {
  getAll: async (params = {}) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/transactions-history`, {
          params,
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    let transactions = getStoredTransactions();
    
    if (params.startDate) {
      transactions = transactions.filter(t => new Date(t.date) >= new Date(params.startDate));
    }
    if (params.endDate) {
      transactions = transactions.filter(t => new Date(t.date) <= new Date(params.endDate));
    }
    if (params.type) {
      transactions = transactions.filter(t => t.type === params.type);
    }
    if (params.category) {
      transactions = transactions.filter(t => t.category === params.category || t.categoryName === params.category);
    }
    if (params.search) {
      const s = params.search.toLowerCase();
      transactions = transactions.filter(t => 
        (t.description && t.description.toLowerCase().includes(s)) ||
        (t.reference && t.reference.toLowerCase().includes(s)) ||
        (t.clientName && t.clientName.toLowerCase().includes(s)) ||
        (t.supplierName && t.supplierName.toLowerCase().includes(s)) ||
        (t.userName && t.userName.toLowerCase().includes(s))
      );
    }
    
    return { data: transactions };
  },

  exportCSV: async (params) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/transactions-history/export/csv`, {
          params,
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` },
          responseType: 'blob'
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    const { data: transactions } = await transactionHistoryService.getAll(params);
    const headers = ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Categoría', 'Referencia', 'Usuario'];
    const rows = transactions.map(t => [
      t.date,
      t.type === 'income' ? 'Ingreso' : 'Gasto',
      t.description || '',
      t.amount,
      t.categoryName || '',
      t.reference || '',
      t.userName || '',
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return { data: csvContent };
  },

  exportJSON: async (params) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/transactions-history/export/json`, {
          params,
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` },
          responseType: 'blob'
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    const { data: transactions } = await transactionHistoryService.getAll(params);
    const exportData = transactions.map(t => ({
      fecha: t.date,
      tipo: t.type,
      descripcion: t.description,
      monto: t.amount,
      categoria: t.categoryName,
      referencia: t.reference,
      usuario: t.userName,
    }));
    return { data: JSON.stringify(exportData, null, 2) };
  },
};

export const addTransactionToHistory = (transaction) => {
  const transactions = getStoredTransactions();
  transactions.unshift({
    ...transaction,
    id: `txn_${Date.now()}`,
    date: new Date().toISOString(),
  });
  saveStoredTransactions(transactions);
};

export default transactionHistoryService;
