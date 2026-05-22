import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [infoMessage, setInfoMessage] = useState(null);
  const { login, error } = useAuth();
  const { settings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = sessionStorage.getItem('accessToken');
    const tokenExpiry = sessionStorage.getItem('tokenExpiry');
    
    if (token && tokenExpiry && new Date(tokenExpiry) > new Date()) {
      navigate('/');
      return;
    }
    
    if (tokenExpiry && new Date(tokenExpiry) < new Date()) {
      setSessionExpired(true);
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('tokenExpiry');
    }
    
    if (location.state?.message) {
      setInfoMessage(location.state.message);
      // Limpiar el estado del historial para que no vuelva a aparecer al refrescar
      window.history.replaceState({}, document.title);
    }
  }, [navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/');
    } else if (result.mustChangePassword) {
      navigate('/change-password', {
        state: {
          user: result.user,
          mustChange: true,
          message: 'Debes cambiar tu contraseña antes de continuar',
        },
      });
    }

    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-box">
        <div className="login-left">
          {settings.logo ? (
            <img 
              src={settings.logo} 
              alt="Logo" 
              className="login-logo-img"
            />
          ) : (
            <i className="fas fa-chart-line logo-icon"></i>
          )}
          <h1>{settings.companyName}</h1>
          <p>Sistema de Gestión Financiera Integral</p>
        </div>

        <div className="login-right">
          <div className="login-header">
            <h2>¡Bienvenido!</h2>
            <p>Ingresa tus credenciales para acceder al sistema</p>
          </div>

          {sessionExpired && (
            <div className="session-alert">
              <i className="fas fa-clock"></i>
              <span>Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.</span>
            </div>
          )}

          {infoMessage && (
            <div className="success-alert">
              <i className="fas fa-check-circle"></i>
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="error-alert">
              <i className="fas fa-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label>Usuario</label>
              <div className="input-wrapper">
                <input
                  type="text"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu nombre de usuario"
                  required
                  autoComplete="username"
                />
                <i className="fas fa-user"></i>
              </div>
            </div>

            <div className="form-group">
              <label>Contraseña</label>
              <div className="input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                  autoComplete="current-password"
                />
                <i className="fas fa-lock"></i>
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    zIndex: 10,
                    padding: '8px'
                  }}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fas fa-circle-notch fa-spin"></i>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>© 2024 {settings.companyName}. Todos los derechos reservados.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
