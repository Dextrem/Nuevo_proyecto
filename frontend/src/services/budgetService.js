import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const STORAGE_KEY = 'finandex_budgets';

const getStoredBudgets = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveStoredBudgets = (budgets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
};

const useBackend = () => {
  const token = sessionStorage.getItem('accessToken');
  return !!token;
};

export const budgetService = {
  getAll: async (params = {}) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/budgets`, {
          params,
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    let budgets = getStoredBudgets();
    
    if (params.year && params.month) {
      budgets = budgets.filter(b => 
        b.year === parseInt(params.year) && b.month === parseInt(params.month)
      );
    }
    
    return { data: budgets };
  },

  getById: async (id) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/budgets/${id}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
    const budgets = getStoredBudgets();
    const budget = budgets.find(b => b.id === id);
    if (!budget) throw new Error('Presupuesto no encontrado');
    return { data: budget };
  },

  create: async (data) => {
    if (useBackend()) {
      try {
        const response = await axios.post(`${API_URL}/budgets`, data, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    const budgets = getStoredBudgets();
    const newBudget = {
      ...data,
      id: `budget_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    budgets.push(newBudget);
    saveStoredBudgets(budgets);
    return { data: newBudget };
  },

  update: async (id, data) => {
    if (useBackend()) {
      try {
        const response = await axios.put(`${API_URL}/budgets/${id}`, data, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    const budgets = getStoredBudgets();
    const index = budgets.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Presupuesto no encontrado');
    budgets[index] = { ...budgets[index], ...data, updatedAt: new Date().toISOString() };
    saveStoredBudgets(budgets);
    return { data: budgets[index] };
  },

  delete: async (id) => {
    if (useBackend()) {
      try {
        const response = await axios.delete(`${API_URL}/budgets/${id}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    let budgets = getStoredBudgets();
    budgets = budgets.filter(b => b.id !== id);
    saveStoredBudgets(budgets);
    return { data: { success: true } };
  },

  getSummary: async (year, month) => {
    if (useBackend()) {
      try {
        const response = await axios.get(`${API_URL}/budgets/summary`, {
          params: { year, month },
          headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        return response;
      } catch (error) {
        console.warn('Backend unavailable, using localStorage');
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
    const budgets = getStoredBudgets();
    const filtered = budgets.filter(b => 
      b.year === parseInt(year) && b.month === parseInt(month)
    );
    
    const budgetByCategory = {};
    filtered.forEach(b => {
      const key = `${b.type}_${b.category}`;
      budgetByCategory[key] = { 
        planned: (budgetByCategory[key]?.planned || 0) + b.plannedAmount 
      };
    });
    
    return {
      data: {
        budgetByCategory,
        executionByCategory: {},
        totalIncome: 0,
        totalExpense: 0,
      }
    };
  },
};

export const getBudgetExecution = async (year, month) => {
  if (useBackend()) {
    try {
      const response = await axios.get(`${API_URL}/budgets/execution`, {
        params: { year, month },
        headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
      });
      return response;
    } catch (error) {
      console.warn('Backend execution endpoint error, using frontend fallback');
    }
  }
  
  // Fallback para modo demo/local (mismo que antes o simplificado)
  return { data: { income: 0, expense: 0, incomeByCategory: {}, expenseByCategory: {} } };
};

export default budgetService;
