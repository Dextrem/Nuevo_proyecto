import * as XLSX from 'xlsx';

const TOKEN_KEY = 'finandex_access_token';
const REFRESH_KEY = 'finandex_refresh_token';
const USER_KEY = 'finandex_user';

export const sanitizeText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const storage = {
  getAccessToken: () => localStorage.getItem(TOKEN_KEY),
  setAccessToken: (token) => localStorage.setItem(TOKEN_KEY, token),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  setRefreshToken: (token) => localStorage.setItem(REFRESH_KEY, token),
  getUser: () => {
    const user = localStorage.getItem(USER_KEY);
    try {
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  clearAll: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export const formatCurrency = (amount, currency = 'DOP') => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return currency === 'DOP' ? 'RD$ 0.00' : '$ 0.00';
  }
  const locale = currency === 'DOP' ? 'es-DO' : 'en-US';
  const symbol = currency === 'DOP' ? 'RD$' : '$';
  return `${symbol} ${Number(amount).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (date, format = 'short') => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const options = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    time: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  };

  return d.toLocaleDateString('es-ES', options[format] || options.short);
};

export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toFixed(decimals);
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

export const downloadFile = (data, filename, mimeType = 'application/json') => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToExcel = (data, filename) => {
  const worksheet = data.map((row) =>
    row.map((cell) => (cell !== null && cell !== undefined ? String(cell) : ''))
  );
  const csvContent = worksheet.map((row) => row.join(',')).join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

export const parseExcelFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo archivo'));
    reader.readAsArrayBuffer(file);
  });
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const validatePhone = (phone) => {
  const re = /^[0-9+\-\s()]{7,20}$/;
  return re.test(phone);
};

export const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const isToday = (date) => {
  const d = new Date(date);
  const today = new Date();
  return d.toDateString() === today.toDateString();
};

export const getDateRange = (range) => {
  const ranges = {
    today: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { start, end: now };
    },
    yesterday: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);
      return { start, end };
    },
    week: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      return { start, end: now };
    },
    month: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return { start, end: now };
    },
    year: () => {
      const now = new Date();
      const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { start, end: now };
    },
  };
  const fn = ranges[range];
  return fn ? fn() : ranges.today();
};
