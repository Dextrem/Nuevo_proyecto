import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEFAULT_TIMEOUT = 30 * 60 * 1000;
const WARNING_TIME = 5 * 60 * 1000;

export const useSessionTimeout = (options = {}) => {
  const {
    timeout = DEFAULT_TIMEOUT,
    warningTime = WARNING_TIME,
    onTimeout,
    enabled = true,
  } = options;
  
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  
  const timeoutRef = useRef(null);
  const warningRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);
  
  const resetTimers = useCallback(() => {
    clearTimers();
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    
    if (!enabled || !user) return;
    
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingTime(timeout - warningTime);
    }, timeout - warningTime);
    
    timeoutRef.current = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      } else {
        logout();
        navigate('/login', { 
          state: { message: 'Sesión expirada por inactividad' } 
        });
      }
    }, timeout);
  }, [timeout, warningTime, enabled, user, logout, navigate, onTimeout, clearTimers]);
  
  const extendSession = useCallback(() => {
    resetTimers();
  }, [resetTimers]);
  
  useEffect(() => {
    if (!enabled || !user) {
      clearTimers();
      return;
    }
    
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 30000) {
        lastActivityRef.current = now;
        resetTimers();
      }
    };
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });
    
    resetTimers();
    
    let interval;
    if (showWarning) {
      interval = setInterval(() => {
        setRemainingTime(prev => {
          if (prev <= 1000) {
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearTimers();
      if (interval) clearInterval(interval);
    };
  }, [enabled, user, resetTimers, clearTimers, showWarning]);
  
  const formatTime = useCallback((ms) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);
  
  return {
    showWarning,
    remainingTime,
    formatTime,
    extendSession,
    resetTimers,
  };
};

export default useSessionTimeout;
