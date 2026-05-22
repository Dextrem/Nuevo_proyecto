export const CONSTANTS = {
  CREDIT: {
    DEFAULT_LIMIT: 5000,
    MAX_DAYS: 30,
    MIN_DAYS: 1,
  },
  
  AUTH: {
    SESSION_TIMEOUT_MS: 30 * 60 * 1000,
    SESSION_CHECK_INTERVAL_MS: 10 * 1000,
  },

  DATE_FORMAT: {
    API_FORMAT: 'YYYY-MM-DD',
    DISPLAY_FORMAT: 'DD/MM/YYYY',
  },

  PAGINATION: {
    DEFAULT_PAGE_SIZE: 20,
  },

  VALIDATION: {
    MIN_PASSWORD_LENGTH: 8,
    MIN_USERNAME_LENGTH: 3,
    MAX_USERNAME_LENGTH: 30,
  },

  PRINT_TYPES: {
    THERMAL_80: 'thermal-80',
    THERMAL_58: 'thermal-58',
    LETTER: 'letter',
    A4: 'a4',
  },

  PAYMENT_METHODS: {
    CASH: 'CASH',
    CARD: 'CARD',
    CREDIT: 'CREDIT',
  },

  SALE_STATUS: {
    PENDING: 'PENDING',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
    PARTIAL: 'PARTIAL',
  },
};

export const getMaxDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + CONSTANTS.CREDIT.MAX_DAYS);
  return date.toISOString().split('T')[0];
};

export const getMinDueDate = () => {
  return new Date().toISOString().split('T')[0];
};
