import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsService } from '../services/api';
import { dataPersistence } from '../hooks/useDataPersistence';

const SETTINGS_KEY = 'finandex_settings';

const DEFAULT_SETTINGS = {
  companyName: 'Mi Empresa',
  currency: 'DOP',
  currencySymbol: 'RD$',
  taxRate: 0.18,
  interestRate: 0.02,
  theme: 'light',
  primaryColor: '#4F46E5',
  accent: '#8B5CF6',
  secondary: '#10B981',
  commissionRate: 0.15,
  commissionMinAmount: 4000,
  commissionType: 'BY_SALE',
  // Security
  sessionTimeoutMinutes: 240,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  defaultPasswordExpDays: 90,
  // POS / Sales
  defaultCreditLimit: 5000,
  allowNegativeStock: false,
  receiptFooterMessage: '',
  requireCashRegister: true,
  // Inventory
  lowStockAlertEnabled: true,
  defaultMinStock: 5,
  // Fiscal
  fiscalEnabled: false,
  defaultNcfType: '02',
  // Warranty
  warrantyEnabled: true,
  warrantyMinAmount: 2000,
  warrantyDefaultDays: 90,
  warrantyCoverageText: '',
  warrantyExclusionText: '',
};

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      'data-theme',
      settings.theme
    );
    document.documentElement.style.setProperty(
      '--primary',
      settings.primaryColor
    );
    if (settings.accent) {
      document.documentElement.style.setProperty('--accent', settings.accent);
    }
    if (settings.secondary) {
      document.documentElement.style.setProperty('--secondary', settings.secondary);
    }
    
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const loadSettings = async () => {
    try {
      const response = await settingsService.get();
      const newSettings = { ...DEFAULT_SETTINGS, ...response.data };
      setSettings(newSettings);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('No autenticado, usando configuración guardada');
      } else {
        console.log('Cargando configuración desde localStorage');
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          try {
            setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
          } catch {}
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const { accent, secondary, ...apiData } = newSettings;
      const response = await settingsService.update(apiData);
      const updated = { ...settings, ...response.data.settings };
      setSettings(updated);
      return { success: true };
    } catch (error) {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return { success: true, local: true };
    }
  };

  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, duration);
  }, []);

  const formatCurrency = useCallback((amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return `${settings.currencySymbol} 0.00`;
    }
    return `${settings.currencySymbol} ${parseFloat(amount).toLocaleString(
      settings.currency === 'USD' ? 'en-US' : 'es-DO',
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;
  }, [settings.currency, settings.currencySymbol]);

  const calculateTax = useCallback((subtotal) => {
    return (subtotal || 0) * (settings.taxRate || 0);
  }, [settings.taxRate]);

  return (
    <AppContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        loadSettings,
        formatCurrency,
        calculateTax,
        notifications,
        showNotification,
      }}
    >
      {children}
      <NotificationContainer notifications={notifications} />
    </AppContext.Provider>
  );
};

const NotificationContainer = ({ notifications }) => {
  if (notifications.length === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification-${notification.type}`}
          style={{
            padding: '12px 20px',
            borderRadius: '8px',
            background: notification.type === 'success' ? 'var(--secondary)' :
                       notification.type === 'error' ? 'var(--danger)' :
                       notification.type === 'warning' ? '#F59E0B' :
                       'var(--primary)',
            color: 'white',
            boxShadow: 'var(--shadow-lg)',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '300px',
          }}
        >
          {notification.message}
        </div>
      ))}
    </div>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
