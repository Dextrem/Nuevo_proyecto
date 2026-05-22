import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

const ChangePassword = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mustChange = location.state?.mustChange;
  const message = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      await authService.changePassword(currentPassword || 'admin', newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login', { state: { message: 'Contraseña cambiada exitosamente. Inicia sesión.' } }), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-wrapper">
        <div className="login-box" style={{ maxWidth: '450px', padding: '2rem', textAlign: 'center' }}>
          <i className="fas fa-check-circle" style={{ fontSize: '3rem', color: 'var(--success)', marginBottom: '1rem' }}></i>
          <h2>Contraseña cambiada</h2>
          <p>Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrapper">
      <div className="login-box" style={{ maxWidth: '450px', padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <i className="fas fa-key" style={{ fontSize: '2.5rem', color: 'var(--warning)', marginBottom: '0.5rem' }}></i>
          <h2>Cambiar Contraseña</h2>
          {message && <p style={{ color: 'var(--warning)' }}>{message}</p>}
        </div>

        {error && (
          <div className="error-alert">
            <i className="fas fa-exclamation-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {!mustChange && (
            <div className="form-group">
              <label>Contraseña Actual</label>
              <div className="input-wrapper">
                <input
                  type="password"
                  className="form-control"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Tu contraseña actual"
                  required
                  autoComplete="current-password"
                />
                <i className="fas fa-lock"></i>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Nueva Contraseña</label>
            <div className="input-wrapper">
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                autoComplete="new-password"
              />
              <i className="fas fa-key"></i>
            </div>
          </div>

          <div className="form-group">
            <label>Confirmar Contraseña</label>
            <div className="input-wrapper">
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                autoComplete="new-password"
              />
              <i className="fas fa-check"></i>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            La contraseña debe tener al menos 8 caracteres e incluir al menos 3 de: mayúscula, minúscula, número, carácter especial.
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <><i className="fas fa-circle-notch fa-spin"></i> Cambiando...</>
            ) : (
              <><i className="fas fa-save"></i> Cambiar Contraseña</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
