import { useEffect, useCallback, useRef } from 'react';

const STORAGE_KEYS = {
  PRODUCTS: 'finandex_products',
  CATEGORIES: 'finandex_categories',
  CLIENTS: 'finandex_clients',
  SUPPLIERS: 'finandex_suppliers',
  SALES: 'finandex_sales',
  QUOTATIONS: 'finandex_quotations',
  TRANSACTIONS: 'finandex_transactions',
  BUDGETS: 'finandex_budgets',
  TRANSACTIONS_HISTORY: 'finandex_transactions_history',
  SETTINGS: 'finandex_settings',
  LAST_SYNC: 'finandex_last_sync',
};

const MAX_STORAGE_SIZE = 5 * 1024 * 1024;

const checkStorageSize = () => {
  let totalSize = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith('finandex_')) {
      totalSize += localStorage[key].length * 2;
    }
  }
  return totalSize;
};

const saveToStorage = (key, data) => {
  try {
    if (checkStorageSize() > MAX_STORAGE_SIZE) {
      console.warn('Storage size limit approaching, clearing old data...');
      clearOldData();
    }
    
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
    if (error.name === 'QuotaExceededError') {
      clearOldData();
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch {
        console.error('Storage quota exceeded even after cleanup');
      }
    }
    return false;
  }
};

const loadFromStorage = (key, defaultValue = null) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  } catch (error) {
    console.error(`Error loading ${key}:`, error);
    return defaultValue;
  }
};

const clearOldData = () => {
  const sales = loadFromStorage(STORAGE_KEYS.SALES, []);
  const transactions = loadFromStorage(STORAGE_KEYS.TRANSACTIONS, []);
  
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  
  const filteredSales = sales.filter(s => new Date(s.createdAt) > oneMonthAgo);
  const filteredTransactions = transactions.filter(t => new Date(t.date) > oneMonthAgo);
  
  saveToStorage(STORAGE_KEYS.SALES, filteredSales);
  saveToStorage(STORAGE_KEYS.TRANSACTIONS, filteredTransactions);
};

export const dataPersistence = {
  saveProducts: (products) => saveToStorage(STORAGE_KEYS.PRODUCTS, products),
  loadProducts: () => loadFromStorage(STORAGE_KEYS.PRODUCTS, []),
  
  saveCategories: (categories) => saveToStorage(STORAGE_KEYS.CATEGORIES, categories),
  loadCategories: () => loadFromStorage(STORAGE_KEYS.CATEGORIES, []),
  
  saveClients: (clients) => saveToStorage(STORAGE_KEYS.CLIENTS, clients),
  loadClients: () => loadFromStorage(STORAGE_KEYS.CLIENTS, []),
  
  saveSuppliers: (suppliers) => saveToStorage(STORAGE_KEYS.SUPPLIERS, suppliers),
  loadSuppliers: () => loadFromStorage(STORAGE_KEYS.SUPPLIERS, []),
  
  saveSales: (sales) => saveToStorage(STORAGE_KEYS.SALES, sales),
  loadSales: () => loadFromStorage(STORAGE_KEYS.SALES, []),
  
  saveQuotations: (quotations) => saveToStorage(STORAGE_KEYS.QUOTATIONS, quotations),
  loadQuotations: () => loadFromStorage(STORAGE_KEYS.QUOTATIONS, []),
  
  saveTransactions: (transactions) => saveToStorage(STORAGE_KEYS.TRANSACTIONS, transactions),
  loadTransactions: () => loadFromStorage(STORAGE_KEYS.TRANSACTIONS, []),
  
  saveBudgets: (budgets) => saveToStorage(STORAGE_KEYS.BUDGETS, budgets),
  loadBudgets: () => loadFromStorage(STORAGE_KEYS.BUDGETS, []),
  
  saveTransactionsHistory: (history) => saveToStorage(STORAGE_KEYS.TRANSACTIONS_HISTORY, history),
  loadTransactionsHistory: () => loadFromStorage(STORAGE_KEYS.TRANSACTIONS_HISTORY, []),
  
  saveSettings: (settings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings),
  loadSettings: () => loadFromStorage(STORAGE_KEYS.SETTINGS, null),
  
  setLastSync: () => saveToStorage(STORAGE_KEYS.LAST_SYNC, new Date().toISOString()),
  getLastSync: () => loadFromStorage(STORAGE_KEYS.LAST_SYNC, null),
  
  clearAll: () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  },
  
  getStorageInfo: () => {
    const info = {};
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const data = localStorage.getItem(key);
      if (data) {
        info[name] = {
          size: (data.length * 2 / 1024).toFixed(2) + ' KB',
          items: JSON.parse(data).length
        };
      } else {
        info[name] = { size: '0 KB', items: 0 };
      }
    });
    return info;
  }
};

export const useDataPersistence = (dataType, initialData = []) => {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const storageKey = STORAGE_KEYS[dataType] || `finandex_${dataType}`;
  
  useEffect(() => {
    const stored = loadFromStorage(storageKey, initialData);
    setData(Array.isArray(stored) ? stored : initialData);
    setLoading(false);
  }, [storageKey, initialData]);
  
  const saveData = useCallback((newData) => {
    const dataToSave = Array.isArray(newData) ? newData : [newData];
    setData(dataToSave);
    saveToStorage(storageKey, dataToSave);
  }, [storageKey]);
  
  const updateData = useCallback((updater) => {
    setData(prev => {
      const updated = typeof updater === 'function' ? updater(prev) : prev;
      saveToStorage(storageKey, updated);
      return updated;
    });
  }, [storageKey]);
  
  const clearData = useCallback(() => {
    setData(initialData);
    localStorage.removeItem(storageKey);
  }, [storageKey, initialData]);
  
  return {
    data,
    setData: saveData,
    updateData,
    clearData,
    loading,
    isSyncing,
    setIsSyncing,
  };
};

export default dataPersistence;
