import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/api';

const getAuthTimeout = () => {
  try {
    const stored = localStorage.getItem('finandex_settings');
    if (stored) {
      const s = JSON.parse(stored);
      if (s.sessionTimeoutMinutes && s.sessionTimeoutMinutes >= 5) return s.sessionTimeoutMinutes * 60 * 1000;
    }
  } catch {}
  return 240 * 60 * 1000;
};
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const logoutRef = useRef(null);

  useEffect(() => {
    if (initialized) return;
    
    const storedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('accessToken');
    const tokenExpiry = sessionStorage.getItem('tokenExpiry');

    if (storedUser && token) {
      try {
        if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
          sessionStorage.removeItem('user');
          sessionStorage.removeItem('accessToken');
          sessionStorage.removeItem('refreshToken');
          sessionStorage.removeItem('tokenExpiry');
        } else {
          setUser(JSON.parse(storedUser));
          if (tokenExpiry) {
            setSessionExpiry(new Date(tokenExpiry));
          }
        }
      } catch (e) {
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        sessionStorage.removeItem('tokenExpiry');
      }
    }
    setLoading(false);
    setInitialized(true);
  }, [initialized]);

  const resetSessionTimer = useCallback(() => {
    const timeout = getAuthTimeout();
    const expiry = new Date(Date.now() + timeout);
    setSessionExpiry(expiry);
    sessionStorage.setItem('tokenExpiry', expiry.toISOString());
  }, []);

  // Inactivity tracking: reset timer on any user activity
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
    let debounceTimer = null;

    const handleActivity = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        resetSessionTimer();
      }, 1000);
    };

    activityEvents.forEach((event) =>
      window.addEventListener(event, handleActivity, { passive: true })
    );

    // Also reset on successful token refresh (API activity)
    const handleTokenRefreshed = () => resetSessionTimer();
    window.addEventListener('tokenRefreshed', handleTokenRefreshed);

    return () => {
      activityEvents.forEach((event) =>
        window.removeEventListener(event, handleActivity)
      );
      window.removeEventListener('tokenRefreshed', handleTokenRefreshed);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [user, resetSessionTimer]);

  // Periodic check: log out when session expires
  useEffect(() => {
    if (!user || !sessionExpiry) return;

    const checkExpiry = setInterval(() => {
      if (new Date() >= sessionExpiry) {
        if (logoutRef.current) {
          logoutRef.current();
        }
      }
    }, 10000);

    return () => clearInterval(checkExpiry);
  }, [user, sessionExpiry]);

  const login = async (username, password) => {
    try {
      setError(null);
      const response = await authService.login(username, password);
      const data = response.data;

      if (data.mustChangePassword) {
        if (data.accessToken) {
          sessionStorage.setItem('accessToken', data.accessToken);
        }
        return {
          success: false,
          mustChangePassword: true,
          user: data.user,
          error: data.error || 'Debes cambiar tu contraseña',
        };
      }

      const { accessToken, refreshToken, user: userData } = data;

      sessionStorage.setItem('accessToken', accessToken);
      sessionStorage.setItem('refreshToken', refreshToken);
      sessionStorage.setItem('user', JSON.stringify(userData));

      const timeout = getAuthTimeout();
      const expiry = new Date(Date.now() + timeout);
      sessionStorage.setItem('tokenExpiry', expiry.toISOString());
      setSessionExpiry(expiry);

      setUser(userData);
      return { success: true };
    } catch (err) {
      if (err.response?.data?.mustChangePassword) {
        const data = err.response.data;
        if (data.accessToken) {
          sessionStorage.setItem('accessToken', data.accessToken);
        }
        return {
          success: false,
          mustChangePassword: true,
          user: data.user,
          error: data.error || 'Debes cambiar tu contraseña',
        };
      }
      const errorMessage =
        err.response?.data?.error || 'Error al iniciar sesión';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = useCallback(() => {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('tokenExpiry');
    setUser(null);
    setSessionExpiry(null);
  }, []);

  // Keep ref in sync for the expiry check interval
  useEffect(() => { logoutRef.current = logout; }, [logout]);

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    // Allow MANAGER to manage users by default
    if (permission === 'manage_users' && user.role === 'MANAGER') return true;
    return user.permissions?.[permission] === true;
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        hasPermission,
        hasRole,
        setUser,
        resetSessionTimer,
        sessionExpiry,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
