import { useAuth } from '../context/AuthContext';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

const SessionWarning = () => {
  const { logout, user } = useAuth();
  
  const { showWarning, remainingTime, formatTime, extendSession } = useSessionTimeout({
    timeout: 30 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  if (!showWarning) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 10000 }}>
      <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
          <i className="fas fa-clock" style={{ color: 'var(--accent)' }}></i>
        </div>
        <h2 style={{ marginBottom: '16px' }}>Sesión por expirar</h2>
        <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>
          Tu sesión expirará en <strong style={{ color: 'var(--accent)' }}>{formatTime(remainingTime)}</strong> minutos
          debido a inactividad.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={extendSession}
          >
            <i className="fas fa-clock"></i> Continuar sesión
          </button>
          <button
            className="btn btn-outline"
            onClick={logout}
          >
            <i className="fas fa-sign-out-alt"></i> Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarning;
